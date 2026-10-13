"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow, TableState } from "@/components/patterns/data-table-frame";
import { FilterSelect } from "@/components/patterns/filter-bar";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { loadClassTuitionPeriodAction } from "@/features/classes/actions/class-tuition-actions";
import {
  getPaymentRemaining,
  summarizeClassTuition,
  type ClassTuitionPeriodOption,
  type ClassTuitionRow,
  type ClassTuitionView,
} from "@/features/classes/detail/class-tuition-models";
import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import { paymentRequestStatuses } from "@/features/students/detail/student-activity-models";
import { tuitionBlockerLabels } from "@/features/tuition/readiness";
import { formatIsoDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ClassTuitionTabProps {
  classId: string;
  /** The default period's view; `null` = it failed to load. */
  initialView: ClassTuitionView | null;
  /** Newest first. */
  periods: readonly ClassTuitionPeriodOption[];
  /** The period the page loaded (pickDefaultTuitionPeriod). */
  initialPeriodId: string;
}

/**
 * Tuition tab (design 03, step 5b part 2), read-only by owner decision: one row
 * per student with this class's chargeable sessions and amount in the chosen
 * period, and for a locked period the payment request's collected and owed
 * amounts. Payment requests are created by locking the period on its own page
 * (it bills every class), so the tab links there instead of a bulk button.
 */
export function ClassTuitionTab({ classId, initialPeriodId, initialView, periods }: ClassTuitionTabProps) {
  const selectId = useId();
  const [periodId, setPeriodId] = useState(initialPeriodId);
  const [view, setView] = useState<ClassTuitionView | null>(initialView);
  const [error, setError] = useState<string | null>(initialView ? null : "Chưa tải được học phí của kỳ này; tải lại trang để thử lại.");
  const [isPending, startTransition] = useTransition();
  const requestRef = useRef(0);
  // A router refresh (e.g. after a transfer on the students tab) ships a new
  // default view: adopt it instead of keeping the view loaded at mount.
  const [syncedInitialView, setSyncedInitialView] = useState(initialView);
  if (syncedInitialView !== initialView) {
    setSyncedInitialView(initialView);
    if (periodId === initialPeriodId && !isPending) {
      setView(initialView);
      setError(initialView ? null : "Chưa tải được học phí của kỳ này; tải lại trang để thử lại.");
    }
  }

  function changePeriod(nextId: string) {
    setPeriodId(nextId);
    setError(null);
    const request = ++requestRef.current;

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof loadClassTuitionPeriodAction>>;

      try {
        result = await loadClassTuitionPeriodAction(classId, nextId);
      } catch {
        // A dropped request or a stale action id after a deploy rejects: keep the
        // failure inside the tab instead of the page's error boundary.
        result = { message: "Không kết nối được máy chủ để tải kỳ thu này; thử lại.", status: "error" };
      }

      // A later pick wins over a slower earlier one.
      if (request !== requestRef.current) return;

      if (result.status === "success") {
        setView(result.view);
      } else {
        setView(null);
        setError(result.message);
      }
    });
  }

  const period = periods.find((option) => option.id === periodId) ?? null;
  // The loaded view's period is fresher than the list shipped with the page (the period may have been locked since).
  const isLocked = (view && view.period.id === periodId ? view.period.status : period?.status) === "locked";
  const shownView = view && view.period.id === periodId ? view : null;
  // While another period loads, the previous summary stays (dimmed) so the page keeps its height.
  const summaryView = shownView ?? (isPending ? view : null);
  const summaryLocked = summaryView?.period.status === "locked";
  const totals = summaryView ? summarizeClassTuition(summaryView) : null;
  const showPayments = Boolean(shownView?.paymentsVisible);

  return (
    <div className="class-roster grid min-w-0 gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <label className="text-label font-medium text-text-strong" htmlFor={selectId}>
            Kỳ thu
          </label>
          <FilterSelect className="min-w-64 max-md:h-11" id={selectId} onChange={(event) => changePeriod(event.target.value)} value={periodId}>
            {periods.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · {option.status === "locked" ? "Đã khóa" : "Chưa khóa"}
              </option>
            ))}
          </FilterSelect>
        </div>
        {period ? (
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-secondary font-semibold text-action-link hover:underline md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={`/finance/tuition-periods/${period.id}`}
          >
            {isLocked ? "Mở kỳ thu" : "Mở kỳ thu để khóa và tạo yêu cầu thanh toán"}
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
          </Link>
        ) : null}
      </div>

      {period ? (
        <p className="text-secondary text-text-muted">
          {formatIsoDate(period.startsOn)} – {formatIsoDate(period.endsOn)}
          {period.dueOn ? ` · hạn thu ${formatIsoDate(period.dueOn)}` : ""}
        </p>
      ) : null}

      {period && !isLocked ? (
        <ResultBanner
          description="Số buổi và số tiền là dự kiến, chưa trừ số dư buổi đầu kỳ. Yêu cầu thanh toán được tạo khi khóa kỳ ở trang kỳ thu; khóa kỳ áp dụng cho mọi lớp."
          title="Kỳ thu chưa khóa"
          tone="info"
        />
      ) : null}

      {totals && summaryView ? (
        <dl aria-busy={isPending || undefined} className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", isPending && "opacity-60")}>
          <Metric label="Học sinh có buổi tính phí" value={String(totals.studentCount)} />
          <Metric label={summaryLocked ? "Buổi tính phí" : "Buổi dự kiến"} value={String(totals.sessions)} />
          <Metric label={summaryLocked ? "Số tiền của lớp" : "Số tiền dự kiến"} value={formatVnd(totals.amountVnd)} />
          {summaryView.paymentsVisible ? (
            <Metric label="Còn phải thu (cả phiếu)" tone={totals.remainingVnd > 0 ? "danger" : undefined} value={formatVnd(totals.remainingVnd)} />
          ) : null}
        </dl>
      ) : null}

      {shownView && isLocked && shownView.rows.some((row) => row.includesOtherCharges || row.reissued) ? (
        <p className="text-caption text-text-muted">
          “Tổng phiếu”, “Đã thu” và “Còn nợ” là của cả phiếu học phí hiện hành (phiếu phát hành lại nếu có), gồm cả buổi ở lớp khác hoặc nợ buổi đầu kỳ.
        </p>
      ) : null}

      <div className="class-roster-table">
        <DataTableFrame
          body={(shownView?.rows ?? []).map((row) => (
            <TableRow key={row.studentId}>
              <TableCell className="w-28 whitespace-nowrap tabular-nums text-text-muted">{row.publicCode ?? "—"}</TableCell>
              <TableCell>
                <Link className="font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={`/students/${row.studentId}`}>
                  {row.fullName}
                </Link>
              </TableCell>
              <TableCell numeric>{row.sessions}</TableCell>
              <TableCell className="font-semibold text-text-strong" numeric>
                {formatVnd(row.amountVnd)}
              </TableCell>
              {isLocked ? (
                <TableCell numeric>
                  <span className="block">{row.itemAmountVnd === null ? "—" : formatVnd(row.itemAmountVnd)}</span>
                  {row.reissued ? <span className="block text-caption text-text-muted">đã phát hành lại</span> : null}
                  {row.includesOtherCharges ? <span className="block text-caption text-text-muted">gồm lớp khác</span> : null}
                </TableCell>
              ) : (
                <TableCell numeric>{formatOpeningBalance(row)}</TableCell>
              )}
              {isLocked && showPayments ? (
                <>
                  <TableCell numeric>{row.payment ? formatVnd(row.payment.paidVnd) : "—"}</TableCell>
                  <TableCell numeric>
                    <RemainingValue row={row} />
                  </TableCell>
                  <TableCell>
                    <PaymentBadge row={row} />
                  </TableCell>
                </>
              ) : null}
              {!isLocked ? (
                <TableCell>
                  <BlockerList row={row} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          caption="Học phí của học sinh trong lớp theo kỳ thu"
          empty={<TableState>Không có học sinh nào của lớp có buổi tính phí trong kỳ này.</TableState>}
          error={<TableState>{error ?? "Chưa tải được dữ liệu."}</TableState>}
          header={
            <tr>
              <TableHeaderCell>Mã</TableHeaderCell>
              <TableHeaderCell>Học sinh</TableHeaderCell>
              <TableHeaderCell numeric>{isLocked ? "Buổi tính phí" : "Buổi dự kiến"}</TableHeaderCell>
              <TableHeaderCell numeric title="Chỉ các buổi của lớp này">
                {isLocked ? "Số tiền lớp này" : "Số tiền dự kiến"}
              </TableHeaderCell>
              {isLocked ? (
                <TableHeaderCell numeric title="Cả phiếu học phí của học sinh trong kỳ">
                  Tổng phiếu
                </TableHeaderCell>
              ) : (
                <TableHeaderCell numeric title="Số dư buổi trước kỳ; buổi dư được trừ trước khi tính tiền">
                  Số dư đầu kỳ
                </TableHeaderCell>
              )}
              {isLocked && showPayments ? (
                <>
                  <TableHeaderCell numeric>Đã thu</TableHeaderCell>
                  <TableHeaderCell numeric>Còn nợ</TableHeaderCell>
                  <TableHeaderCell>Thanh toán</TableHeaderCell>
                </>
              ) : null}
              {!isLocked ? <TableHeaderCell>Vướng mắc khi khóa kỳ</TableHeaderCell> : null}
            </tr>
          }
          loading={<TableState>Đang tải học phí của kỳ…</TableState>}
          status={isPending ? "loading" : !shownView ? "error" : shownView.rows.length === 0 ? "empty" : "ready"}
          tableClassName="min-w-[860px]"
        />
      </div>

      <div className="class-roster-record-list gap-2">
        {isPending ? (
          <p className="rounded-lg border border-border-subtle bg-surface-base px-4 py-6 text-center text-secondary text-text-muted">Đang tải học phí của kỳ…</p>
        ) : shownView && shownView.rows.length > 0 ? (
          <ResponsiveRecordList label="Học phí của học sinh trong lớp">
            {shownView.rows.map((row) => (
              <RecordListItem
                ariaLabel={`Mở hồ sơ học sinh ${row.fullName}`}
                badge={isLocked && showPayments ? <PaymentBadge row={row} /> : undefined}
                href={`/students/${row.studentId}`}
                key={row.studentId}
                meta={[row.publicCode, `${row.sessions} buổi`, isLocked ? null : `Số dư đầu kỳ ${formatOpeningBalance(row)}`].filter(Boolean).join(" · ")}
                metrics={
                  <>
                    <span>
                      {isLocked ? "Lớp này" : "Dự kiến"} <strong className="text-text-strong">{formatVnd(row.amountVnd)}</strong>
                    </span>
                    {isLocked && showPayments ? (
                      <span>
                        Còn nợ <RemainingValue row={row} />
                      </span>
                    ) : null}
                    {!isLocked && row.blockers.length > 0 ? <BlockerList row={row} /> : null}
                  </>
                }
                title={row.fullName}
              />
            ))}
          </ResponsiveRecordList>
        ) : (
          <p className="rounded-lg border border-border-subtle bg-surface-base px-4 py-6 text-center text-secondary text-text-muted">
            {shownView ? "Không có học sinh nào của lớp có buổi tính phí trong kỳ này." : (error ?? "Chưa tải được dữ liệu.")}
          </p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, tone, value }: { label: string; tone?: "danger"; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className={cn("mt-1 text-[20px] font-semibold leading-7 tabular-nums", tone === "danger" ? "text-danger" : "text-text-strong")}>{value}</dd>
    </div>
  );
}

function formatOpeningBalance(row: ClassTuitionRow): string {
  if (row.openingBalanceSessions === null) return "—";
  return row.openingBalanceSessions < 0 ? `Âm ${Math.abs(row.openingBalanceSessions)} buổi` : `${row.openingBalanceSessions} buổi`;
}

function RemainingValue({ row }: { row: ClassTuitionRow }) {
  if (!row.payment) return <span className="text-text-muted">—</span>;
  const remaining = getPaymentRemaining(row.payment);
  return remaining > 0 ? <span className="font-semibold text-danger">{formatVnd(remaining)}</span> : <span className="text-text-muted">0 ₫</span>;
}

function PaymentBadge({ row }: { row: ClassTuitionRow }) {
  if (!row.payment) {
    // No request: the period charged nothing after the opening credit.
    return <Badge tone="neutral">Không phải thu</Badge>;
  }
  const status = paymentRequestStatuses.find((value) => value === row.payment?.status);
  if (!status) return <Badge tone="neutral"><span title={row.payment.status}>Trạng thái khác</span></Badge>;
  // Same labels as the finance module's payment requests.
  return <PaymentRequestStatusBadge status={status} />;
}

function BlockerList({ row }: { row: ClassTuitionRow }) {
  if (row.blockers.length === 0) return <span className="text-text-muted">Sẵn sàng</span>;
  return (
    <span className="text-danger" title={row.blockers.join(", ")}>
      {row.blockers.map((code) => tuitionBlockerLabels[code] ?? "Vướng mắc khác").join("; ")}
    </span>
  );
}
