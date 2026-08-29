import { ArrowDownRight, ArrowUpRight, BadgeCheck, Clock, FileText } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatCompactVnd, formatMonthYear, formatTrendPercent, formatVnd } from "@/features/dashboard/format";
import type { DashboardSectionState, PayrollExecutiveSummary } from "@/features/dashboard/read-models";

interface DashboardPayrollSummaryCardProps {
  section: DashboardSectionState<PayrollExecutiveSummary>;
  selectedMonth: string;
}

export function DashboardPayrollSummaryCard({
  section,
  selectedMonth,
}: DashboardPayrollSummaryCardProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <Card className="flex h-64 items-center justify-center rounded-2xl border border-warning-border bg-warning-bg p-6 text-center text-warning">
        <div>
          <p className="font-bold">Không thể tải thông tin quỹ lương</p>
          <p className="mt-1 text-xs text-ink-muted">Vui lòng thử lại sau.</p>
        </div>
      </Card>
    );
  }

  const data = section.data;
  const { direction, formatted } = formatTrendPercent(data.variancePercent);

  const totalEmployees = data.staffByPosition.reduce(
    (sum, p) => sum + p.employeeCount,
    0,
  );

  return (
    <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink sm:text-lg">
            Quỹ lương & Cơ cấu nhân sự
          </h2>
          <p className="text-xs text-ink-muted">
            Tổng hợp bảng lương và quy mô nhân sự {formatMonthYear(selectedMonth)}
          </p>
        </div>

        <Link
          className="text-xs font-semibold text-primary transition hover:underline"
          href="/payroll"
        >
          Quản lý lương →
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Left: Total Fund & Status Pills */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-hairline bg-surface-2 p-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
              Tổng quỹ lương thực trả
            </span>
            <div className="mt-1 flex items-baseline gap-3">
              <p
                className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl"
                title={formatVnd(data.totalPayrollVnd)}
              >
                {formatCompactVnd(data.totalPayrollVnd)}
              </p>
              {data.variancePercent !== null ? (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                    direction === "up"
                      ? "text-amber-700"
                      : direction === "down"
                        ? "text-emerald-700"
                        : "text-ink-subtle"
                  }`}
                >
                  {direction === "up" ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : direction === "down" ? (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  ) : null}
                  {formatted} so với tháng trước
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-hairline bg-surface-1 p-2.5 text-center">
              <span className="flex items-center justify-center gap-1 text-[11px] font-semibold text-ink-muted">
                <FileText className="h-3.5 w-3.5 text-ink-subtle" />
                Bản nháp
              </span>
              <strong className="mt-1 block font-display text-base font-bold text-ink sm:text-lg">
                {data.draftCount}
              </strong>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-2.5 text-center text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <span className="flex items-center justify-center gap-1 text-[11px] font-semibold">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Chờ duyệt
              </span>
              <strong className="mt-1 block font-display text-base font-bold sm:text-lg">
                {data.reviewCount}
              </strong>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 text-center text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              <span className="flex items-center justify-center gap-1 text-[11px] font-semibold">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Đã duyệt
              </span>
              <strong className="mt-1 block font-display text-base font-bold sm:text-lg">
                {data.approvedCount}
              </strong>
            </div>
          </div>
        </div>

        {/* Right: Staff by Position Breakdown */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-hairline bg-surface-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
              Cơ cấu nhân sự ({totalEmployees} người)
            </span>
            <Link
              className="text-[11px] font-semibold text-primary transition hover:underline"
              href="/staff"
            >
              Hồ sơ nhân sự →
            </Link>
          </div>

          <div className="mt-1 space-y-2">
            {data.staffByPosition.length === 0 ? (
              <p className="text-xs text-ink-muted">Chưa có dữ liệu vị trí nhân sự.</p>
            ) : (
              data.staffByPosition.slice(0, 4).map((pos) => {
                const widthPercent =
                  totalEmployees > 0
                    ? Math.max(10, (pos.employeeCount / totalEmployees) * 100)
                    : 0;
                return (
                  <div className="text-xs" key={pos.positionName}>
                    <div className="flex items-center justify-between font-medium text-ink">
                      <span className="truncate text-ink" title={pos.positionName}>
                        {pos.positionName}
                      </span>
                      <div className="flex items-center gap-2 tabular-nums">
                        <strong className="text-ink">{pos.employeeCount} NS</strong>
                        <span className="text-[11px] text-ink-muted">
                          ({formatCompactVnd(pos.amountVnd)})
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-1">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
