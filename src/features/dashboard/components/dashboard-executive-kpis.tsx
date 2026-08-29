import { ArrowDownRight, ArrowUpRight, Banknote, DollarSign, Receipt, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { formatCompactVnd, formatNumber, formatTrendPercent, formatVnd } from "@/features/dashboard/format";
import type { DashboardSectionState, ExecutiveKpisSummary } from "@/features/dashboard/read-models";

interface DashboardExecutiveKpisProps {
  section: DashboardSectionState<ExecutiveKpisSummary>;
}

export function DashboardExecutiveKpis({ section }: DashboardExecutiveKpisProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <div className="rounded-2xl border border-warning-border bg-warning-bg p-5 text-warning">
        <p className="text-sm font-bold">Không thể tải số liệu KPI tổng quan</p>
        <p className="mt-1 text-xs text-ink-muted">
          Dữ liệu tài chính và học viên tạm thời không phản hồi. Vui lòng thử tải lại trang.
        </p>
      </div>
    );
  }

  const data = section.data;

  return (
    <section aria-label="Các chỉ số điều hành chính" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        badgeColor="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
        icon={<Users className="h-5 w-5 text-indigo-600" />}
        label="Tổng học sinh"
        tooltip="Số học viên đang hoạt động trong kỳ"
        trend={data.totalStudentsChangePercent}
        trendLabel="so với kỳ trước"
        value={`${formatNumber(data.totalStudents)}`}
      />

      <KpiCard
        badgeColor="text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40"
        compactValue={formatCompactVnd(data.revenueVnd)}
        icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
        label="Doanh thu"
        tooltip={formatVnd(data.revenueVnd)}
        trend={data.revenueChangePercent}
        trendLabel="so với tháng trước"
        value={formatCompactVnd(data.revenueVnd)}
      />

      <KpiCard
        badgeColor="text-amber-700 bg-amber-50 dark:bg-amber-950/40"
        compactValue={formatCompactVnd(data.disbursementVnd)}
        icon={<DollarSign className="h-5 w-5 text-amber-600" />}
        label="Chi phí"
        tooltip={formatVnd(data.disbursementVnd)}
        trend={data.disbursementChangePercent}
        trendInverted
        trendLabel="so với tháng trước"
        value={formatCompactVnd(data.disbursementVnd)}
      />

      <KpiCard
        badgeColor="text-violet-700 bg-violet-50 dark:bg-violet-950/40"
        compactValue={formatCompactVnd(data.netCashflowVnd)}
        icon={<Banknote className="h-5 w-5 text-violet-600" />}
        label="Dòng tiền ròng"
        tooltip={`Thu trừ chi: ${formatVnd(data.netCashflowVnd)}`}
        trend={data.netCashflowChangePercent}
        trendLabel="so với tháng trước"
        value={formatCompactVnd(data.netCashflowVnd)}
      />

      <KpiCard
        badgeColor="text-rose-700 bg-rose-50 dark:bg-rose-950/40"
        compactValue={formatCompactVnd(data.receivablesVnd)}
        icon={<Receipt className="h-5 w-5 text-rose-600" />}
        label="Công nợ phải thu"
        tooltip={`Tổng tiền chưa thu: ${formatVnd(data.receivablesVnd)}`}
        trend={null}
        trendLabel="chưa hoàn tất thu"
        value={formatCompactVnd(data.receivablesVnd)}
      />
    </section>
  );
}

interface KpiCardProps {
  badgeColor?: string;
  compactValue?: string;
  icon: ReactNode;
  label: string;
  tooltip?: string;
  trend: number | null;
  trendInverted?: boolean;
  trendLabel?: string;
  value: string;
}

function KpiCard({
  badgeColor = "text-primary bg-primary/10",
  icon,
  label,
  tooltip,
  trend,
  trendInverted = false,
  trendLabel,
  value,
}: KpiCardProps) {
  const { direction, formatted } = formatTrendPercent(trend);

  // For cost: going down is good (success), going up is warning
  const isPositiveOutcome = trendInverted ? direction === "down" : direction === "up";
  const isNegativeOutcome = trendInverted ? direction === "up" : direction === "down";

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs transition hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {label}
        </span>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badgeColor}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <p
          className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl"
          title={tooltip}
        >
          {value}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
        {trend !== null ? (
          <span
            className={`inline-flex items-center gap-0.5 font-bold ${
              isPositiveOutcome
                ? "text-success"
                : isNegativeOutcome
                  ? "text-danger"
                  : "text-ink-subtle"
            }`}
          >
            {direction === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : direction === "down" ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : null}
            {formatted}
          </span>
        ) : null}
        {trendLabel ? (
          <span className="truncate text-ink-subtle">{trendLabel}</span>
        ) : null}
      </div>
    </Card>
  );
}
