"use client";

/**
 * Tuition period page (design 07, frame 7b). Kept: header with the real status
 * badge and context line, the 4-step stepper, the KPI strip, quick chips with
 * counts, a class filter (class at lock time) and the per-student table linking
 * each notice. Dropped for lack of data: reminders ("Gửi nhắc N HS", the
 * "Nhắc" column, "Lỗi gửi" chip, "Chưa gửi được" / "Sửa SĐT"), the "Chờ khớp"
 * chip and "Tiền về chưa khớp" KPI (no link from a request to unmatched SePay
 * transactions), "Khóa bởi <name>" (only a user id is stored), the request
 * creation time (same transaction as the lock), the KT-xxxx code, "N lớp" and
 * per-row session lines (item lines are not loaded here), the request code
 * column and row checkboxes (printing keeps TuitionBulkPrintControls).
 */

import Link from "next/link";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow, TableState } from "@/components/patterns/data-table-frame";
import { FilterSelect } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { QuickFilterChips, type QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import type { TuitionPeriodListItem } from "@/features/tuition/data";
import {
  countTuitionItemFilters,
  getTuitionItemCollected,
  getTuitionItemPaymentState,
  getTuitionItemRemaining,
  matchesTuitionItemFilter,
  type TuitionItemFilter,
  type TuitionPeriodItemRow,
  type TuitionPeriodPaymentSummary,
} from "@/features/tuition/period-summary";
import { OverdueCaption } from "@/features/tuition/overdue-caption";
import { TuitionBulkPrintControls } from "@/features/tuition/print-controls";
import { formatDateTime, formatIsoDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TuitionPeriodHeaderProps {
  actions?: ReactNode;
  period: TuitionPeriodListItem;
  /** Students in the period: preview students (draft) or current items (locked); null = unknown. */
  studentCount: number | null;
}

/** Period name + real status badge, then dates · due date · students · lock time. */
export function TuitionPeriodHeader({ actions, period, studentCount }: TuitionPeriodHeaderProps) {
  const locked = period.status === "locked";
  const parts = [
    `${formatIsoDate(period.startsOn)} – ${formatIsoDate(period.endsOn)}`,
    period.dueOn ? `Hạn ${formatIsoDate(period.dueOn)}` : "Chưa đặt hạn thu",
    studentCount === null ? null : `${studentCount} học sinh`,
    locked && period.lockedAt ? `Khóa lúc ${formatDateTime(period.lockedAt)}` : null,
  ].filter(Boolean);

  return (
    <PageHeader actions={actions} context={<Badge tone={locked ? "info" : "neutral"}>{locked ? "Đã khóa" : "Nháp"}</Badge>} title={period.name}>
      <p className="mt-1 text-secondary tabular-nums text-text-muted">{parts.join(" · ")}</p>
    </PageHeader>
  );
}

/**
 * Locked period header actions: the payment-request list (secondary) and, while
 * money is still owed and the viewer has sepay.view, the SePay review queue as
 * the page's one primary.
 */
export function TuitionLockedPeriodActions({
  canViewPaymentRequests,
  owedCount,
  reviewHref,
}: {
  /** payments.view or payments.manage: the payment-request list route's own gate. */
  canViewPaymentRequests: boolean;
  owedCount: number | null;
  reviewHref: string | null;
}) {
  return (
    <>
      {canViewPaymentRequests ? (
        <Link className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })} href="/finance/payment-requests">
          Yêu cầu thanh toán
        </Link>
      ) : null}
      {reviewHref && owedCount !== 0 ? (
        <Link className={getButtonClassName({ className: "max-md:h-11" })} href={reviewHref}>
          Đối soát giao dịch SePay
        </Link>
      ) : null}
    </>
  );
}

/** Same vocabulary as PaymentRequestStatusBadge (the row badges below). */
const chipLabels: Record<TuitionItemFilter, string> = {
  all: "Tất cả",
  closed: "Đã hủy/hết hạn",
  paid: "Đã thanh toán",
  partial: "Thanh toán một phần",
  unpaid: "Chờ thanh toán",
};

interface TuitionPeriodLockedWorkspaceProps {
  period: TuitionPeriodListItem;
  /** Current items, one per student; null = the read failed. */
  rows: TuitionPeriodItemRow[] | null;
  /** Null when rows failed to load. */
  summary: TuitionPeriodPaymentSummary | null;
}

/** Locked period: KPI strip, printing, chips + class filter and the per-student table. */
export function TuitionPeriodLockedWorkspace({ period, rows, summary }: TuitionPeriodLockedWorkspaceProps) {
  const classFilterId = useId();
  const [filter, setFilter] = useState<TuitionItemFilter>("all");
  const [className, setClassName] = useState("");
  const paymentsVisible = Boolean(summary?.paymentsVisible);
  const allRows = useMemo(() => rows ?? [], [rows]);
  const classNames = useMemo(
    () => [...new Set(allRows.map((row) => row.className).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "vi")),
    [allRows],
  );
  const classRows = className ? allRows.filter((row) => row.className === className) : allRows;
  const counts = countTuitionItemFilters(classRows);
  const shown = classRows.filter((row) => matchesTuitionItemFilter(row, filter));
  const shownRemaining = shown.reduce((sum, row) => sum + getTuitionItemRemaining(row), 0);
  const chips: QuickFilterChip<TuitionItemFilter>[] = (["all", "paid", "partial", "unpaid", "closed"] as const).map((value) => ({
    count: counts[value],
    label: chipLabels[value],
    value,
  }));
  const status = rows === null ? "error" : allRows.length === 0 || shown.length === 0 ? "empty" : "ready";
  const noticeHref = (row: TuitionPeriodItemRow) => `/finance/tuition-periods/${period.id}/items/${row.itemId}/notice`;
  const clearFilters = () => {
    setFilter("all");
    setClassName("");
  };
  const emptyState =
    allRows.length === 0 ? (
      <TableState>Kỳ này không có Phiếu học phí nào.</TableState>
    ) : (
      <TableState>
        <p>Không có học sinh khớp bộ lọc.</p>
        <Button className="max-md:h-11" onClick={clearFilters} size="sm" variant="secondary">Xóa lọc</Button>
      </TableState>
    );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      {summary ? <KpiStrip period={period} summary={summary} /> : null}
      {summary?.paymentsVisible && summary.counts.unknown > 0 ? (
        <p className="text-secondary text-text-muted">
          {summary.counts.unknown} học sinh có khoản phải thu nhưng chưa tải được yêu cầu thanh toán; các số trên chưa gồm các em.
        </p>
      ) : null}

      {rows && rows.length > 0 ? (
        <details className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] [&[open]>summary]:border-b">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 border-border-row px-4 text-body font-semibold text-text-strong">
            In phiếu học phí <span className="font-normal tabular-nums text-text-muted">({rows.length} phiếu)</span>
          </summary>
          <div className="p-3">
            <TuitionBulkPrintControls
              notices={rows.map((row) => ({
                grade: row.grade,
                href: noticeHref(row),
                id: row.itemId,
                name: row.studentName,
                payableAmountVnd: row.payableAmountVnd,
              }))}
            />
          </div>
        </details>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {paymentsVisible ? <QuickFilterChips chips={chips} className="max-md:[&>button]:h-11" label="Lọc theo trạng thái thanh toán" onChange={setFilter} value={filter} /> : null}
          {classNames.length > 1 ? (
            <div className="flex items-center gap-2 md:ml-auto">
              <label className="text-label font-medium text-text-muted" htmlFor={classFilterId}>Lớp</label>
              <FilterSelect
                active={className !== ""}
                className="h-11 min-w-48 md:h-8"
                id={classFilterId}
                onChange={(event) => setClassName(event.target.value)}
                value={className}
              >
                <option value="">Tất cả lớp</option>
                {classNames.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </FilterSelect>
            </div>
          ) : null}
        </div>
      ) : null}

      {!paymentsVisible && rows ? (
        <p className="text-secondary text-text-muted">Cần quyền xem thanh toán để thấy số đã thu, còn lại và trạng thái từng yêu cầu.</p>
      ) : null}

      <div className="@container grid min-w-0 gap-2">
        <div className="hidden @min-[840px]:block">
          <DataTableFrame
            body={shown.map((row) => (
              <TableRow key={row.itemId} tall>
                <TableCell>
                  <span className="block font-semibold text-text-strong">{row.studentName}</span>
                  {row.publicCode ? <span className="block text-caption tabular-nums text-text-muted">{row.publicCode}</span> : null}
                </TableCell>
                <TableCell>
                  <span className="block">{row.className ?? "—"}</span>
                  <span className="block text-caption tabular-nums text-text-muted">{row.payableSessions} buổi tính phí</span>
                </TableCell>
                <TableCell numeric>{formatVnd(row.payableAmountVnd)}</TableCell>
                {paymentsVisible ? (
                  <>
                    <TableCell className="text-success" numeric><CollectedValue row={row} /></TableCell>
                    <TableCell numeric><RemainingValue layout="table" pastDue={Boolean(summary?.isPastDue)} row={row} /></TableCell>
                    <TableCell>
                      <ItemStatus row={row} />
                    </TableCell>
                  </>
                ) : null}
                <TableCell className="text-right">
                  <Link
                    aria-label={`Mở Phiếu học phí của ${row.studentName}`}
                    className="whitespace-nowrap text-secondary font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                    href={noticeHref(row)}
                  >
                    Phiếu học phí
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            caption={`Phiếu học phí của ${period.name}`}
            empty={emptyState}
            error={<TableState>Chưa tải được danh sách phiếu học phí. Tải lại trang để thử lại.</TableState>}
            footer={
              status === "ready" ? (
                <span>
                  {shown.length} trong {allRows.length} học sinh
                  {paymentsVisible ? (
                    <>
                      {" "}· tổng còn lại <strong className="font-semibold tabular-nums text-text-strong">{formatVnd(shownRemaining)}</strong>
                    </>
                  ) : null}
                </span>
              ) : undefined
            }
            header={
              <tr>
                <TableHeaderCell>Học sinh</TableHeaderCell>
                <TableHeaderCell>Lớp · số buổi tính phí</TableHeaderCell>
                <TableHeaderCell className="w-[130px]" numeric>Phải thu</TableHeaderCell>
                {paymentsVisible ? (
                  <>
                    <TableHeaderCell className="w-[130px]" numeric>Đã thu</TableHeaderCell>
                    <TableHeaderCell className="w-[130px]" numeric>Còn lại</TableHeaderCell>
                    <TableHeaderCell className="w-[180px]">Trạng thái</TableHeaderCell>
                  </>
                ) : null}
                <TableHeaderCell className="w-[120px]"><span className="sr-only">Phiếu học phí</span></TableHeaderCell>
              </tr>
            }
            status={status}
            tableClassName="min-w-[820px]"
          />
        </div>

        <div className="grid @min-[840px]:hidden">
          {status === "ready" ? (
            <ResponsiveRecordList label={`Phiếu học phí của ${period.name}`}>
              {shown.map((row) => (
                <RecordListItem
                  ariaLabel={`Mở Phiếu học phí của ${row.studentName}`}
                  badge={paymentsVisible ? <ItemBadge row={row} /> : undefined}
                  href={noticeHref(row)}
                  key={row.itemId}
                  meta={[row.publicCode, row.className, `${row.payableSessions} buổi`].filter(Boolean).join(" · ")}
                  metrics={
                    <>
                      <span>
                        Phải thu <strong className="tabular-nums text-text-strong">{formatVnd(row.payableAmountVnd)}</strong>
                      </span>
                      {paymentsVisible && (row.payment || getTuitionItemPaymentState(row) === "unknown") ? (
                        <>
                          <span>
                            Đã thu <CollectedValue row={row} />
                          </span>
                          <span>
                            Còn lại <RemainingValue layout="inline" pastDue={Boolean(summary?.isPastDue)} row={row} />
                          </span>
                        </>
                      ) : null}
                    </>
                  }
                  title={row.studentName}
                />
              ))}
            </ResponsiveRecordList>
          ) : (
            <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
              {status === "error" ? <TableState>Chưa tải được danh sách phiếu học phí. Tải lại trang để thử lại.</TableState> : emptyState}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiStrip({ period, summary }: { period: TuitionPeriodListItem; summary: TuitionPeriodPaymentSummary }) {
  const overdueLabel = period.dueOn ? `Quá hạn (sau ${formatIsoDate(period.dueOn)})` : "Quá hạn";

  return (
    <dl
      aria-label="Tổng quan thu"
      className={cn(
        "grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]",
        summary.paymentsVisible && "sm:grid-cols-2 xl:grid-cols-4",
      )}
    >
      <Kpi
        label="Phải thu"
        // Rows show each notice's amount; the total counts only requests still in force.
        note={summary.paymentsVisible ? "Không tính yêu cầu đã hủy hoặc hết hạn" : undefined}
        value={formatVnd(summary.payableVnd)}
      />
      {summary.paymentsVisible ? (
        <>
          <Kpi label="Đã thu" tone="success" value={formatVnd(summary.collectedVnd)} />
          <Kpi label="Còn lại" note={`${summary.counts.unpaid + summary.counts.partial} học sinh chưa đóng đủ`} value={formatVnd(summary.remainingVnd)} />
          {!period.dueOn ? (
            <Kpi label={overdueLabel} tone="muted" value="Chưa đặt hạn" />
          ) : !summary.isPastDue ? (
            <Kpi label={overdueLabel} tone="muted" value="Chưa đến hạn" />
          ) : (
            <Kpi
              label={overdueLabel}
              note={`${summary.overdueStudents} học sinh`}
              tone={summary.overdueVnd > 0 ? "danger" : undefined}
              value={formatVnd(summary.overdueVnd)}
            />
          )}
        </>
      ) : null}
    </dl>
  );
}

function Kpi({ label, note, tone, value }: { label: string; note?: string; tone?: "success" | "danger" | "muted"; value: string }) {
  return (
    <div className="border-border-row px-4 py-3 [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(odd)]:border-r xl:[&:not(:first-child)]:border-t-0 xl:[&:not(:last-child)]:border-r">
      <dt className="text-label text-text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-1 break-words text-numeric font-semibold tabular-nums",
          tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "muted" ? "text-text-muted" : "text-text-strong",
        )}
      >
        {value}
      </dd>
      {note ? <dd className="text-caption text-text-muted">{note}</dd> : null}
    </div>
  );
}

/** Unreadable request or unrecognised status: the amounts are unknown, never shown as 0 ₫. */
function UnknownAmount() {
  return (
    <span className="text-text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Chưa tải được</span>
    </span>
  );
}

function CollectedValue({ row }: { row: TuitionPeriodItemRow }) {
  if (getTuitionItemPaymentState(row) === "unknown") return <UnknownAmount />;
  if (!row.payment) return <span className="text-text-muted">—</span>;
  return <span className="tabular-nums text-success">{formatVnd(getTuitionItemCollected(row))}</span>;
}

/** Table: "quá hạn" as a block caption under the amount; record list: inline after it. */
function RemainingValue({ layout, pastDue, row }: { layout: "table" | "inline"; pastDue: boolean; row: TuitionPeriodItemRow }) {
  if (getTuitionItemPaymentState(row) === "unknown") return <UnknownAmount />;
  if (!row.payment) return <span className="text-text-muted">—</span>;
  const remaining = getTuitionItemRemaining(row);
  if (remaining === 0) return <span className="tabular-nums text-text-muted">{formatVnd(0)}</span>;
  return (
    <>
      <strong className={cn("font-semibold tabular-nums", pastDue ? "text-danger" : "text-text-strong")}>{formatVnd(remaining)}</strong>
      {pastDue ? layout === "table" ? <OverdueCaption /> : <span className="font-medium text-danger"> · quá hạn</span> : null}
    </>
  );
}

/** Same labels as the payment-request module; no request = nothing to pay this period. */
function ItemBadge({ row }: { row: TuitionPeriodItemRow }) {
  if (!row.payment) {
    // A payable amount without a readable request is unknown, not "nothing to pay".
    return row.payableAmountVnd > 0 ? <Badge tone="neutral">Chưa tải được</Badge> : <Badge tone="neutral">Không phải thu</Badge>;
  }
  if (!row.payment.status) return <Badge tone="neutral">Trạng thái khác</Badge>;
  return <PaymentRequestStatusBadge status={row.payment.status} />;
}

function ItemStatus({ row }: { row: TuitionPeriodItemRow }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <ItemBadge row={row} />
      {row.reissued ? <span className="text-caption text-text-muted">đã phát hành lại</span> : null}
    </span>
  );
}

/**
 * Drops `?locked=1` from the address bar once the confirmation has rendered,
 * so a reload or back navigation does not show it again. Other query
 * parameters are kept. Next 16 syncs a null-state replaceState with its router.
 */
export function ClearLockedFlag() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("locked")) return;
    url.searchParams.delete("locked");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  return null;
}
