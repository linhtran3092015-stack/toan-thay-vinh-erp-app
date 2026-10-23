"use client";

/**
 * Draft period readiness (design 15, frame 15a): what the lock would bill per
 * student, which blockers remain, and the bulk rate/source fixes. Kept from the
 * design: KPI strip, chips, one selection driving both bulk fixes, the student
 * table with class, sessions, opening balance, rates, payable and blocker
 * badges. Not adopted: the amber banner and a second lock button (the lock
 * panel above owns both), "buổi đã khóa" (the preview counts every
 * non-cancelled session) and the KT-xxxx code (none exists). Figures come from
 * `buildReadinessStudents`, which mirrors the lock formula; a negative opening
 * balance is shown as an upper bound because the lock subtracts debt already
 * billed on other periods' pending notices, which the preview does not return.
 */

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type FormEvent } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow, TableState } from "@/components/patterns/data-table-frame";
import { FilterInput } from "@/components/patterns/filter-bar";
import { QuickFilterChips, type QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { formatIsoDate } from "@/lib/datetime";
import { formatNumber, formatVnd } from "@/lib/format";
import { compareStudentNames, sortByStudentName } from "@/lib/student-order";
import { cn } from "@/lib/utils";

import { setTuitionPeriodRatesAction, setTuitionPeriodSourcesAction, type TuitionActionResult } from "./actions";
import type { TuitionLeadSourceItem, TuitionStudentDetail } from "./data";
import { knownStudentIssues, MISSING_GUARDIAN_ISSUE, MISSING_RATE_ISSUE, MISSING_SOURCE_ISSUE, tuitionBlockerLabels } from "./readiness";
import {
  summarizeReadinessStudents,
  type TuitionLockFigures,
  type TuitionReadinessContext,
  type TuitionReadinessTotals,
} from "./readiness-students";
import { downloadTuitionRateExcel, downloadTuitionSourceExcel } from "./tuition-template-browser";

/**
 * One student of the preview. The lock figures are optional so a bare
 * `summarizeTuitionPreview` result still renders (without the KPI strip and
 * with "—" for balance, rates and payable); the period page and /dev pass
 * `buildReadinessStudents` output.
 */
export interface StudentReadiness extends Partial<TuitionLockFigures> {
  studentId: string;
  sessions: number;
  missingRateFrom: string | null;
  issues: string[];
}

export interface TuitionReadinessTableProps {
  canManageRates: boolean;
  canManageSources?: boolean;
  periodId: string;
  students: StudentReadiness[];
  labels: Record<string, string>;
  studentDetails?: Record<string, TuitionStudentDetail>;
  leadSources?: TuitionLeadSourceItem[];
  /** Defaults to the real server actions; the /dev preview passes inert stubs. */
  setRatesAction?: typeof setTuitionPeriodRatesAction;
  setSourcesAction?: typeof setTuitionPeriodSourcesAction;
  /** Enrollment class names by id; missing names read "—" (classes.view is owner-only by default). */
  classNames?: Record<string, string>;
  /** The preview read failed: the table frame says so instead of showing an empty period. */
  previewUnavailable?: boolean;
  /** Names the table: "Học sinh trong kỳ thu {periodName}". */
  periodName?: string;
  /** What the lock would use if it ran now; unknown parts are left out of the caption. */
  lockContext?: Pick<TuitionReadinessContext, "renewalAccount" | "templateVersion">;
}

type ReadinessFilter = "blocked" | "missing_rate" | "missing_source" | "missing_guardian" | "ready" | "no_payment" | "all";

const checkboxClassName =
  "h-4 w-4 cursor-pointer rounded border-border-strong accent-[var(--action-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
const focusTargetClassName = "rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
// Bulk-fix submit: full width on phones, its own row at md (start-aligned), the grid's third column from lg.
const submitClassName = "max-md:h-11 md:col-span-2 md:justify-self-start lg:col-span-1 lg:justify-self-auto";
// Badges wrap inside the narrow Blocker column; the important flag beats Badge's own whitespace-nowrap
// (cn does not merge classes, and Tailwind emits .whitespace-normal before .whitespace-nowrap).
// overflow-wrap:anywhere lets a raw blocker code (one long word) break instead of widening the column.
const badgeWrapClassName = "whitespace-normal! text-left [overflow-wrap:anywhere]";

const isMissingRate = (student: StudentReadiness) => student.missingRateFrom !== null;
const isMissingSource = (student: StudentReadiness) => student.issues.includes(MISSING_SOURCE_ISSUE);

function matchesFilter(student: StudentReadiness, filter: ReadinessFilter): boolean {
  if (filter === "blocked") return student.issues.length > 0;
  if (filter === "missing_rate") return isMissingRate(student);
  if (filter === "missing_source") return isMissingSource(student);
  if (filter === "missing_guardian") return student.issues.includes(MISSING_GUARDIAN_ISSUE);
  if (filter === "ready") return student.issues.length === 0;
  if (filter === "no_payment") return student.noPayment === true;
  return true;
}

const labelFor = (labels: Record<string, string>, student: StudentReadiness) => labels[student.studentId] ?? `Học sinh ${student.studentId}`;
const NO_STUDENT_DETAILS: Record<string, TuitionStudentDetail> = {};
// Labels read "Name (code)", so the roll order needs the bare name to find the given name.
const nameFor = (details: Record<string, TuitionStudentDetail>, labels: Record<string, string>, student: StudentReadiness) =>
  details[student.studentId]?.fullName ?? labelFor(labels, student);

/** `2026-11-02` → `02/11`. */
const formatDayMonth = (value: string) => formatIsoDate(value).slice(0, 5);

/**
 * Focuses the first candidate that is still rendered. Layouts hide some
 * controls with CSS and focus() on a hidden node does nothing, so it moves on
 * until one takes focus (covers browsers without checkVisibility).
 */
function focusFirst(candidates: ReadonlyArray<HTMLElement | null | undefined>) {
  for (const element of candidates) {
    if (!element || !element.isConnected || !(element.checkVisibility?.() ?? true)) continue;
    element.focus();
    if (document.activeElement === element) return;
  }
}

export function TuitionReadinessTable({
  canManageRates,
  canManageSources = false,
  periodId,
  students,
  labels,
  studentDetails = NO_STUDENT_DETAILS,
  leadSources = [],
  setRatesAction = setTuitionPeriodRatesAction,
  setSourcesAction = setTuitionPeriodSourcesAction,
  classNames = {},
  previewUnavailable = false,
  periodName,
  lockContext,
}: TuitionReadinessTableProps) {
  const headingId = useId();
  const searchId = useId();
  const rateTitleId = useId();
  const priceId = useId();
  const rateReasonId = useId();
  const sourceTitleId = useId();
  const sourceSelectId = useId();
  const sourceReasonId = useId();
  const selectionSummaryId = useId();
  const selectionSummaryRef = useRef<HTMLParagraphElement>(null);
  const selectAllRatesRef = useRef<HTMLButtonElement>(null);
  const selectAllSourcesRef = useRef<HTMLButtonElement>(null);
  const searchFieldRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const studentsMissingRate = students.filter(isMissingRate);
  const studentsMissingSource = students.filter(isMissingSource);
  const totals = summarizeReadinessStudents(students);
  const [filter, setFilter] = useState<ReadinessFilter>(() =>
    studentsMissingRate.length > 0 ? "missing_rate" : totals.blocked > 0 ? "blocked" : "all",
  );
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"rates" | "sources" | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // A settled save moves focus to its result: the submit button was disabled while it ran.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const labelOf = (student: StudentReadiness) => labelFor(labels, student);

  const count = (value: ReadinessFilter) => students.filter((student) => matchesFilter(student, value)).length;
  const chipCounts: Record<ReadinessFilter, number> = {
    all: students.length,
    blocked: totals.blocked,
    missing_guardian: count("missing_guardian"),
    missing_rate: studentsMissingRate.length,
    missing_source: studentsMissingSource.length,
    no_payment: totals.noPayment,
    ready: totals.ready,
  };
  // A refresh can empty the active chip (e.g. a bulk save fixed its last student). An empty chip is
  // disabled, so the list falls back to the remaining blockers, or to everyone once none is left.
  const fallbackFilter: ReadinessFilter = totals.blocked > 0 ? "blocked" : "all";
  if (students.length > 0 && chipCounts[filter] === 0 && filter !== fallbackFilter) setFilter(fallbackFilter);

  // Both rows live in one panel driven by one selection; a source fix also needs an active source to pick.
  const showRateRow = canManageRates && studentsMissingRate.length > 0;
  const showSourceRow = canManageSources && studentsMissingSource.length > 0 && leadSources.length > 0;
  const isEligible = (student: StudentReadiness) =>
    (showRateRow && isMissingRate(student)) || (showSourceRow && isMissingSource(student));
  // Selection is pruned against the current props: a student fixed elsewhere drops out by itself.
  // It stays editable while a save runs; each save sends the ids it captured on submit.
  const eligibleIds = new Set(students.filter(isEligible).map((student) => student.studentId));
  const selected = new Set(selectedIds.filter((id) => eligibleIds.has(id)));
  const selectedRateIds = studentsMissingRate.filter((student) => selected.has(student.studentId)).map((student) => student.studentId);
  const selectedSourceIds = studentsMissingSource.filter((student) => selected.has(student.studentId)).map((student) => student.studentId);
  const earliestRateDate = studentsMissingRate
    .filter((student) => selected.has(student.studentId))
    .map((student) => student.missingRateFrom as string)
    .sort()[0];

  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  // Lowercased once per students/labels change, not on every keystroke.
  const searchLabels = useMemo(
    () => new Map(students.map((student) => [student.studentId, labelFor(labels, student).toLocaleLowerCase("vi")])),
    [labels, students],
  );
  const visible = useMemo(
    () =>
      students
        .filter((student) => matchesFilter(student, filter) && (searchLabels.get(student.studentId) ?? "").includes(normalizedQuery))
        .sort(
          (a, b) =>
            Number(b.issues.length > 0) - Number(a.issues.length > 0) ||
            compareStudentNames(nameFor(studentDetails, labels, a), nameFor(studentDetails, labels, b)),
        ),
    [filter, labels, normalizedQuery, searchLabels, studentDetails, students],
  );
  const visibleEligible = visible.filter(isEligible).map((student) => student.studentId);
  const visibleSelectedCount = visibleEligible.filter((id) => selected.has(id)).length;
  const allVisibleSelected = visibleEligible.length > 0 && visibleSelectedCount === visibleEligible.length;

  const chips: QuickFilterChip<ReadinessFilter>[] = [
    { count: chipCounts.blocked, label: "Còn blocker", value: "blocked" },
    { count: chipCounts.missing_rate, label: "Thiếu đơn giá", value: "missing_rate" },
    { count: chipCounts.missing_source, label: "Thiếu nguồn", value: "missing_source" },
    { count: chipCounts.missing_guardian, label: "Thiếu phụ huynh chính", value: "missing_guardian" },
    { count: chipCounts.ready, label: "Đủ dữ liệu", separatorBefore: true, value: "ready" },
    { count: chipCounts.no_payment, label: "Không cần thanh toán", value: "no_payment" },
    { count: chipCounts.all, label: "Tất cả", separatorBefore: true, value: "all" },
  ];

  const hasStudents = !previewUnavailable && students.length > 0;
  const status = previewUnavailable ? "error" : visible.length === 0 ? "empty" : "ready";
  const caption = periodName ? `Học sinh trong kỳ thu ${periodName}` : "Học sinh trong kỳ thu";
  const contextParts = [
    lockContext?.templateVersion != null ? `phiếu dùng mẫu v${lockContext.templateVersion}` : null,
    lockContext?.renewalAccount ? `tài khoản tái phí ${lockContext.renewalAccount.bankCode} ${lockContext.renewalAccount.accountNumber}` : null,
  ].filter(Boolean);

  const toggle = (studentId: string, checked: boolean) =>
    setSelectedIds((previous) => (checked ? [...new Set([...previous, studentId])] : previous.filter((id) => id !== studentId)));
  const toggleAllVisible = () => {
    const ids = new Set(visibleEligible);
    setSelectedIds((previous) => (allVisibleSelected ? previous.filter((id) => !ids.has(id)) : [...new Set([...previous, ...visibleEligible])]));
  };
  const selectAll = (group: StudentReadiness[]) =>
    setSelectedIds((previous) => [...new Set([...previous, ...group.map((student) => student.studentId)])]);
  // "Bỏ chọn" unmounts itself: focus moves first to the selection summary, which stays, so keyboard users keep their place.
  const clearSelection = () => {
    focusFirst([selectionSummaryRef.current, selectAllRatesRef.current, selectAllSourcesRef.current]);
    setSelectedIds([]);
  };
  // "Xóa lọc" leaves with the empty state; the search box stays.
  const clearFilters = () => {
    focusFirst([searchFieldRef.current?.querySelector("input")]);
    setFilter("all");
    setQuery("");
  };

  /**
   * One bulk fix. The state updates after the await are marked as part of the
   * transition again (React 19 does not carry it across an await), so the
   * result lands in the same commit as the buttons leaving "Đang lưu...".
   * A success drops the saved ids from the selection, except those in
   * `stillNeeded` (the other fix still applies to them): a student missing
   * both a rate and a source stays selected for the second save.
   */
  function runSave(
    kind: "rates" | "sources",
    form: HTMLFormElement,
    studentIds: string[],
    stillNeeded: ReadonlySet<string>,
    save: () => Promise<TuitionActionResult>,
    networkError: string,
  ) {
    setResult(null);
    setPendingAction(kind);
    startTransition(async () => {
      const outcome = await save().then(
        (next) => next,
        () => null,
      );
      startTransition(() => {
        if (!outcome) {
          setResult({ message: networkError, tone: "error" });
          return;
        }
        setResult({ message: outcome.message, tone: outcome.status === "success" ? "success" : "error" });
        if (outcome.status === "success") {
          const saved = new Set(studentIds);
          setSelectedIds((previous) => previous.filter((id) => !saved.has(id) || stillNeeded.has(id)));
          form.reset();
        }
      });
    });
  }

  function submitRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    // Only the selected students still missing a rate: the RPC refuses a stale selection.
    const studentIds = selectedRateIds;
    if (studentIds.length === 0) return;
    // Selected students also missing a source stay selected while the source fix is offered.
    const stillNeedSource = new Set(showSourceRow ? selectedSourceIds : []);
    runSave(
      "rates",
      form,
      studentIds,
      stillNeedSource,
      () =>
        setRatesAction({
          periodId,
          reason: String(data.get("reason") ?? "").trim(),
          studentIds,
          unitPriceVnd: Number(data.get("unitPrice")),
        }),
      "Không thể kết nối. Chưa xác nhận lưu đơn giá; vui lòng tải lại để kiểm tra.",
    );
  }

  function submitSources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    // Only the selected students still missing a source.
    const studentIds = selectedSourceIds;
    if (studentIds.length === 0) return;
    // Selected students also missing a rate stay selected while the rate fix is offered.
    const stillNeedRate = new Set(showRateRow ? selectedRateIds : []);
    runSave(
      "sources",
      form,
      studentIds,
      stillNeedRate,
      () =>
        setSourcesAction({
          leadSourceId: String(data.get("leadSourceId") ?? ""),
          periodId,
          reason: String(data.get("reason") ?? "").trim(),
          studentIds,
        }),
      "Lỗi kết nối khi cập nhật nguồn học viên.",
    );
  }

  // Excel helpers keep their file layouts (tuition-template-browser owns the columns).
  const download = async (key: string, run: () => Promise<void>) => {
    setDownloading(key);
    try {
      await run();
    } finally {
      setDownloading(null);
    }
  };
  const downloadMissingRates = () =>
    download("rate_missing", () =>
      downloadTuitionRateExcel(
        sortByStudentName(
          studentsMissingRate.map((student) => {
            const detail = studentDetails[student.studentId];
            return {
              effectiveFrom: student.missingRateFrom ?? "",
              fullName: detail?.fullName ?? labels[student.studentId] ?? "Học viên",
              publicCode: detail?.publicCode ?? student.studentId,
              reason: "Học phí khóa hiện tại",
            };
          }),
          (row) => row.fullName,
        ),
      ),
    );
  const downloadSourceTemplate = () =>
    download("source_blank", () => {
      const rows = sortByStudentName(
        studentsMissingSource.map((student) => {
          const detail = studentDetails[student.studentId];
          return {
            fullName: detail?.fullName ?? labels[student.studentId] ?? "Học viên",
            publicCode: detail?.publicCode ?? student.studentId,
            reason: "Khởi tạo dữ liệu ban đầu",
          };
        }),
        (row) => row.fullName,
      );
      return downloadTuitionSourceExcel(leadSources, rows.length > 0 ? rows : undefined);
    });

  /** Known class names, "" when none is readable: the table cell shows "—", the card leaves the part out. */
  const classLabel = (student: StudentReadiness) =>
    (student.classIds ?? []).map((id) => classNames[id]).filter(Boolean).join(" · ");
  const profileLink = (student: StudentReadiness) => {
    // A missing guardian is fixed on the student's edit form; everything else starts from the profile.
    const guardianOnly = student.issues.length > 0 && student.issues.every((code) => code === MISSING_GUARDIAN_ISSUE);
    return guardianOnly
      ? { href: `/students/${student.studentId}/edit`, text: "Sửa hồ sơ", verb: "Sửa hồ sơ" }
      : { href: `/students/${student.studentId}`, text: "Hồ sơ", verb: "Mở hồ sơ" };
  };

  const emptyState = students.length === 0 ? (
    <TableState>Chưa có học sinh nào có buổi học trong kỳ thu.</TableState>
  ) : (
    <TableState>
      <p>Không tìm thấy học viên phù hợp với bộ lọc hiện tại.</p>
      <Button className="max-md:h-11" onClick={clearFilters} size="sm" variant="secondary">Xóa lọc</Button>
    </TableState>
  );
  const errorState = <TableState>Chưa tải được xem trước kỳ thu. Bấm “Tải lại xem trước” để thử lại.</TableState>;

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <h2 className="sr-only" id={headingId}>Kiểm tra dữ liệu từng học sinh</h2>

      {contextParts.length > 0 ? (
        <p className="text-secondary tabular-nums text-text-muted">Khi khóa: {contextParts.join(" · ")}</p>
      ) : null}

      {hasStudents && totals.hasFigures ? (
        <div className="grid gap-1.5">
          <ReadinessKpiStrip totals={totals} />
          <p className="text-caption text-text-muted">Ước tính lúc tải trang; khóa kỳ tính lại.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {hasStudents ? (
          <QuickFilterChips
            chips={chips}
            className="max-md:[&>button]:h-11"
            label="Lọc học sinh theo dữ liệu kỳ thu"
            onChange={setFilter}
            value={filter}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-3 md:ml-auto">
          {hasStudents ? (
            <div className="flex min-w-0 items-center gap-2 max-md:w-full" ref={searchFieldRef}>
              <label className="shrink-0 text-label font-medium text-text-muted" htmlFor={searchId}>Tìm học sinh</label>
              <FilterInput
                active={normalizedQuery !== ""}
                className="h-11 md:h-10 md:w-60"
                id={searchId}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tên hoặc mã học viên..."
                type="search"
                value={query}
              />
            </div>
          ) : null}
          <div aria-label="File Excel" className="flex flex-wrap items-center gap-2" role="group">
            <span aria-hidden="true" className="text-caption font-medium text-text-muted">File Excel</span>
            <Button
              className="max-md:h-11"
              disabled={downloading !== null}
              onClick={() => download("rate_blank", () => downloadTuitionRateExcel())}
              size="sm"
              variant="secondary"
            >
              {downloading === "rate_blank" ? "Đang tạo..." : "File mẫu đơn giá (.xlsx)"}
            </Button>
            {studentsMissingRate.length > 0 ? (
              <Button className="max-md:h-11" disabled={downloading !== null} onClick={downloadMissingRates} size="sm" variant="secondary">
                {downloading === "rate_missing" ? "Đang xuất..." : `Xuất ${studentsMissingRate.length} học viên thiếu giá (.xlsx)`}
              </Button>
            ) : null}
            <Button className="max-md:h-11" disabled={downloading !== null} onClick={downloadSourceTemplate} size="sm" variant="secondary">
              {downloading === "source_blank" ? "Đang tạo..." : "File mẫu nguồn (.xlsx)"}
            </Button>
          </div>
        </div>
      </div>

      {showRateRow || showSourceRow ? (
        <div className="grid gap-3 rounded-lg border border-action-primary-soft-border bg-action-primary-soft p-3 md:px-4">
          {/* Fixed height: "Bỏ chọn" mounting on the first tick must not push the table down. */}
          <div className="flex min-h-8 flex-wrap items-center gap-2 max-md:min-h-11">
            {/* Also the reason the save buttons and the header checkbox are disabled (aria-describedby). */}
            <p
              aria-live="polite"
              className={cn("text-body font-semibold text-action-link", focusTargetClassName)}
              id={selectionSummaryId}
              ref={selectionSummaryRef}
              tabIndex={-1}
            >
              {selected.size > 0 ? (
                <>
                  Đã chọn {selected.size} học sinh
                  <span className="font-medium">
                    {showRateRow ? ` · ${selectedRateIds.length} thiếu đơn giá` : ""}
                    {showSourceRow ? ` · ${selectedSourceIds.length} thiếu nguồn` : ""}
                  </span>
                </>
              ) : (
                "Chưa chọn học sinh nào"
              )}
            </p>
            {selected.size > 0 ? (
              <Button className="ml-auto max-md:h-11" onClick={clearSelection} size="sm" variant="ghost">
                Bỏ chọn
              </Button>
            ) : null}
          </div>

          {showRateRow ? (
            <form aria-labelledby={rateTitleId} className="grid gap-3 border-t border-action-primary-soft-border pt-3" onSubmit={submitRates}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-body font-semibold text-text-strong" id={rateTitleId}>Bổ sung đơn giá</h3>
                <Button className="max-md:h-11" onClick={() => selectAll(studentsMissingRate)} ref={selectAllRatesRef} size="sm" variant="ghost">
                  Chọn tất cả {studentsMissingRate.length} học viên thiếu giá
                </Button>
              </div>
              {/* Fields side by side from md, the submit beside them from lg (at md it takes its own row). */}
              <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-end lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto]">
                <div className="grid gap-1.5">
                  <Label htmlFor={priceId} required>Học phí mỗi buổi (VND)</Label>
                  <div className="flex items-center gap-2">
                    <Input className="text-right tabular-nums" disabled={isPending} id={priceId} inputMode="numeric" min="1" name="unitPrice" required step="1" type="number" />
                    <span aria-hidden="true" className="shrink-0 text-secondary text-text-default">₫/buổi</span>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={rateReasonId} required>Căn cứ áp dụng</Label>
                  <Input disabled={isPending} id={rateReasonId} maxLength={1000} minLength={3} name="reason" placeholder="Ví dụ: Học phí khóa tháng 8-11" required />
                </div>
                <Button
                  aria-describedby={selectionSummaryId}
                  className={submitClassName}
                  disabled={isPending || selectedRateIds.length === 0}
                  isLoading={isPending && pendingAction === "rates"}
                  type="submit"
                  variant="secondary"
                >
                  {isPending && pendingAction === "rates" ? "Đang lưu..." : `Lưu đơn giá cho ${selectedRateIds.length} học viên`}
                </Button>
              </div>
              {/* text-default: muted ink is under 4.5:1 on the soft-primary panel. */}
              <p className="text-caption text-text-default">
                Áp dụng từ ngày học đầu tiên còn thiếu giá của từng học sinh
                {earliestRateDate ? ` (sớm nhất ${formatIsoDate(earliestRateDate)})` : ""}. Đơn giá đã có và phiếu đã phát hành giữ nguyên.
              </p>
            </form>
          ) : null}

          {showSourceRow ? (
            <form aria-labelledby={sourceTitleId} className="grid gap-3 border-t border-action-primary-soft-border pt-3" onSubmit={submitSources}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-body font-semibold text-text-strong" id={sourceTitleId}>Bổ sung nguồn học viên</h3>
                <Button className="max-md:h-11" onClick={() => selectAll(studentsMissingSource)} ref={selectAllSourcesRef} size="sm" variant="ghost">
                  Chọn tất cả {studentsMissingSource.length} học viên thiếu nguồn
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 md:items-end lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="grid gap-1.5">
                  <Label htmlFor={sourceSelectId} required>Nguồn tuyển sinh</Label>
                  <Select defaultValue="" disabled={isPending} id={sourceSelectId} name="leadSourceId" required>
                    <option disabled value="">Chọn nguồn đang hoạt động</option>
                    {leadSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name} ({source.code})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={sourceReasonId} required>Lý do gán</Label>
                  <Input defaultValue="Khởi tạo dữ liệu ban đầu kỳ thu" disabled={isPending} id={sourceReasonId} maxLength={1000} minLength={3} name="reason" required />
                </div>
                <Button
                  aria-describedby={selectionSummaryId}
                  className={submitClassName}
                  disabled={isPending || selectedSourceIds.length === 0}
                  isLoading={isPending && pendingAction === "sources"}
                  type="submit"
                  variant="secondary"
                >
                  {isPending && pendingAction === "sources" ? "Đang lưu..." : `Lưu nguồn cho ${selectedSourceIds.length} học viên`}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {/* The wrapper takes focus after a save; ResultBanner keeps its roles (error → alert, success → status). */}
      {result ? (
        <div className={focusTargetClassName} ref={resultRef} tabIndex={-1}>
          <ResultBanner title={result.message} tone={result.tone} />
        </div>
      ) : null}

      <div className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
        <div className="hidden @min-[960px]:block">
          <DataTableFrame
            body={visible.map((student) => {
              const label = labelOf(student);
              const eligible = eligibleIds.has(student.studentId);
              const isSelected = eligible && selected.has(student.studentId);
              const link = profileLink(student);
              return (
                <TableRow key={student.studentId} selected={isSelected}>
                  {eligibleIds.size > 0 ? (
                    <TableCell className="w-12">
                      {eligible ? (
                        <input
                          aria-label={`Chọn ${label}`}
                          checked={isSelected}
                          className={checkboxClassName}
                          onChange={(event) => toggle(student.studentId, event.target.checked)}
                          type="checkbox"
                        />
                      ) : null}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <span className="font-semibold text-text-strong">{label}</span>
                  </TableCell>
                  <TableCell className="text-secondary">{classLabel(student) || "—"}</TableCell>
                  <TableCell numeric>{formatNumber(student.sessions)}</TableCell>
                  <TableCell numeric><BalanceValue student={student} /></TableCell>
                  <TableCell numeric><RateValue student={student} /></TableCell>
                  <TableCell numeric><PayableValue layout="table" student={student} /></TableCell>
                  <TableCell className="py-2">
                    <BlockerBadges student={student} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      aria-label={`${link.verb} ${label} (tab mới)`}
                      // May wrap: "Sửa hồ sơ" plus the icon is wider than the 96px column (68px inside its padding).
                      className="inline-flex items-center gap-1 text-secondary font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                      href={link.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {link.text}
                      {/* Visual new-tab cue; the aria-label already says "(tab mới)". */}
                      <ExternalLink aria-hidden="true" className="shrink-0" size={14} strokeWidth={1.8} />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            caption={caption}
            empty={emptyState}
            error={errorState}
            footer={
              status === "ready" ? (
                <span className="tabular-nums">
                  {visible.length} trong {students.length} học sinh · sắp xếp blocker trước
                </span>
              ) : undefined
            }
            header={
              <tr>
                {eligibleIds.size > 0 ? (
                  <TableHeaderCell className="w-12">
                    <input
                      aria-describedby={selectionSummaryId}
                      aria-label="Chọn tất cả học sinh đang hiển thị có thể bổ sung"
                      checked={allVisibleSelected}
                      className={checkboxClassName}
                      disabled={visibleEligible.length === 0}
                      onChange={toggleAllVisible}
                      ref={(node) => {
                        if (node) node.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected;
                      }}
                      type="checkbox"
                    />
                  </TableHeaderCell>
                ) : null}
                {/*
                  Declared widths, checkbox column included: 48 + 150 + 112 + 72 + 80 + 112 + 112 + 176 + 96 = 958px,
                  the frame's inner width at the 960px container switch (1px border each side), which is also the
                  table's min width. They hold because the content wraps: these two headers, the rate list at " / ",
                  the blocker badges and the profile link. Học sinh and Lớp are minimums and take any extra width.
                */}
                <TableHeaderCell className="min-w-[150px]">Học sinh</TableHeaderCell>
                <TableHeaderCell className="min-w-[112px]">Lớp</TableHeaderCell>
                <TableHeaderCell className="w-[72px] whitespace-normal!" numeric>Buổi kỳ này</TableHeaderCell>
                <TableHeaderCell className="w-[80px] whitespace-normal!" numeric>Số dư đầu kỳ</TableHeaderCell>
                <TableHeaderCell className="w-[112px]" numeric>Đơn giá</TableHeaderCell>
                <TableHeaderCell className="w-[112px]" numeric>Phải thu</TableHeaderCell>
                <TableHeaderCell className="w-[176px]">Blocker</TableHeaderCell>
                {/* relative: keeps the sr-only label inside the scrolling frame (an absolute span would widen the page). */}
                <TableHeaderCell className="relative w-[96px]"><span className="sr-only">Hồ sơ học sinh</span></TableHeaderCell>
              </tr>
            }
            status={status}
            tableClassName="min-w-[958px]"
          />
        </div>

        <div className="grid @min-[960px]:hidden">
          {status === "ready" ? (
            <ResponsiveRecordList label={caption}>
              {visible.map((student) => {
                const label = labelOf(student);
                const detail = studentDetails[student.studentId];
                const eligible = eligibleIds.has(student.studentId);
                const link = profileLink(student);
                const balance = student.openingBalanceSessions;
                return (
                  <RecordListItem
                    ariaLabel={`${link.verb} ${label}`}
                    href={link.href}
                    key={student.studentId}
                    leading={
                      // Same eligibility as the table; the 44px label is the touch target.
                      // The gutter only appears when the list has something to select.
                      visibleEligible.length > 0 ? (
                        <span className="flex w-11 shrink-0 items-center justify-center">
                          {eligible ? (
                            <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                              <input
                                aria-label={`Chọn ${label}`}
                                checked={selected.has(student.studentId)}
                                className={checkboxClassName}
                                onChange={(event) => toggle(student.studentId, event.target.checked)}
                                type="checkbox"
                              />
                            </label>
                          ) : null}
                        </span>
                      ) : undefined
                    }
                    meta={
                      <>
                        <span className="block">
                          {/* Unknown class names drop out here instead of leading with "—". */}
                          {[
                            classLabel(student),
                            `${formatNumber(student.sessions)} buổi`,
                            balance === undefined ? null : `số dư ${formatBalance(balance)}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="mt-1.5 block">
                          <BlockerBadges student={student} />
                        </span>
                      </>
                    }
                    metrics={
                      <>
                        <span>
                          Đơn giá <strong className="font-semibold text-text-strong"><RateValue student={student} /></strong>
                        </span>
                        <span>
                          Phải thu <strong className="font-semibold text-text-strong"><PayableValue layout="inline" student={student} /></strong>
                        </span>
                      </>
                    }
                    // The table shows the label as one text; the card splits name and code
                    // (the label stays in the link's name).
                    title={
                      detail ? (
                        <>
                          {detail.fullName} <span className="font-normal text-text-muted">{detail.publicCode}</span>
                        </>
                      ) : (
                        label
                      )
                    }
                  />
                );
              })}
            </ResponsiveRecordList>
          ) : (
            <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
              {status === "error" ? errorState : emptyState}
            </div>
          )}
        </div>
      </div>

      {hasStudents && (studentsMissingRate.length > 0 || studentsMissingSource.length > 0) ? (
        <p className="text-secondary text-text-muted">Thiếu phụ huynh chính chỉ hiện sau khi học sinh đã có đơn giá và nguồn.</p>
      ) : null}
    </section>
  );
}

function ReadinessKpiStrip({ totals }: { totals: TuitionReadinessTotals }) {
  // The note counts students whose payable is unknown, which can be fewer than the "Thiếu đơn giá" chip:
  // a missing rate inside the sessions the opening balance offsets does not block the amount.
  const payable =
    totals.unknown > 0
      ? { note: `${formatNumber(totals.unknown)} học sinh chưa tính được (thiếu đơn giá)`, tone: "muted" as const, value: "Chưa đủ dữ liệu" }
      : {
          note:
            totals.upperBound > 0
              ? `${formatNumber(totals.upperBound)} học sinh nợ buổi đầu kỳ tính tối đa`
              : `${formatNumber(totals.requestsAtLock)} yêu cầu thanh toán khi khóa`,
          tone: undefined,
          value: formatVnd(totals.payableVnd),
        };

  return (
    <dl
      aria-label="Chuẩn bị thu"
      className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] sm:grid-cols-2 xl:grid-cols-4"
    >
      <Kpi label="Dự kiến phải thu" note={payable.note} tone={payable.tone} value={payable.value} />
      <Kpi label="Không cần thanh toán (đủ số dư)" value={`${formatNumber(totals.noPayment)} học sinh`} />
      <Kpi label="Đủ dữ liệu" tone="success" value={`${formatNumber(totals.ready)} / ${formatNumber(totals.total)}`} />
      <Kpi label="Còn blocker" tone={totals.blocked > 0 ? "warning" : undefined} value={formatNumber(totals.blocked)} />
    </dl>
  );
}

function Kpi({ label, note, tone, value }: { label: string; note?: string; tone?: "success" | "warning" | "muted"; value: string }) {
  return (
    <div className="border-border-row px-4 py-3 [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(odd)]:border-r xl:[&:not(:first-child)]:border-t-0 xl:[&:not(:last-child)]:border-r">
      <dt className="text-label text-text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-1 break-words text-numeric font-semibold tabular-nums",
          tone === "success" ? "text-success-ink" : tone === "warning" ? "text-warning-ink" : tone === "muted" ? "text-text-muted" : "text-text-strong",
        )}
      >
        {value}
      </dd>
      {note ? <dd className="text-caption text-text-muted">{note}</dd> : null}
    </div>
  );
}

/** Negative balance = sessions owed, written with a real minus sign. */
function formatBalance(balance: number): string {
  return balance < 0 ? `−${formatNumber(-balance)}` : formatNumber(balance);
}

/** Muted ink on a selected row (soft primary) is under 4.5:1, so the row switches it to the default ink. */
const valueMutedClassName = "text-text-muted group-data-[selected=true]/row:text-text-default";

function BalanceValue({ student }: { student: StudentReadiness }) {
  const balance = student.openingBalanceSessions;
  if (balance === undefined) return <span className={valueMutedClassName}>—</span>;
  return <span className={cn("tabular-nums", balance < 0 && "font-semibold text-danger")}>{formatBalance(balance)}</span>;
}

/** Distinct rates in session order: "200.000 / 250.000 ₫", one text node; a narrow cell wraps it at the spaces around "/". */
function RateValue({ student }: { student: StudentReadiness }) {
  const rates = student.rates ?? [];
  if (rates.length === 0) return <span className={valueMutedClassName}>—</span>;
  const last = rates[rates.length - 1];
  return (
    <span className="tabular-nums">
      {[...rates.slice(0, -1).map(formatNumber), formatVnd(last)].join(" / ")}
    </span>
  );
}

function PayableValue({ layout, student }: { layout: "table" | "inline"; student: StudentReadiness }) {
  const payable = student.payable;
  if (!payable || payable.kind === "unknown") {
    return (
      <span className={cn("font-normal", valueMutedClassName)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Chưa đủ dữ liệu</span>
      </span>
    );
  }
  if (student.noPayment) return <span className={cn("font-normal tabular-nums", valueMutedClassName)}>{formatVnd(0)}</span>;
  return (
    <>
      <span className="tabular-nums text-text-strong">{formatVnd(payable.amountVnd)}</span>
      {payable.kind === "upper_bound" ? (
        layout === "table" ? (
          <span className={cn("block text-caption font-normal", valueMutedClassName)}>tối đa</span>
        ) : (
          <span className={cn("font-normal", valueMutedClassName)}> tối đa</span>
        )
      ) : null}
    </>
  );
}

/**
 * Always text; the guardian blocker is the one the bulk fixes cannot clear.
 * "Đủ dữ liệu" follows the issues themselves, so a code without its own badge
 * never reads as ready.
 */
function BlockerBadges({ student }: { student: StudentReadiness }) {
  if (student.issues.length === 0) {
    return student.noPayment ? (
      <Badge className={badgeWrapClassName} tone="neutral">Không cần thanh toán · đủ số dư</Badge>
    ) : (
      <Badge className={badgeWrapClassName} tone="success">Đủ dữ liệu</Badge>
    );
  }
  const rateFrom = student.missingRateFrom;
  return (
    <span className="flex flex-wrap gap-1">
      {rateFrom || student.issues.includes(MISSING_RATE_ISSUE) ? (
        <Badge className={badgeWrapClassName} tone="warning">{rateFrom ? `Thiếu đơn giá từ ${formatDayMonth(rateFrom)}` : "Thiếu đơn giá"}</Badge>
      ) : null}
      {isMissingSource(student) ? <Badge className={badgeWrapClassName} tone="warning">Thiếu nguồn</Badge> : null}
      {student.issues.includes(MISSING_GUARDIAN_ISSUE) ? <Badge className={badgeWrapClassName} tone="danger">Chưa có phụ huynh chính</Badge> : null}
      {student.issues
        .filter((code) => !knownStudentIssues.has(code))
        .map((code) => (
          <Badge className={badgeWrapClassName} key={code} tone="neutral">
            {tuitionBlockerLabels[code] ?? code}
          </Badge>
        ))}
    </span>
  );
}
