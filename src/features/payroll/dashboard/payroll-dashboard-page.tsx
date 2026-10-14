import { CircleDollarSign, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { PayrollByPositionBars, PayrollByPositionDonut, PayrollCompositionChart, PayrollTrendChart } from "@/features/payroll/dashboard/components/payroll-dashboard-charts";
import { PayrollFiguresStrip } from "@/features/payroll/dashboard/components/payroll-figures-strip";
import { PayrollPositionSummaryTable } from "@/features/payroll/dashboard/components/payroll-position-summary-table";
import { formatCompactVnd, formatDashboardMonth, formatPercent, formatShortMonth, formatSignedPercent, formatVnd } from "@/features/payroll/dashboard/format";
import {
  buildPayrollHeaderContext,
  buildStatementFigures,
  getOutstandingPayrollTask,
  getPayrollHeaderBadge,
} from "@/features/payroll/dashboard/overview-model";
import type { PayrollDashboardData, PayrollDashboardEmployee } from "@/features/payroll/dashboard/read-models";
import { getCurrentPayrollMonth } from "@/features/payroll/dashboard/url-state";
import { OwnerLiveEstimateOverview } from "@/features/payroll/estimate/components/owner-live-estimate-overview";
import type { OwnerPayrollEstimate } from "@/features/payroll/estimate/types";
import type { PayrollEstimateTransport } from "@/features/payroll/estimate/use-payroll-live-estimate";

interface OwnerPayrollDashboardPageProps {
  /** Viewer holds payroll.owner_approve: a period in review is their outstanding task. */
  canApprove?: boolean;
  dashboard: PayrollDashboardData;
  /** Dev preview only: inert estimate transport (fixtures, no realtime). */
  estimateTransport?: PayrollEstimateTransport;
  initialOwnerEstimate?: OwnerPayrollEstimate | null;
  /** Ghi đè "hôm nay" (YYYY-MM-DD) cho bảng lương theo ngày; dùng trong kiểm thử / bản xem trước. */
  today?: string;
}

const controlClassName =
  "h-10 min-w-0 rounded-md border border-border-strong bg-field-bg px-3 text-control text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus max-md:h-11 max-md:w-full";

/**
 * Quỹ lương tháng (design 8a): header with the live status and the real
 * outstanding task as the only primary, the live estimate (figures strip,
 * staff table, per-staff daily ledger), then the period analytics.
 */
export function OwnerPayrollDashboardPage({
  canApprove = false,
  dashboard,
  estimateTransport,
  initialOwnerEstimate,
  today,
}: OwnerPayrollDashboardPageProps) {
  const { summary } = dashboard;
  const selectedMonth = dashboard.filters.selectedMonth;
  const isApproved = dashboard.periodStatus === "approved";
  const hasEstimateData =
    Boolean(initialOwnerEstimate?.summary?.staffCount) ||
    Boolean(initialOwnerEstimate?.statements?.length);
  const isEmpty = summary.employeeCount === 0 && !hasEstimateData;
  const badge = getPayrollHeaderBadge(initialOwnerEstimate ?? null, dashboard.periodStatus);
  const context = buildPayrollHeaderContext(initialOwnerEstimate ?? null, dashboard);
  const task = getOutstandingPayrollTask(dashboard.filters.availableMonths, canApprove);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={
          task ? (
            <Link className={getButtonClassName({ className: "max-md:h-11 max-md:w-full", variant: "primary" })} href={task.href}>
              {task.label}
            </Link>
          ) : undefined
        }
        context={badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
        title={`Quỹ lương tháng ${formatShortMonth(selectedMonth)}`}
      >
        {context.length > 0 ? <p className="mt-1 max-w-3xl text-secondary text-text-muted">{context.join(" · ")}</p> : null}
        {/* Filters sit under the context line so the header never overflows beside the sidebar. */}
        <div className="mt-3">
          <PayrollDashboardFilters dashboard={dashboard} />
        </div>
      </PageHeader>

      {/* Lương tạm tính phát sinh & đối chiếu thực thu */}
      <OwnerLiveEstimateOverview
        initialEstimate={initialOwnerEstimate}
        month={selectedMonth}
        positionCode={dashboard.filters.selectedPositionCode}
        today={today}
        transport={estimateTransport}
      />

      <section aria-labelledby="payroll-analysis-heading" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 border-t border-border-subtle pt-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-section-title font-semibold text-text-strong" id="payroll-analysis-heading">Phân tích</h2>
            {dashboard.periodStatus ? <PeriodStatusBadge status={dashboard.periodStatus} /> : null}
          </div>
          <p className="mt-1 text-secondary text-text-muted">
            {isApproved ? "Thống kê phiên lương đã duyệt" : "Phân tích phiên tính lương nháp"} của bảng lương {formatDashboardMonth(selectedMonth).toLowerCase()}.
          </p>
        </div>

        {isEmpty ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface-base px-5 py-12 text-center">
            <CircleDollarSign aria-hidden="true" className="mx-auto text-text-subtle" size={28} strokeWidth={1.6} />
            <h3 className="mt-3 text-section-title font-semibold text-text-strong">Chưa có dữ liệu lương cho {formatDashboardMonth(selectedMonth).toLowerCase()}</h3>
            <p className="mx-auto mt-2 max-w-lg text-secondary text-text-muted">Bộ lọc vẫn được giữ nguyên. Bạn có thể chọn kỳ khác hoặc mở bảng lương để kiểm tra dữ liệu nguồn.</p>
            <Link className={getButtonClassName({ className: "mt-5 max-md:h-11", variant: "secondary" })} href="/payroll">Xem bảng lương</Link>
          </div>
        ) : summary.employeeCount > 0 ? (
          <>
            <PayrollFiguresStrip figures={buildStatementFigures(summary)} label="Chỉ số quỹ lương chính" />

            {dashboard.insights.length > 0 ? <PayrollInsights insights={dashboard.insights} /> : null}

            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              <PayrollByPositionDonut items={dashboard.byPosition} totalPayroll={summary.totalPayroll} />
              <PayrollByPositionBars items={dashboard.byPosition} />
            </div>

            <PayrollTrendChart items={dashboard.trend} />

            {dashboard.composition.length > 0 ? (
              <PayrollCompositionChart items={dashboard.composition} netPayroll={summary.totalPayroll} />
            ) : null}

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <TopEmployeesTable employees={dashboard.topEmployees} />
              <SignificantChanges changes={dashboard.significantChanges} />
            </div>

            <PayrollPositionSummaryTable items={dashboard.byPosition} />
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border-strong bg-surface-base px-4 py-6 text-center text-secondary text-text-muted">
            Chưa có bảng lương kỳ {formatShortMonth(selectedMonth)} để phân tích. Số liệu tạm tính ở trên cập nhật theo chấm công.
          </p>
        )}
      </section>
    </div>
  );
}

function PayrollDashboardFilters({ dashboard }: { dashboard: PayrollDashboardData }) {
  const currentMonth = dashboard.filters.selectedMonth.slice(0, 7);
  const ongoingMonth = getCurrentPayrollMonth().slice(0, 7);
  const monthOptions = new Map(dashboard.filters.availableMonths.map((period) => [period.month.slice(0, 7), period.month]));
  monthOptions.set(currentMonth, dashboard.filters.selectedMonth);
  monthOptions.set(ongoingMonth, `${ongoingMonth}-01`);

  return (
    <form aria-label="Lọc quỹ lương" className="flex flex-wrap items-center gap-2 max-md:w-full" method="get">
      <label className="max-md:w-full">
        <span className="sr-only">Tháng</span>
        <select className={controlClassName} defaultValue={currentMonth} name="month">
          {[...monthOptions.keys()].sort((left, right) => right.localeCompare(left)).map((month) => (
            <option key={month} value={month}>
              {formatDashboardMonth(`${month}-01`)}
              {month === ongoingMonth ? " (Hiện tại)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="max-md:w-full">
        <span className="sr-only">Vị trí</span>
        <select className={controlClassName} defaultValue={dashboard.filters.selectedPositionCode ?? ""} name="position">
          <option value="">Tất cả vị trí</option>
          {dashboard.filters.positions.map((position) => <option key={position.code} value={position.code}>{position.name}</option>)}
        </select>
      </label>
      <button className={getButtonClassName({ className: "max-md:h-11 max-md:w-full", variant: "secondary" })} type="submit">Áp dụng</button>
    </form>
  );
}

function PayrollInsights({ insights }: { insights: readonly string[] }) {
  return (
    <section className="rounded-lg border border-info-border bg-info-bg p-4" aria-labelledby="payroll-insights-title">
      <div className="flex items-center gap-2 text-info-ink">
        <Lightbulb aria-hidden="true" size={18} />
        <h2 className="text-body font-semibold" id="payroll-insights-title">Điểm đáng chú ý</h2>
      </div>
      <ul className="mt-3 grid gap-2 text-secondary text-text-default md:grid-cols-2">
        {insights.map((insight) => <li className="flex gap-2" key={insight}><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-info" />{insight}</li>)}
      </ul>
    </section>
  );
}

function TopEmployeesTable({ employees }: { employees: readonly PayrollDashboardEmployee[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]" aria-labelledby="top-payroll-employees-title">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-section-title font-semibold text-text-strong" id="top-payroll-employees-title">Top nhân sự có tổng lương cao nhất</h2>
        <p className="mt-1 text-secondary text-text-muted">Tối đa 10 nhân sự trong phạm vi bộ lọc.</p>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[720px] w-full text-table-body text-text-default">
          <caption className="sr-only">Top nhân sự có tổng lương cao nhất</caption>
          <thead className="bg-table-header text-table-header text-text-muted">
            <tr><Header>Nhân sự</Header><Header>Vị trí</Header><Header align="right">Tổng lương</Header><Header align="right">% quỹ lương</Header><Header align="right">So tháng trước</Header></tr>
          </thead>
          <tbody>{employees.map((employee) => (
            <tr className="border-t border-border-row hover:bg-table-row-hover" key={employee.staffId}>
              <td className="h-14 px-4"><Link className="font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={`/staff/${employee.staffId}`}>{employee.staffDisplayName}</Link>{employee.staffEmployeeCode ? <p className="mt-0.5 font-mono text-caption text-text-muted">{employee.staffEmployeeCode}</p> : null}</td>
              <td className="h-14 px-4 text-secondary">{employee.positionName}</td>
              <td className="h-14 px-4 text-right tabular-nums font-semibold text-text-strong">{formatVnd(employee.currentPayroll)}</td>
              <td className="h-14 px-4 text-right tabular-nums">{formatPercent(employee.sharePercent)}</td>
              <td className="h-14 px-4 text-right"><EmployeeChange employee={employee} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="grid gap-3 p-4 md:hidden" role="list" aria-label="Top nhân sự có tổng lương cao nhất trên thiết bị nhỏ">
        {employees.map((employee) => (
          <article className="rounded-md border border-border-subtle p-4" key={employee.staffId} role="listitem">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link className="truncate font-semibold text-action-link!" href={`/staff/${employee.staffId}`}>{employee.staffDisplayName}</Link><p className="mt-0.5 text-caption text-text-muted">{employee.positionName}</p></div><EmployeeChange employee={employee} /></div>
            <p className="mt-3 tabular-nums text-body font-bold text-text-strong">{formatVnd(employee.currentPayroll)}</p>
            <p className="mt-1 text-caption text-text-muted">{formatPercent(employee.sharePercent)} tổng quỹ lương</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SignificantChanges({ changes }: { changes: PayrollDashboardData["significantChanges"] }) {
  const hasChanges = changes.increases.length > 0 || changes.decreases.length > 0;
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-base p-5 shadow-[var(--panel-shadow)]" aria-labelledby="significant-payroll-changes-title">
      <h2 className="text-section-title font-semibold text-text-strong" id="significant-payroll-changes-title">Biến động đáng chú ý</h2>
      <p className="mt-1 text-secondary text-text-muted">Ba mức tăng và giảm tuyệt đối lớn nhất.</p>
      {hasChanges ? <div className="mt-5 grid gap-5">
        {changes.increases.length > 0 ? <ChangeGroup employees={changes.increases} label="Tăng mạnh" tone="increase" /> : null}
        {changes.decreases.length > 0 ? <ChangeGroup employees={changes.decreases} label="Giảm mạnh" tone="decrease" /> : null}
      </div> : <p className="mt-5 rounded-md bg-surface-sunken px-4 py-5 text-center text-secondary text-text-muted">Chưa có biến động để so sánh.</p>}
    </section>
  );
}

function ChangeGroup({ employees, label, tone }: { employees: readonly PayrollDashboardEmployee[]; label: string; tone: "decrease" | "increase" }) {
  return <div><h3 className="text-label font-semibold uppercase tracking-wide text-text-muted">{label}</h3><div className="mt-2 grid gap-2">{employees.map((employee) => (
    <article className="rounded-md border border-border-subtle p-3" key={employee.staffId}>
      <div className="flex items-start justify-between gap-3"><Link className="min-w-0 truncate text-secondary font-semibold text-action-link! hover:underline" href={`/staff/${employee.staffId}`}>{employee.staffDisplayName}</Link><span className={`shrink-0 tabular-nums text-secondary font-semibold ${tone === "increase" ? "text-warning" : "text-success"}`}>{employee.changePercent === null ? employee.isNew ? "Mới" : "—" : formatSignedPercent(employee.changePercent)}</span></div>
      <p className="mt-1 tabular-nums text-caption text-text-muted">{formatCompactVnd(employee.previousPayroll)} → {formatCompactVnd(employee.currentPayroll)}</p>
    </article>
  ))}</div></div>;
}

function EmployeeChange({ employee }: { employee: PayrollDashboardEmployee }) {
  if (employee.isNew) return <Badge tone="info">Mới</Badge>;
  if (employee.changePercent === null) return <span className="text-caption text-text-muted">—</span>;
  const tone = employee.change > 0 ? "text-warning" : employee.change < 0 ? "text-success" : "text-text-muted";
  return <span className={`tabular-nums text-secondary font-semibold ${tone}`}>{formatSignedPercent(employee.changePercent)}</span>;
}

function Header({ align = "left", children }: { align?: "left" | "right"; children: ReactNode }) {
  return <th className={`h-10 px-4 font-semibold ${align === "right" ? "text-right" : "text-left"}`} scope="col">{children}</th>;
}

function PeriodStatusBadge({ status }: { status: string }) {
  const content = status === "approved"
    ? { label: "Đã duyệt", tone: "success" as const }
    : status === "review"
      ? { label: "Chờ đối soát", tone: "warning" as const }
      : status === "draft"
        ? { label: "Bản nháp", tone: "neutral" as const }
        : { label: `Trạng thái: ${status}`, tone: "neutral" as const };
  return <Badge tone={content.tone}>{content.label}</Badge>;
}
