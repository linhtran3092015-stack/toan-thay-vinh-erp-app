"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { GuardedActionPanel, type GuardedCondition } from "@/components/patterns/guarded-action-panel";
import { PageHeader } from "@/components/patterns/page-header";
import { Stepper } from "@/components/patterns/stepper";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import { formatImportTimestamp, formatIsoWeekday } from "@/features/imports/components/import-labels";
import { ImportSummaryStrip, type ImportSummaryCell } from "@/features/imports/components/import-summary-strip";
import { importStepperClassName } from "@/features/imports/components/import-wizard-frame";
import { formatNumber } from "@/lib/format";

import { commitClassScheduleImportBatchAction } from "./actions";
import type { ClassScheduleImportActionOverrides } from "./class-schedule-import-action-overrides";
import {
  buildClassImportSteps,
  buildSummaryCells,
  CLASS_IMPORT_STEPPER_LABEL,
  formatEffectiveRange,
  formatImportedClassStatus,
  formatImportedLearningMode,
  formatTimeRange,
} from "./class-schedule-import-presentation";
import { ClassScheduleRowsTabs } from "./class-schedule-import-rows";
import type { ClassScheduleImportBatchDetail, ClassScheduleImportBatchRecord, ClassScheduleImportSummaryCount } from "./types";

/**
 * Typed confirmation the server validates (`commitClassScheduleImportBatchSchema`
 * in schemas.ts compares the trimmed text to exactly this). Frozen copy.
 */
export const CLASS_IMPORT_COMMIT_PHRASE = "IMPORT LOP LICH";

const CONNECTION_LOST_MESSAGE = "Không rõ kết quả. Mở lại trang lô để kiểm tra trước khi thử lại.";

const BATCH_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  committed: { label: "Đã nhập", tone: "success" },
  previewed: { label: "Không nhập được", tone: "danger" },
  ready_to_commit: { label: "Chờ xác nhận nhập", tone: "info" },
  rejected: { label: "Đã từ chối", tone: "danger" },
};

export function getClassImportBatchStatusMeta(status: string | null | undefined): { label: string; tone: BadgeTone } {
  const key = status ?? "";
  if (Object.hasOwn(BATCH_STATUS, key)) return BATCH_STATUS[key];
  return { label: `Trạng thái chưa hỗ trợ: ${key || "trống"}`, tone: "neutral" };
}

function classSummary(batch: ClassScheduleImportBatchRecord): ClassScheduleImportSummaryCount {
  return {
    existing_conflict: batch.class_conflict_count,
    existing_matching: batch.class_matching_count,
    invalid: batch.class_invalid_count,
    new: batch.class_new_count,
    total: batch.class_row_count,
  };
}

function scheduleSummary(batch: ClassScheduleImportBatchRecord): ClassScheduleImportSummaryCount {
  return {
    existing_conflict: batch.schedule_conflict_count,
    existing_matching: batch.schedule_matching_count,
    invalid: batch.schedule_invalid_count,
    new: batch.schedule_new_count,
    total: batch.schedule_row_count,
  };
}

/** The batch stores account ids only (no names are loaded for this page). */
function ActorValue({ id }: { id: string | null }) {
  if (!id) return <span className="text-text-muted">Không rõ</span>;
  return (
    <span className="font-mono text-secondary font-normal" title={id}>
      Tài khoản {id.slice(0, 8)}…
    </span>
  );
}

export interface ClassScheduleBatchDetailPageProps {
  detail: ClassScheduleImportBatchDetail;
  /** Defaults to the real server action; the /dev/imports preview passes an inert stub. */
  actions?: Pick<ClassScheduleImportActionOverrides, "commitClassScheduleImportBatch">;
  /** Back link to the import wizard; the preview keeps it under /dev. */
  importHref?: string;
  /** "Mở lớp" target of a staged row's class; defaults to the real class page, the preview keeps it under /dev. */
  classHref?: (classId: string) => string;
}

const classDetailHref = (classId: string) => `/classes/${classId}`;

/**
 * /imports/classes/[batchId] (design 17c, step 5 "Xác nhận nhập"): the batch
 * header with its status, the same Stepper as the wizard (steps 1–4 done),
 * file / actor / reason facts in Vietnam time, the two summary strips, the
 * classes and schedules the commit will create, the guarded commit (typed
 * phrase "IMPORT LOP LICH", reason, confirmation; only while the batch is
 * ready) and every staged row per sheet.
 */
export function ClassScheduleBatchDetailPage({
  actions,
  classHref = classDetailHref,
  detail,
  importHref = "/imports/classes",
}: ClassScheduleBatchDetailPageProps) {
  const commitClassScheduleImportBatch = actions?.commitClassScheduleImportBatch ?? commitClassScheduleImportBatchAction;
  const router = useRouter();
  const ids = useId();

  // Local copy so a commit shows at once; a new `detail` from the server
  // (router.refresh after the commit) replaces it.
  const [currentDetail, setCurrentDetail] = useState<ClassScheduleImportBatchDetail>(detail);
  const [sourceDetail, setSourceDetail] = useState<ClassScheduleImportBatchDetail>(detail);
  if (sourceDetail !== detail) {
    setSourceDetail(detail);
    setCurrentDetail(detail);
  }

  const [isPendingCommit, startTransitionCommit] = useTransition();
  const [commitReason, setCommitReason] = useState(detail.batch.reason ?? "");
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [commitError, setCommitError] = useState<string | null>(null);

  const { batch, classRows, scheduleRows } = currentDetail;
  const status = getClassImportBatchStatusMeta(batch.status);
  const isCommitted = batch.status === "committed";
  const isReady = batch.status === "ready_to_commit";
  const blockingCount =
    batch.class_conflict_count + batch.class_invalid_count + batch.schedule_conflict_count + batch.schedule_invalid_count;

  const newClassRows = classRows.filter((row) => row.classification === "new");
  const newScheduleRows = scheduleRows.filter((row) => row.classification === "new");

  const trimmedReason = commitReason.trim();
  const phraseMatches = confirmationText.trim() === CLASS_IMPORT_COMMIT_PHRASE;
  const commitBlockedReason =
    blockingCount > 0
      ? `Còn ${formatNumber(blockingCount)} dòng xung đột hoặc không hợp lệ.`
      : !trimmedReason
        ? "Nhập lý do nhập."
        : !confirmationChecked
          ? "Đánh dấu ô xác nhận."
          : !phraseMatches
            ? `Gõ đúng cụm ${CLASS_IMPORT_COMMIT_PHRASE}.`
            : undefined;
  // Same rule as before the redesign, from the batch counts and the three inputs.
  const isCommitEligible = isReady && !commitBlockedReason;

  function handleCommit() {
    if (!isCommitEligible) return;

    setCommitError(null);
    startTransitionCommit(async () => {
      let res: Awaited<ReturnType<typeof commitClassScheduleImportBatch>>;
      try {
        res = await commitClassScheduleImportBatch({
          batch_id: batch.id,
          confirmation_checked: true,
          confirmation_text: confirmationText.trim(),
          reason: trimmedReason,
        });
      } catch {
        setCommitError(CONNECTION_LOST_MESSAGE);
        router.refresh();
        return;
      }

      if (!res.ok) {
        setCommitError(res.message);
        return;
      }
      setCurrentDetail((previous) => ({
        ...previous,
        batch: res.data,
        classRows: previous.classRows.map((row) => ({ ...row, classification: "committed" })),
        scheduleRows: previous.scheduleRows.map((row) => ({ ...row, classification: "committed" })),
      }));
      // Reloads the batch so the new classes' links appear.
      router.refresh();
    });
  }

  const conditions: GuardedCondition[] = [
    blockingCount > 0
      ? { label: `Còn ${formatNumber(blockingCount)} dòng xung đột hoặc không hợp lệ`, state: "unmet" }
      : { label: "Không còn dòng xung đột hoặc không hợp lệ", state: "met" },
    trimmedReason ? { label: "Đã nhập lý do", state: "met" } : { label: "Chưa nhập lý do", state: "unmet" },
    confirmationChecked ? { label: "Đã đánh dấu xác nhận", state: "met" } : { label: "Chưa đánh dấu xác nhận", state: "unmet" },
    phraseMatches
      ? { label: "Đã gõ đúng cụm xác nhận", state: "met" }
      : { label: "Chưa gõ đúng cụm xác nhận", state: "unmet" },
  ];

  const steps = buildClassImportSteps(4, isCommitted).map((step, index) =>
    index === 4
      ? {
          ...step,
          description: isCommitted
            ? `Đã nhập lúc ${formatImportTimestamp(batch.committed_at)}`
            : isReady
              ? "Kiểm tra lô rồi xác nhận ở mục Xác nhận nhập bên dưới"
              : "Lô này không nhập được",
        }
      : step,
  );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={
          <Link className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })} href={importHref}>
            <span aria-hidden="true">←</span> Về trang nhập lớp & lịch học
          </Link>
        }
        context={<Badge tone={status.tone}>{status.label}</Badge>}
        title="Lô nhập lớp & lịch học"
      >
        <p className="mt-1 text-secondary text-text-muted">
          {batch.source_filename} · {formatNumber(batch.class_row_count)} lớp · {formatNumber(batch.schedule_row_count)} lịch học · năm học{" "}
          {batch.academic_year_code}
        </p>
      </PageHeader>

      <Stepper className={importStepperClassName(steps.length)} label={CLASS_IMPORT_STEPPER_LABEL} steps={steps} />

      {isCommitted ? (
        <ResultBanner
          description={`Ghi lúc ${formatImportTimestamp(batch.committed_at)} (giờ Việt Nam). Lớp mới đã có trong danh sách lớp; chưa có buổi học nào được tạo từ lịch vừa nhập.`}
          title="Đã nhập lớp và lịch học."
          tone="success"
        />
      ) : batch.status === "previewed" ? (
        <ResultBanner
          description={`Còn ${formatNumber(blockingCount)} dòng xung đột hoặc không hợp lệ. Lô đã tạo không sửa được và cùng một file không tạo lại được lô: sửa file Excel rồi tạo lô mới từ file đã sửa.`}
          title="Lô này không nhập được."
          tone="warning"
        />
      ) : batch.status === "rejected" ? (
        <ResultBanner description="Lô không còn được nhập." title="Lô đã bị từ chối." tone="danger" />
      ) : null}

      <section
        aria-labelledby={`${ids}-info`}
        className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-5 py-4 shadow-[var(--panel-shadow)]"
      >
        <h2 className="text-section-title font-semibold text-text-strong" id={`${ids}-info`}>
          Thông tin lô
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoFact label="Tên file">
            <span className="break-all">{batch.source_filename}</span>
          </InfoFact>
          <InfoFact label="Năm học">{batch.academic_year_code}</InfoFact>
          <InfoFact label="SHA-256">
            <span className="font-mono text-secondary font-normal" title={batch.source_sha256}>
              {batch.source_sha256.length > 12 ? `${batch.source_sha256.slice(0, 12)}…` : batch.source_sha256}
            </span>
          </InfoFact>
          <InfoFact label="Tạo lô lúc">
            <span className="tabular-nums">{formatImportTimestamp(batch.created_at)}</span>
          </InfoFact>
          <InfoFact label="Người tạo lô">
            <ActorValue id={batch.created_by} />
          </InfoFact>
          {batch.committed_at ? (
            <>
              <InfoFact label="Nhập lúc">
                <span className="tabular-nums">{formatImportTimestamp(batch.committed_at)}</span>
              </InfoFact>
              <InfoFact label="Người nhập">
                <ActorValue id={batch.committed_by} />
              </InfoFact>
            </>
          ) : null}
          <InfoFact className="sm:col-span-2 xl:col-span-4" label="Lý do tạo lô">
            <span className="font-normal">{batch.reason || "—"}</span>
          </InfoFact>
        </dl>
        <p className="mt-3 text-caption text-text-muted">Giờ Việt Nam. Lô chỉ lưu mã tài khoản của người thao tác.</p>
      </section>

      <SummaryBlock cells={buildSummaryCells(classSummary(batch))} title="Lớp học (sheet Classes)" />
      <SummaryBlock cells={buildSummaryCells(scheduleSummary(batch))} title="Lịch học (sheet Schedules)" />

      {isReady ? (
        <>
          <WillCreateTable
            emptyText="Không có lớp mới: mọi lớp trong file đã có và khớp."
            header={["Mã lớp", "Tên lớp", "Khối · trình độ", "Buổi/tuần", "Hình thức", "Trạng thái khi tạo"]}
            rows={newClassRows.map((row) => ({
              cells: [
                <span className="font-semibold text-text-strong" key="code">
                  {row.class_code}
                </span>,
                row.class_name,
                `Khối ${row.grade} · ${row.level}`,
                row.weekly_session_count,
                formatImportedLearningMode(row.default_learning_mode),
                formatImportedClassStatus(row.status),
              ],
              key: row.id,
            }))}
            title={`Lớp sẽ được tạo (${formatNumber(newClassRows.length)})`}
          />
          <WillCreateTable
            emptyText="Không có lịch học mới: mọi lịch trong file đã có và khớp."
            header={["Mã lớp", "Thành phần", "Thứ", "Giờ học", "Hình thức", "Phòng", "Hiệu lực"]}
            rows={newScheduleRows.map((row) => ({
              cells: [
                <span className="font-semibold text-text-strong" key="code">
                  {row.class_code}
                </span>,
                row.component_code,
                formatIsoWeekday(row.weekday),
                formatTimeRange(row.start_time, row.end_time),
                formatImportedLearningMode(row.learning_mode),
                row.room_name?.trim() || "—",
                formatEffectiveRange(row.effective_from, row.effective_to),
              ],
              key: row.id,
            }))}
            title={`Lịch học sẽ được tạo (${formatNumber(newScheduleRows.length)})`}
          />
          <p className="text-secondary text-text-muted">
            Đã có và khớp, được dùng lại (không tạo trùng): {formatNumber(batch.class_matching_count)} lớp ·{" "}
            {formatNumber(batch.schedule_matching_count)} lịch học.
          </p>

          <GuardedActionPanel
            action={
              <Button
                className="max-md:h-11"
                disabled={!isCommitEligible || isPendingCommit}
                disabledReason={commitBlockedReason}
                isLoading={isPendingCommit}
                onClick={handleCommit}
              >
                {isPendingCommit ? "Đang nhập…" : "Nhập lớp & lịch học"}
              </Button>
            }
            conditions={conditions}
            consequence={
              <>
                Tạo <strong>{formatNumber(batch.class_new_count)} lớp mới</strong> và{" "}
                <strong>{formatNumber(batch.schedule_new_count)} lịch học mới</strong> trong năm học {batch.academic_year_code}. Lớp mới nhận trạng
                thái ghi trong file (mặc định Đang hoạt động); lịch học có hiệu lực từ ngày ghi trong file. <strong>Không tạo buổi học nào.</strong>{" "}
                Cả lô ghi trong một lần: nếu máy chủ từ chối thì không ghi gì. Lớp và lịch đã nhập không gỡ được bằng màn hình này.
              </>
            }
            result={commitError ? <ResultBanner title={commitError} tone="error" /> : undefined}
            title="Xác nhận nhập"
            titleId={`${ids}-commit`}
          >
            <div className="mt-4 grid max-w-[640px] gap-4">
              <Field hint="Ghi vào nhật ký thao tác cùng lần nhập." label="Lý do nhập" required>
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    onChange={(event) => setCommitReason(event.target.value)}
                    placeholder="Ví dụ: Nhập lớp và lịch học đầu năm học"
                    value={commitReason}
                  />
                )}
              </Field>
              <label className="flex min-h-11 items-start gap-2.5 py-2 text-body text-text-strong md:min-h-10" htmlFor={`${ids}-commit-confirm`}>
                <input
                  checked={confirmationChecked}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--action-primary)]"
                  id={`${ids}-commit-confirm`}
                  onChange={(event) => setConfirmationChecked(event.target.checked)}
                  type="checkbox"
                />
                <span>Tôi đã kiểm tra lô và đồng ý tạo các lớp và lịch học mới.</span>
              </label>
              <div className="grid gap-1.5">
                <Label htmlFor={`${ids}-commit-phrase`}>
                  Gõ{" "}
                  <code className="rounded-sm bg-surface-sunken px-1.5 py-px font-mono text-caption font-semibold text-text-strong">
                    {CLASS_IMPORT_COMMIT_PHRASE}
                  </code>{" "}
                  để xác nhận
                </Label>
                <Input
                  aria-describedby={`${ids}-commit-phrase-hint`}
                  autoComplete="off"
                  className="max-w-80 font-mono"
                  id={`${ids}-commit-phrase`}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  spellCheck={false}
                  value={confirmationText}
                />
                <p className="text-caption text-text-muted" id={`${ids}-commit-phrase-hint`}>
                  Gõ đúng từng chữ in hoa và dấu cách.
                </p>
              </div>
            </div>
          </GuardedActionPanel>
        </>
      ) : null}

      <section aria-labelledby={`${ids}-rows`} className="grid min-w-0 gap-3">
        <h2 className="text-section-title font-semibold text-text-strong" id={`${ids}-rows`}>
          Tất cả dòng trong lô
        </h2>
        <ClassScheduleRowsTabs
          captions={{
            classes: `${formatNumber(classRows.length)} dòng lớp học trong lô`,
            schedules: `${formatNumber(scheduleRows.length)} dòng lịch học trong lô`,
          }}
          classHref={classHref}
          classRows={classRows}
          id={`${ids}-row-tabs`}
          scheduleRows={scheduleRows}
        />
      </section>
    </div>
  );
}

function InfoFact({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={className ? `min-w-0 ${className}` : "min-w-0"}>
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-semibold text-text-strong">{children}</dd>
    </div>
  );
}

function SummaryBlock({ cells, title }: { cells: readonly ImportSummaryCell[]; title: string }) {
  return (
    <section className="grid min-w-0 gap-2">
      <h2 className="text-body font-semibold text-text-strong">{title}</h2>
      <ImportSummaryStrip cells={cells} label={`Tổng quan ${title}`} />
    </section>
  );
}

/** "Lớp sẽ được tạo" / "Lịch học sẽ được tạo": the rows the commit inserts, as the batch staged them. */
function WillCreateTable({
  emptyText,
  header,
  rows,
  title,
}: {
  emptyText: string;
  header: readonly string[];
  rows: readonly { cells: readonly ReactNode[]; key: string }[];
  title: string;
}) {
  return (
    <section className="grid min-w-0 gap-2">
      <h2 className="text-body font-semibold text-text-strong">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3 text-body text-text-muted shadow-[var(--panel-shadow)]">
          {emptyText}
        </p>
      ) : (
        <DataTableFrame
          body={rows.map((row) => (
            <TableRow key={row.key}>
              {row.cells.map((cell, index) => (
                <TableCell className="whitespace-nowrap" key={index}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
          caption={title}
          header={
            <tr>
              {header.map((label) => (
                <TableHeaderCell key={label}>{label}</TableHeaderCell>
              ))}
            </tr>
          }
        />
      )}
    </section>
  );
}
