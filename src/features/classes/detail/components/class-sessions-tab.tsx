"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";

import { BulkActionBar } from "@/components/patterns/bulk-action-bar";
import { DataTableFrame, TableCell, TableHeaderCell, TableRow, TableState } from "@/components/patterns/data-table-frame";
import { Pagination } from "@/components/patterns/pagination";
import { QuickFilterChips } from "@/components/patterns/quick-filter-chips";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  CLASS_SESSION_LIMIT,
  classSessionFilters,
  classSessionStageMeta,
  countClassSessionFilters,
  formatSessionOrdinal,
  getClassSessionStage,
  getRecordedCount,
  matchesClassSessionFilter,
  type ClassSessionFilter,
  type ClassSessionRow,
  type ClassSessionStage,
} from "@/features/classes/detail/class-detail-models";
import { cancelClassSessionsAction } from "@/features/sessions/actions/session-lifecycle-actions";
import type { CancelClassSessionsActionState } from "@/features/sessions/forms/session-action-types";
import {
  BULK_CANCEL_MAX_SESSIONS,
  CANCEL_REASON_MAX_LENGTH,
  CANCEL_REASON_MIN_LENGTH,
} from "@/features/sessions/forms/session-lifecycle-form-schema";
import { textAreaControlClass } from "@/features/students/form/components/form-controls";
import { formatTime, formatWeekdayDate } from "@/lib/datetime";
import { formatLearningMode } from "@/lib/format";
import { cn } from "@/lib/utils";

export const CLASS_SESSIONS_PAGE_SIZE = 20;

/** Ordinals named in the bulk bar before the rest collapse into "+n". */
const BULK_SUBJECT_ORDINALS = 3;

const filterLabels: Record<ClassSessionFilter, string> = {
  all: "Tất cả",
  upcoming: "Sắp tới",
  pending_lock: "Chờ khóa",
  locked: "Đã khóa",
  cancelled: "Đã hủy",
};

const checkboxClassName =
  "h-4 w-4 cursor-pointer rounded border-border-strong accent-[var(--action-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

interface ClassSessionsTabProps {
  /** False when attendance is not readable or failed to load (column shows "—"). */
  attendanceAvailable: boolean;
  batchHref: string | null;
  /** Bulk cancel is owner-only: sessions.manage and classes.manage_schedule (TAs hold only the first). */
  canBulkCancelSessions: boolean;
  /** The page's class: only its own sessions are bulk-cancelled, never a component class's. */
  classId: string;
  /** HH:MM in Vietnam time: a session that ended earlier today without starting is overdue. */
  nowTime?: string;
  resultsAvailable: boolean;
  rows: readonly ClassSessionRow[];
  today: string;
  truncated?: boolean;
}

/**
 * Only this class's sessions nobody has started can be cancelled in bulk. A composite
 * parent's feed also lists its components' sessions, which other classes share, so
 * those are cancelled from the component's own page. The server checks both again.
 */
function isBulkCancellable(row: ClassSessionRow, stage: ClassSessionStage, classId: string): boolean {
  return row.classId === classId && row.status === "scheduled" && !row.lockedAt && (stage === "upcoming" || stage === "overdue");
}

/** "B3 ngày T4, 14/10/2026", or "đã hủy ngày …" for a cancelled session (it has no ordinal). */
function describeSession(row: ClassSessionRow): string {
  return `${row.ordinal === null ? "đã hủy" : formatSessionOrdinal(row.ordinal)} ngày ${formatWeekdayDate(row.sessionDate)}`;
}

/** "B3 (T4 14/10, 19:30)": names a session in result messages without relying on the ordinal alone. */
function identifySession(row: ClassSessionRow): string {
  return `${formatSessionOrdinal(row.ordinal)} (${formatWeekdayDate(row.sessionDate, { year: false })}, ${formatTime(row.startTime)})`;
}

/** "buổi · B3, B4, B5 +2": at most a few ordinals, so the bar stays one line. */
function formatBulkSubject(rows: readonly ClassSessionRow[]): string {
  const named = rows.slice(0, BULK_SUBJECT_ORDINALS).map((row) => formatSessionOrdinal(row.ordinal)).join(", ");
  const rest = rows.length - BULK_SUBJECT_ORDINALS;
  return rows.length === 0 ? "buổi" : `buổi · ${named}${rest > 0 ? ` +${rest}` : ""}`;
}

/** First page that shows the next upcoming session, so the table opens on "now". */
function getInitialPage(rows: readonly ClassSessionRow[], today: string): number {
  const index = rows.findIndex((row) => row.status !== "cancelled" && row.sessionDate >= today);
  return index < 0 ? Math.max(1, Math.ceil(rows.length / CLASS_SESSIONS_PAGE_SIZE)) : Math.floor(index / CLASS_SESSIONS_PAGE_SIZE) + 1;
}

/**
 * Sessions of one class (design 03b): count chips, a per-session table with
 * attendance and result progress, and bulk cancel for sessions not started yet.
 * Creating sessions stays in /sessions/batch; the tab only links there.
 */
export function ClassSessionsTab({
  attendanceAvailable,
  batchHref,
  canBulkCancelSessions,
  classId,
  nowTime,
  resultsAvailable,
  rows,
  today,
  truncated = false,
}: ClassSessionsTabProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<ClassSessionFilter>("all");
  const [page, setPage] = useState(() => getInitialPage(rows, today));
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ tone: "success" | "warning"; title: string; description?: string } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const firstMobileCheckboxRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  /** Set when a bulk cancel cleared the selection: its trigger is gone, so focus goes to the result. */
  const focusResultRef = useRef(false);
  // "Bỏ chọn" fallbacks: select-all is desktop-only, so mobile lands on the first row
  // checkbox, or on the active filter chip when this page has nothing to select.
  const clearFocusRefs = useMemo<ReadonlyArray<RefObject<HTMLElement | null>>>(
    () => [
      selectAllRef,
      firstMobileCheckboxRef,
      {
        get current() {
          return chipsRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? null;
        },
      },
    ],
    [],
  );

  useEffect(() => {
    if (resultMessage && focusResultRef.current) {
      focusResultRef.current = false;
      resultRef.current?.focus();
    }
  }, [resultMessage]);

  const counts = useMemo(() => countClassSessionFilters(rows, today, nowTime), [nowTime, rows, today]);
  const filtered = useMemo(
    () => rows.filter((row) => matchesClassSessionFilter(getClassSessionStage(row, today, nowTime), filter)),
    [filter, nowTime, rows, today],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / CLASS_SESSIONS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * CLASS_SESSIONS_PAGE_SIZE, currentPage * CLASS_SESSIONS_PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * CLASS_SESSIONS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * CLASS_SESSIONS_PAGE_SIZE, filtered.length);
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));

  function changeFilter(value: ClassSessionFilter) {
    setFilter(value);
    setPage(value === "all" ? getInitialPage(rows, today) : 1);
  }

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasBulkCancellable = canBulkCancelSessions && rows.some((row) => isBulkCancellable(row, getClassSessionStage(row, today, nowTime), classId));
  const selectableOnPage = canBulkCancelSessions
    ? pageRows.filter((row) => isBulkCancellable(row, getClassSessionStage(row, today, nowTime), classId)).map((row) => row.id)
    : [];
  const selectedOnPage = selectableOnPage.filter((id) => selectedIds.has(id)).length;
  const allOnPageSelected = selectableOnPage.length > 0 && selectedOnPage === selectableOnPage.length;

  function toggleAllOnPage(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of selectableOnPage) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const chips = classSessionFilters.map((value) => ({
    count: counts[value],
    label: filterLabels[value],
    value,
  }));

  const pagerProps = {
    itemLabel: "buổi",
    onPageChange: setPage,
    page: currentPage,
    pageCount,
    rangeEnd,
    rangeStart,
    total: filtered.length,
  };

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div ref={chipsRef}>
          <QuickFilterChips chips={chips} label="Lọc buổi học theo trạng thái" onChange={changeFilter} value={filter} />
        </div>
        {batchHref ? (
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-secondary md:min-h-8 font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={batchHref}
          >
            Tạo buổi hàng loạt cho lớp này
            <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
          </Link>
        ) : null}
      </div>

      {truncated ? (
        <ResultBanner
          description={`Lớp có hơn ${CLASS_SESSION_LIMIT} buổi. Bảng chỉ hiện ${CLASS_SESSION_LIMIT} buổi mới nhất; các buổi cũ hơn không có trong bảng và không được tính vào số đếm ở trên.`}
          title={`Chỉ hiện ${CLASS_SESSION_LIMIT} buổi mới nhất`}
          tone="info"
        />
      ) : null}

      {resultMessage ? (
        // Focus target after a bulk cancel that cleared the selection (its trigger unmounted).
        <div className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" ref={resultRef} tabIndex={-1}>
          <ResultBanner description={resultMessage.description} title={resultMessage.title} tone={resultMessage.tone} />
        </div>
      ) : null}

      {hasBulkCancellable ? (
        <BulkActionBar
          onClear={() => setSelectedIds(new Set())}
          returnFocusRefs={clearFocusRefs}
          selectedCount={selectedIds.size}
          subject={formatBulkSubject(selectedRows)}
        >
          <Button
            onClick={() => setIsCancelOpen(true)}
            ref={cancelTriggerRef}
            size="sm"
            type="button"
            variant="danger-outline"
          >
            Hủy buổi…
          </Button>
        </BulkActionBar>
      ) : null}

      <div className="hidden md:block">
        <DataTableFrame
          body={pageRows.map((row) => {
            const stage = getClassSessionStage(row, today, nowTime);
            const selectable = canBulkCancelSessions && isBulkCancellable(row, stage, classId);
            const isSelected = selectedIds.has(row.id);

            return (
              <TableRow key={row.id} selected={isSelected}>
                {canBulkCancelSessions ? (
                  <TableCell className="w-12">
                    {selectable ? (
                      <input
                        aria-label={`Chọn buổi ${describeSession(row)}`}
                        checked={isSelected}
                        className={checkboxClassName}
                        onChange={() => toggle(row.id)}
                        type="checkbox"
                      />
                    ) : null}
                  </TableCell>
                ) : null}
                <TableCell className="w-16 font-semibold tabular-nums text-text-strong">{formatSessionOrdinal(row.ordinal)}</TableCell>
                <TableCell>
                  <span className="block whitespace-nowrap text-text-default">{formatWeekdayDate(row.sessionDate)}</span>
                  {row.sessionKind !== "regular" ? (
                    <span className="block text-caption text-text-muted">{row.sessionKind === "makeup" ? "Buổi bù" : "Buổi bổ sung"}</span>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatTime(row.startTime)}–{formatTime(row.endTime)}
                </TableCell>
                <TableCell>
                  <span className="block text-text-default">{formatLearningMode(row.learningMode)}</span>
                  <span className="block truncate text-caption text-text-muted">
                    {[row.roomName, row.componentCode ? `Thành phần ${row.componentCode}` : null].filter(Boolean).join(" · ") || "—"}
                  </span>
                </TableCell>
                <TableCell numeric>
                  <AttendanceCell available={attendanceAvailable} row={row} />
                </TableCell>
                <TableCell numeric>
                  <ResultCell available={resultsAvailable} row={row} />
                </TableCell>
                <TableCell>
                  <Badge tone={classSessionStageMeta[stage].tone}>{classSessionStageMeta[stage].label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <SessionRowAction row={row} stage={stage} />
                </TableCell>
              </TableRow>
            );
          })}
          caption="Buổi học của lớp"
          empty={<TableState>Không có buổi nào ở mục “{filterLabels[filter]}”.</TableState>}
          footer={<Pagination {...pagerProps} label="Phân trang buổi học" variant="frame" />}
          header={
            <tr>
              {canBulkCancelSessions ? (
                <TableHeaderCell className="w-12">
                  {selectableOnPage.length > 0 ? (
                    <input
                      aria-label="Chọn mọi buổi chưa bắt đầu trên trang"
                      checked={allOnPageSelected}
                      className={checkboxClassName}
                      onChange={(event) => toggleAllOnPage(event.target.checked)}
                      ref={(node) => {
                        if (node) node.indeterminate = selectedOnPage > 0 && !allOnPageSelected;
                        selectAllRef.current = node;
                      }}
                      type="checkbox"
                    />
                  ) : null}
                </TableHeaderCell>
              ) : null}
              <TableHeaderCell>Buổi</TableHeaderCell>
              <TableHeaderCell>Ngày</TableHeaderCell>
              <TableHeaderCell>Giờ</TableHeaderCell>
              <TableHeaderCell>Hình thức · Phòng</TableHeaderCell>
              <TableHeaderCell numeric title="Học sinh trong danh sách lớp đã được điểm danh có mặt hoặc vắng">
                Điểm danh
              </TableHeaderCell>
              <TableHeaderCell numeric>Kết quả</TableHeaderCell>
              <TableHeaderCell>Trạng thái</TableHeaderCell>
              <TableHeaderCell numeric>Thao tác</TableHeaderCell>
            </tr>
          }
          status={filtered.length === 0 ? "empty" : "ready"}
          tableClassName="min-w-[860px]"
        />
      </div>

      <div className="grid gap-2 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface-base px-4 py-6 text-center text-secondary text-text-muted">
            Không có buổi nào ở mục “{filterLabels[filter]}”.
          </p>
        ) : (
          <>
            <ResponsiveRecordList label="Buổi học của lớp">
              {pageRows.map((row) => {
                const stage = getClassSessionStage(row, today, nowTime);
                const selectable = canBulkCancelSessions && isBulkCancellable(row, stage, classId);
                const isFirstSelectable = selectable && row.id === selectableOnPage[0];
                const timeAndRoom = `${formatTime(row.startTime)}–${formatTime(row.endTime)}${row.roomName ? ` · ${row.roomName}` : ""}`;

                return (
                  <RecordListItem
                    ariaLabel={`Mở buổi ${describeSession(row)}`}
                    badge={<Badge tone={classSessionStageMeta[stage].tone}>{classSessionStageMeta[stage].label}</Badge>}
                    href={`/sessions/${row.id}`}
                    key={row.id}
                    leading={
                      // Same eligibility as the desktop table; the 44px label is the touch target.
                      // The gutter only appears on pages that have something to select.
                      selectableOnPage.length > 0 ? (
                        <span className="flex w-11 shrink-0 items-center justify-center">
                          {selectable ? (
                            <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                              <input
                                aria-label={`Chọn buổi ${describeSession(row)}`}
                                checked={selectedIds.has(row.id)}
                                className={checkboxClassName}
                                onChange={() => toggle(row.id)}
                                ref={isFirstSelectable ? firstMobileCheckboxRef : undefined}
                                type="checkbox"
                              />
                            </label>
                          ) : null}
                        </span>
                      ) : undefined
                    }
                    // A cancelled session has no ordinal: its date is the title and the badge says "Đã hủy".
                    meta={row.ordinal === null ? timeAndRoom : `${formatWeekdayDate(row.sessionDate)} · ${timeAndRoom}`}
                    metrics={
                      row.attendance || row.resultCount !== null ? (
                        <span className="flex gap-4 text-secondary text-text-muted">
                          <span>
                            Điểm danh <AttendanceCell available={attendanceAvailable} row={row} />
                          </span>
                          <span>
                            Kết quả <ResultCell available={resultsAvailable} row={row} />
                          </span>
                        </span>
                      ) : undefined
                    }
                    title={row.ordinal === null ? formatWeekdayDate(row.sessionDate) : formatSessionOrdinal(row.ordinal)}
                  />
                );
              })}
            </ResponsiveRecordList>
            <Pagination {...pagerProps} label="Phân trang buổi học (danh sách gọn)" />
          </>
        )}
      </div>

      {isCancelOpen ? (
        <BulkCancelDialog
          classId={classId}
          onClose={() => setIsCancelOpen(false)}
          onDone={(outcome) => {
            setIsCancelOpen(false);
            setSelectedIds(new Set(outcome.failed.map((item) => item.row.id)));
            focusResultRef.current = outcome.failed.length === 0;
            setResultMessage(
              outcome.failed.length === 0
                ? { title: `Đã hủy ${outcome.cancelled} buổi.`, tone: "success" }
                : {
                    description: outcome.failed
                      .map((item) => `${identifySession(item.row)}: ${item.message}`)
                      .join(" · "),
                    title: `Đã hủy ${outcome.cancelled}/${outcome.cancelled + outcome.failed.length} buổi. Các buổi lỗi vẫn đang được chọn.`,
                    tone: "warning",
                  },
            );
            if (outcome.cancelled > 0) router.refresh();
          }}
          returnFocusRef={cancelTriggerRef}
          rows={selectedRows}
        />
      ) : null}
    </div>
  );
}

function AttendanceCell({ available, row }: { available: boolean; row: ClassSessionRow }) {
  if (row.status === "cancelled" || row.rosterCount === null) {
    return <span className="text-text-muted">—</span>;
  }

  if (!available || !row.attendance) {
    return (
      <span className="text-text-muted" title={available ? "Chưa tải được điểm danh" : "Không có quyền xem điểm danh"}>
        —
      </span>
    );
  }

  const recorded = getRecordedCount(row.attendance);
  const complete = row.rosterCount > 0 && recorded >= row.rosterCount;

  return (
    <span
      className={cn("tabular-nums", complete ? "text-text-default" : "font-semibold text-warning-ink")}
      title={`${row.attendance.present} có mặt · ${row.attendance.absent} vắng${row.attendance.additional > 0 ? ` · ${row.attendance.additional} học thêm` : ""}`}
    >
      {recorded}/{row.rosterCount}
    </span>
  );
}

function ResultCell({ available, row }: { available: boolean; row: ClassSessionRow }) {
  if (row.status === "cancelled" || row.resultCount === null || !row.attendance) {
    return <span className="text-text-muted">—</span>;
  }

  if (!available) {
    return (
      <span className="text-text-muted" title="Không có quyền xem kết quả">
        —
      </span>
    );
  }

  // Results are recorded for students marked present; absent students have none.
  return (
    <span className="tabular-nums text-text-default" title="Kết quả đã nhập / học sinh có mặt">
      {row.resultCount}/{row.attendance.present + row.attendance.additional}
    </span>
  );
}

function SessionRowAction({ row, stage }: { row: ClassSessionRow; stage: ClassSessionStage }) {
  const needsAttendance =
    (stage === "live" || stage === "pending_lock") && row.attendance && row.rosterCount !== null && getRecordedCount(row.attendance) < row.rosterCount;
  const label = needsAttendance ? "Điểm danh" : stage === "pending_lock" ? "Khóa buổi" : "Xem";

  return (
    <Link
      aria-label={`${label} buổi ${describeSession(row)}`}
      className="inline-flex h-8 items-center whitespace-nowrap rounded-md px-2 text-secondary font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      href={`/sessions/${row.id}`}
    >
      {label}
    </Link>
  );
}

interface BulkCancelOutcome {
  cancelled: number;
  failed: Array<{ message: string; row: ClassSessionRow }>;
}

function BulkCancelDialog({
  classId,
  onClose,
  onDone,
  returnFocusRef,
  rows,
}: {
  classId: string;
  onClose: () => void;
  onDone: (outcome: BulkCancelOutcome) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  rows: readonly ClassSessionRow[];
}) {
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const trimmed = reason.trim();
  const isReasonTooShort = trimmed.length < CANCEL_REASON_MIN_LENGTH;
  const isTooMany = rows.length > BULK_CANCEL_MAX_SESSIONS;
  const reasonError = trimmed.length > 0 && isReasonTooShort ? `Lý do hủy phải có ít nhất ${CANCEL_REASON_MIN_LENGTH} ký tự.` : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isReasonTooShort || isTooMany) {
      return;
    }

    setSubmitError(null);
    startTransition(async () => {
      let result: CancelClassSessionsActionState;

      // One call: the server cancels the sessions one by one, in date order, and a
      // failure does not stop the others.
      try {
        result = await cancelClassSessionsAction({ classId, reason: trimmed, sessionIds: rows.map((row) => row.id) });
      } catch {
        setSubmitError("Không kết nối được hệ thống. Tải lại trang để xem buổi nào đã hủy rồi thử lại.");
        return;
      }

      if (result.status === "error") {
        setSubmitError(result.message);
        return;
      }

      const rowsById = new Map(rows.map((row) => [row.id, row]));

      onDone({
        cancelled: result.cancelled,
        failed: result.failed.flatMap((item) => {
          const row = rowsById.get(item.sessionId);
          return row ? [{ message: item.message, row }] : [];
        }),
      });
    });
  }

  return (
    <Dialog
      ariaDescribedBy="class-bulk-cancel-description"
      ariaLabelledBy="class-bulk-cancel-title"
      className="max-w-lg p-5"
      isOpen
      onClose={() => {
        if (!isPending) onClose();
      }}
      returnFocusRef={returnFocusRef}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-section-title font-semibold text-text-strong" id="class-bulk-cancel-title">
            Hủy {rows.length} buổi học
          </h2>
          <div className="mt-3 grid gap-1.5" id="class-bulk-cancel-description">
            <p className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-secondary font-semibold text-danger-ink">
              Các buổi sau sẽ bị hủy và không mở lại được: {rows.map((row) => `${formatSessionOrdinal(row.ordinal)} (${formatWeekdayDate(row.sessionDate, { year: false })})`).join(", ")}.
            </p>
            <p className="text-secondary text-text-muted">
              Buổi hủy không trừ buổi của học sinh. Cần dạy bù thì tạo buổi bù ở mục Tạo buổi học và chọn buổi đã hủy làm buổi gốc.
            </p>
          </div>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-semibold text-ink-muted" htmlFor="class-bulk-cancel-reason">
            Lý do hủy<span className="ml-1 text-danger">*</span>
          </label>
          <textarea
            aria-describedby={reasonError ? "class-bulk-cancel-reason-error" : undefined}
            aria-invalid={reasonError ? true : undefined}
            autoFocus
            className={textAreaControlClass(reasonError ?? undefined)}
            disabled={isPending}
            id="class-bulk-cancel-reason"
            maxLength={CANCEL_REASON_MAX_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Trùng lịch thi giữa kỳ ở trường"
            required
            value={reason}
          />
          {reasonError ? (
            <p className="text-xs font-semibold leading-5 text-danger" id="class-bulk-cancel-reason-error">
              {reasonError}
            </p>
          ) : null}
        </div>

        {submitError ? (
          <p className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-secondary font-semibold text-danger-ink" role="alert">
            {submitError}
          </p>
        ) : null}

        {isPending ? (
          <p aria-live="polite" className="text-secondary text-text-muted">
            Đang hủy {rows.length} buổi…
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button disabled={isPending} onClick={onClose} type="button" variant="ghost">
            Không hủy
          </Button>
          <Button
            disabled={isPending || isReasonTooShort || isTooMany}
            disabledReason={
              isPending
                ? undefined
                : isTooMany
                  ? `Mỗi lần hủy tối đa ${BULK_CANCEL_MAX_SESSIONS} buổi; bỏ chọn bớt`
                  : isReasonTooShort
                    ? `Nhập lý do hủy (ít nhất ${CANCEL_REASON_MIN_LENGTH} ký tự)`
                    : undefined
            }
            type="submit"
            variant="danger-solid"
          >
            {isPending ? "Đang hủy..." : `Hủy ${rows.length} buổi`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
