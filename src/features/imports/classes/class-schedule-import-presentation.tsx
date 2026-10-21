import Link from "next/link";

import { LoadingNotice } from "@/components/shared/loading-state";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatIsoWeekday, labelFrom } from "@/features/imports/components/import-labels";
import type { ImportReviewColumn, ImportRowSeverity } from "@/features/imports/components/import-review-table";
import type { ImportSummaryCell } from "@/features/imports/components/import-summary-strip";
import type { StepperStep } from "@/components/patterns/stepper";
import { formatIsoDate, formatTime } from "@/lib/datetime";
import { formatLearningMode, formatNumber } from "@/lib/format";

import type {
  ClassScheduleImportSummaryCount,
  DryRunClassResultRow,
  DryRunScheduleResultRow,
} from "./types";

/*
 * Wording and table columns shared by the class & schedule import wizard
 * (/imports/classes) and its batch page (/imports/classes/[batchId]), so a
 * row reads the same before and after the batch is created. Pure: no hooks,
 * no actions.
 */

/** Fields a review row needs; dry-run rows and staged batch rows both have them. */
export type ClassReviewRow = Pick<
  DryRunClassResultRow,
  | "class_code"
  | "class_name"
  | "classification"
  | "default_learning_mode"
  | "grade"
  | "level"
  | "resolved_class_id"
  | "source_row_number"
  | "status"
  | "validation_message"
  | "weekly_session_count"
>;

export type ScheduleReviewRow = Pick<
  DryRunScheduleResultRow,
  | "class_code"
  | "classification"
  | "component_code"
  | "effective_from"
  | "effective_to"
  | "end_time"
  | "learning_mode"
  | "room_name"
  | "source_row_number"
  | "start_time"
  | "validation_message"
  | "weekday"
>;

/** Accessible name of the Stepper on both pages. */
export const CLASS_IMPORT_STEPPER_LABEL = "Các bước nhập lớp & lịch học";

/** The pipeline's five real steps (W1): four on the wizard page, the last on the batch page. */
export const CLASS_IMPORT_STEP_TITLES = [
  "Tải mẫu & chọn file",
  "Ánh xạ cột",
  "Kiểm tra dòng",
  "Tạo lô",
  "Xác nhận nhập",
] as const;

const CLASS_IMPORT_STEP_DESCRIPTIONS = [
  "File có hai sheet Classes và Schedules",
  "Ghép cột của từng sheet",
  "Máy chủ đối chiếu, chưa ghi gì",
  "Lưu file thành lô chờ xác nhận",
  "Ở trang lô: tạo lớp và lịch học",
] as const;

/**
 * Stepper steps with `currentIndex` (0-based) current, the ones before it
 * done and the rest upcoming; `allDone` marks every step done (a committed
 * batch).
 */
export function buildClassImportSteps(currentIndex: number, allDone = false): StepperStep[] {
  return CLASS_IMPORT_STEP_TITLES.map((title, index) => ({
    description: CLASS_IMPORT_STEP_DESCRIPTIONS[index],
    state: allDone || index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    title,
  }));
}

interface RowStateMeta {
  label: string;
  severity: ImportRowSeverity;
  tone: BadgeTone;
}

/**
 * Server classification → words. Conflicts and invalid rows block the batch
 * (create and commit), so both read as errors; a row that already exists and
 * matches needs nothing.
 */
const ROW_STATES: Readonly<Record<string, RowStateMeta>> = {
  committed: { label: "Đã nhập", severity: "valid", tone: "success" },
  existing_conflict: { label: "Xung đột", severity: "error", tone: "danger" },
  existing_matching: { label: "Đã tồn tại & khớp", severity: "neutral", tone: "info" },
  invalid: { label: "Không hợp lệ", severity: "error", tone: "danger" },
  new: { label: "Tạo mới", severity: "valid", tone: "success" },
};

export function getRowStateMeta(classification: string | null | undefined): RowStateMeta {
  const key = classification ?? "";
  if (Object.hasOwn(ROW_STATES, key)) return ROW_STATES[key];
  return { label: `Trạng thái chưa hỗ trợ: ${key || "trống"}`, severity: "warning", tone: "neutral" };
}

const CLASS_STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "Đang hoạt động",
  archived: "Lưu trữ",
  closed: "Đã đóng",
  draft: "Nháp",
};

/** Class status as the file gives it (the commit creates the class with it); an unknown value stays visible. */
export function formatImportedClassStatus(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "—";
  return labelFrom(CLASS_STATUS_LABELS, raw.toLowerCase(), () => raw);
}

/** Learning mode in words for the three known values; anything else stays visible as typed. */
export function formatImportedLearningMode(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "—";
  const known = raw.toLowerCase();
  return known === "offline" || known === "online" || known === "hybrid" ? formatLearningMode(known) : raw;
}

/** "18:00–19:30" from `HH:MM:SS` values. */
export function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** "từ 02/11/2026" or "từ 02/11/2026 đến 31/05/2027". */
export function formatEffectiveRange(from: string | null | undefined, to: string | null | undefined): string {
  return to ? `từ ${formatIsoDate(from)} đến ${formatIsoDate(to)}` : `từ ${formatIsoDate(from)}`;
}

/** Number of rows that block a batch (conflicts + invalid) across both sheets. */
export function countBlockingRows(classes: ClassScheduleImportSummaryCount, schedules: ClassScheduleImportSummaryCount): number {
  return classes.existing_conflict + classes.invalid + schedules.existing_conflict + schedules.invalid;
}

/** Reason under a disabled "Tạo lô" / step primary while rows block the batch. */
export function blockingRowsReason(count: number): string {
  return `Còn ${formatNumber(count)} dòng xung đột hoặc không hợp lệ. Sửa file Excel rồi chọn lại file.`;
}

/** Summary strip cells (Tổng · Tạo mới · Đã tồn tại & khớp · Xung đột · Không hợp lệ). */
export function buildSummaryCells(summary: ClassScheduleImportSummaryCount): ImportSummaryCell[] {
  return [
    { label: "Tổng", value: summary.total },
    { label: "Tạo mới", tone: "success", value: summary.new },
    { label: "Đã tồn tại & khớp", value: summary.existing_matching },
    { label: "Xung đột", tone: summary.existing_conflict > 0 ? "danger" : "muted", value: summary.existing_conflict },
    { label: "Không hợp lệ", tone: summary.invalid > 0 ? "danger" : "muted", value: summary.invalid },
  ];
}

function RowStateBadge({ classification }: { classification: string }) {
  const meta = getRowStateMeta(classification);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function getClassRowSeverity(row: ClassReviewRow | ScheduleReviewRow): ImportRowSeverity {
  return getRowStateMeta(row.classification).severity;
}

export function getRowIssue(row: ClassReviewRow | ScheduleReviewRow): string | null {
  return row.validation_message?.trim() || null;
}

/** Review columns of the Classes sheet; `classHref` adds the "Lớp trong hệ thống" link (batch page). */
export function buildClassReviewColumns(options: { classHref?: (classId: string) => string } = {}): ImportReviewColumn<ClassReviewRow>[] {
  const columns: ImportReviewColumn<ClassReviewRow>[] = [
    {
      align: "right",
      header: "Dòng",
      hideInCard: true,
      key: "row",
      render: (row) => <span className="text-text-muted">{row.source_row_number}</span>,
      width: "64px",
    },
    { header: "Mã lớp", hideInCard: true, key: "code", render: (row) => <span className="font-semibold text-text-strong">{row.class_code || "—"}</span> },
    { header: "Tên lớp", key: "name", render: (row) => row.class_name || "—" },
    { header: "Khối · trình độ", key: "grade", render: (row) => `Khối ${row.grade ?? "—"} · ${row.level || "—"}` },
    { align: "right", header: "Buổi/tuần", key: "weekly", render: (row) => row.weekly_session_count ?? "—" },
    { header: "Hình thức", key: "mode", render: (row) => formatImportedLearningMode(row.default_learning_mode) },
    { header: "Trạng thái lớp", key: "status", render: (row) => formatImportedClassStatus(row.status) },
    { header: "Kết quả", key: "state", render: (row) => <RowStateBadge classification={row.classification} /> },
  ];

  const { classHref } = options;
  if (classHref) {
    columns.push({
      header: "Lớp trong hệ thống",
      key: "class-link",
      render: (row) =>
        row.resolved_class_id ? (
          <Link
            aria-label={`Mở lớp ${row.class_code}`}
            className="inline-flex min-h-11 items-center font-semibold text-action-link! underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
            href={classHref(row.resolved_class_id)}
          >
            Mở lớp
          </Link>
        ) : (
          <span className="text-text-muted">Chưa có</span>
        ),
    });
  }

  return columns;
}

/** Review columns of the Schedules sheet; the weekday reads "Thứ Hai" … "Chủ nhật" (ISO 1 … 7). */
export function buildScheduleReviewColumns(): ImportReviewColumn<ScheduleReviewRow>[] {
  return [
    {
      align: "right",
      header: "Dòng",
      hideInCard: true,
      key: "row",
      render: (row) => <span className="text-text-muted">{row.source_row_number}</span>,
      width: "64px",
    },
    { header: "Mã lớp", hideInCard: true, key: "code", render: (row) => <span className="font-semibold text-text-strong">{row.class_code || "—"}</span> },
    { header: "Thành phần", key: "component", render: (row) => row.component_code || "—" },
    { header: "Thứ", key: "weekday", render: (row) => formatIsoWeekday(row.weekday) },
    { header: "Giờ học", key: "time", render: (row) => <span className="tabular-nums">{formatTimeRange(row.start_time, row.end_time)}</span> },
    { header: "Hình thức", key: "mode", render: (row) => formatImportedLearningMode(row.learning_mode) },
    { header: "Phòng", key: "room", render: (row) => row.room_name?.trim() || "—" },
    { header: "Hiệu lực", key: "effective", render: (row) => <span className="tabular-nums">{formatEffectiveRange(row.effective_from, row.effective_to)}</span> },
    { header: "Kết quả", key: "state", render: (row) => <RowStateBadge classification={row.classification} /> },
  ];
}

export function classRowCardTitle(row: ClassReviewRow): string {
  return `Dòng ${row.source_row_number} · ${row.class_code || "chưa có mã lớp"}`;
}

export function scheduleRowCardTitle(row: ScheduleReviewRow): string {
  return `Dòng ${row.source_row_number} · ${row.class_code || "chưa có mã lớp"} · ${formatIsoWeekday(row.weekday)}`;
}

/**
 * Route skeleton (W6) of /imports/classes and its batch page: the loading
 * notice, then the header, a five-step stepper and the step frame as grey
 * blocks (no step is claimed current before the page knows it).
 */
export function ClassImportRouteSkeleton({ title }: { title: string }) {
  return (
    <div className="grid min-w-0 gap-5">
      <LoadingNotice title={title} />
      <div aria-hidden="true" className="grid gap-5 motion-safe:animate-pulse">
        <div className="grid gap-2">
          <div className="h-8 w-72 max-w-full rounded-sm bg-surface-sunken" />
          <div className="h-4 w-96 max-w-full rounded-sm bg-surface-sunken" />
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-row sm:grid-cols-2 xl:grid-cols-5">
          {CLASS_IMPORT_STEP_TITLES.map((stepTitle) => (
            <div className="flex items-center gap-3 bg-surface-base px-4 py-3" key={stepTitle}>
              <div className="h-6 w-6 shrink-0 rounded-full bg-surface-sunken" />
              <div className="h-3.5 w-32 rounded-sm bg-surface-sunken" />
            </div>
          ))}
        </div>
        <div className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-5">
          <div className="h-4 w-2/5 rounded-sm bg-surface-sunken" />
          <div className="h-4 w-[70%] rounded-sm bg-surface-sunken" />
          <div className="h-32 rounded-md border border-dashed border-border-strong" />
        </div>
        <div className="h-16 rounded-lg border border-border-subtle bg-surface-base" />
      </div>
    </div>
  );
}
