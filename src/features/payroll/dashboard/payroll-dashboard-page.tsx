import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Lightbulb,
  Minus,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { PayrollByPositionBars, PayrollByPositionDonut, PayrollCompositionChart, PayrollTrendChart } from "@/features/payroll/dashboard/components/payroll-dashboard-charts";
import { PayrollPositionSummaryTable } from "@/features/payroll/dashboard/components/payroll-position-summary-table";
import { formatCompactVnd, formatDashboardMonth, formatPercent, formatSignedPercent, formatVnd } from "@/features/payroll/dashboard/format";
import type { PayrollDashboardData, PayrollDashboardEmployee } from "@/features/payroll/dashboard/read-models";

export function OwnerPayrollDashboardPage({ dashboard }: { dashboard: PayrollDashboardData }) {
  const { summary } = dashboard;
  const isEmpty = summary.employeeCount === 0;

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-label font-semibold uppercase tracking-[0.12em] text-action-link">Lương nhân sự</p>
            {dashboard.periodStatus ? <PeriodStatusBadge status={dashboard.periodStatus} /> : null}
          </div>
          <h1 className="mt-1 text-page-title font-bold text-text-strong">Tổng quan quỹ lương</h1>
          <p className="mt-1 max-w-2xl text-secondary text-text-muted">Chi phí thực trả sau khấu trừ, lấy từ phiên tính lương hiện hành của từng kỳ.</p>
        </div>
        <PayrollDashboardFilters dashboard={dashboard} />
      </header>

      {isEmpty ? (
        <section className="rounded-lg border border-border-subtle bg-surface-base px-5 py-12 text-center">
          <CircleDollarSign aria-hidden="true" className="mx-auto text-text-subtle" size={34} strokeWidth={1.6} />
          <h2 className="mt-4 text-section-title font-semibold text-text-strong">Chưa có dữ liệu lương cho {formatDashboardMonth(dashboard.filters.selectedMonth).toLowerCase()}</h2>
          <p className="mx-auto mt-2 max-w-lg text-secondary text-text-muted">Bộ lọc vẫn được giữ nguyên. Bạn có thể chọn kỳ khác hoặc mở bảng lương để kiểm tra dữ liệu nguồn.</p>
          <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-action-primary px-4 text-control font-semibold text-text-on-primary hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href="/payroll">Xem bảng lương</Link>
        </section>
      ) : (
        <>
          <PayrollKpiGrid dashboard={dashboard} />

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
      )}
    </div>
  );
}

function PayrollDashboardFilters({ dashboard }: { dashboard: PayrollDashboardData }) {
  const currentMonth = dashboard.filters.selectedMonth.slice(0, 7);
  const monthOptions = new Map(dashboard.filters.availableMonths.map((period) => [period.month.slice(0, 7), period.month]));
  monthOptions.set(currentMonth, dashboard.filters.selectedMonth);
  return (
    <form className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-3 sm:grid-cols-[minmax(170px,1fr)_minmax(190px,1fr)_auto]" method="get">
      <label className="grid gap-1 text-label font-medium text-text-muted">
        Tháng
        <select className="h-10 rounded-md border border-border-subtle bg-field-bg px-3 text-control text-text-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" defaultValue={currentMonth} name="month">
          {[...monthOptions.keys()].sort((left, right) => right.localeCompare(left)).map((month) => (
            <option key={month} value={month}>{formatDashboardMonth(`${month}-01`)}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-label font-medium text-text-muted">
        Vị trí
        <select className="h-10 rounded-md border border-border-subtle bg-field-bg px-3 text-control text-text-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" defaultValue={dashboard.filters.selectedPositionCode ?? ""} name="position">
          <option value="">Tất cả vị trí</option>
          {dashboard.filters.positions.map((position) => <option key={position.code} value={position.code}>{position.name}</option>)}
        </select>
      </label>
      <button className="min-h-10 self-end rounded-md bg-action-primary px-4 text-control font-semibold text-text-on-primary hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" type="submit">Áp dụng</button>
    </form>
  );
}

function PayrollKpiGrid({ dashboard }: { dashboard: PayrollDashboardData }) {
  const { summary } = dashboard;
  const changeTone = summary.payrollChange > 0 ? "increase" : summary.payrollChange < 0 ? "decrease" : "neutral";
  return (
    <section className="grid gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-2 xl:grid-cols-5" aria-label="Chỉ số quỹ lương chính">
      <KpiCard
        helper={<ChangeLabel change={summary.payrollChange} percent={summary.payrollChangePercent} />}
        icon={<CircleDollarSign aria-hidden="true" size={19} />}
        label="Tổng chi phí lương"
        value={formatVnd(summary.totalPayroll)}
        valueClassName="text-[clamp(1.35rem,2vw,1.75rem)]"
      />
      <KpiCard
        helper={`${summary.employeeChange > 0 ? "+" : ""}${summary.employeeChange} so với tháng trước`}
        icon={<UsersRound aria-hidden="true" size={19} />}
        label="Nhân sự được tính lương"
        value={`${summary.employeeCount} nhân sự`}
      />
      <KpiCard
        helper="Tổng thực trả / số nhân sự"
        icon={<TrendingUp aria-hidden="true" size={19} />}
        label="Trung bình / nhân sự"
        value={formatVnd(Math.round(summary.averageSalary))}
      />
      <KpiCard
        helper={summary.highestPaidEmployee?.positionName ?? "Chưa có dữ liệu"}
        icon={<UserRound aria-hidden="true" size={19} />}
        label="Tổng lương cao nhất"
        value={summary.highestPaidEmployee?.staffDisplayName ?? "—"}
        secondaryValue={summary.highestPaidEmployee ? formatVnd(summary.highestPaidEmployee.currentPayroll) : undefined}
      />
      <KpiCard
        className="sm:col-span-2 xl:col-span-1"
        helper={summary.payrollChangePercent === null ? "Không có dữ liệu tháng trước" : `${formatSignedPercent(summary.payrollChangePercent)} so với tháng trước`}
        icon={changeTone === "increase" ? <ArrowUpRight aria-hidden="true" size={19} /> : changeTone === "decrease" ? <ArrowDownRight aria-hidden="true" size={19} /> : <Minus aria-hidden="true" size={19} />}
        label="Biến động payroll"
        tone={changeTone}
        value={`${summary.payrollChange > 0 ? "+" : ""}${formatVnd(summary.payrollChange)}`}
      />
    </section>
  );
}

function KpiCard({ className = "", helper, icon, label, secondaryValue, tone = "neutral", value, valueClassName = "" }: {
  className?: string;
  helper: ReactNode;
  icon: ReactNode;
  label: string;
  secondaryValue?: string;
  tone?: "decrease" | "increase" | "neutral";
  value: string;
  valueClassName?: string;
}) {
  const toneClass = tone === "increase" ? "text-status-warning" : tone === "decrease" ? "text-status-success" : "text-text-muted";
  return (
    <article className={`min-w-0 bg-surface-base p-4 xl:min-h-[164px] ${className}`}>
      <div className="flex items-center justify-between gap-3 text-text-muted">
        <p className="text-label font-medium">{label}</p>
        <span className={toneClass}>{icon}</span>
      </div>
      <p className={`mt-4 min-w-0 break-words tabular-nums text-xl font-bold leading-tight text-text-strong ${valueClassName}`} title={value}>{value}</p>
      {secondaryValue ? <p className="mt-1 tabular-nums text-secondary font-semibold text-text-default">{secondaryValue}</p> : null}
      <div className={`mt-3 text-caption ${toneClass}`}>{helper}</div>
    </article>
  );
}

function ChangeLabel({ change, percent }: { change: number; percent: number | null }) {
  if (percent === null) return <span>Không có dữ liệu tháng trước</span>;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  const className = change > 0 ? "text-status-warning" : change < 0 ? "text-status-success" : "text-text-muted";
  return <span className={`inline-flex items-center gap-1 ${className}`}><Icon aria-hidden="true" size={14} />{formatSignedPercent(percent)} so với tháng trước</span>;
}

function PayrollInsights({ insights }: { insights: readonly string[] }) {
  return (
    <section className="rounded-lg border border-status-info-border bg-status-info-soft p-4" aria-labelledby="payroll-insights-title">
      <div className="flex items-center gap-2 text-status-info">
        <Lightbulb aria-hidden="true" size={18} />
        <h2 className="text-body font-semibold" id="payroll-insights-title">Điểm đáng chú ý</h2>
      </div>
      <ul className="mt-3 grid gap-2 text-secondary text-text-default md:grid-cols-2">
        {insights.map((insight) => <li className="flex gap-2" key={insight}><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-status-info" />{insight}</li>)}
      </ul>
    </section>
  );
}

function TopEmployeesTable({ employees }: { employees: readonly PayrollDashboardEmployee[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base" aria-labelledby="top-payroll-employees-title">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-section-title font-semibold text-text-strong" id="top-payroll-employees-title">Top nhân sự có tổng lương cao nhất</h2>
        <p className="mt-1 text-secondary text-text-muted">Tối đa 10 nhân sự trong phạm vi bộ lọc.</p>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[720px] w-full text-table-body text-text-default">
          <caption className="sr-only">Top nhân sự có tổng lương cao nhất</caption>
          <thead className="bg-surface-sunken text-table-header">
            <tr><Header>Nhân sự</Header><Header>Vị trí</Header><Header align="right">Tổng lương</Header><Header align="right">% quỹ lương</Header><Header align="right">So tháng trước</Header></tr>
          </thead>
          <tbody>{employees.map((employee) => (
            <tr className="border-t border-border-subtle hover:bg-interactive-hover" key={employee.staffId}>
              <td className="h-14 px-4"><Link className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={`/staff/${employee.staffId}`}>{employee.staffDisplayName}</Link>{employee.staffEmployeeCode ? <p className="mt-0.5 font-mono text-caption text-text-muted">{employee.staffEmployeeCode}</p> : null}</td>
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
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link className="truncate font-semibold text-action-link" href={`/staff/${employee.staffId}`}>{employee.staffDisplayName}</Link><p className="mt-0.5 text-caption text-text-muted">{employee.positionName}</p></div><EmployeeChange employee={employee} /></div>
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
    <section className="rounded-lg border border-border-subtle bg-surface-base p-5" aria-labelledby="significant-payroll-changes-title">
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
      <div className="flex items-start justify-between gap-3"><Link className="min-w-0 truncate text-secondary font-semibold text-action-link hover:underline" href={`/staff/${employee.staffId}`}>{employee.staffDisplayName}</Link><span className={`shrink-0 tabular-nums text-secondary font-semibold ${tone === "increase" ? "text-status-warning" : "text-status-success"}`}>{employee.changePercent === null ? employee.isNew ? "Mới" : "—" : formatSignedPercent(employee.changePercent)}</span></div>
      <p className="mt-1 tabular-nums text-caption text-text-muted">{formatCompactVnd(employee.previousPayroll)} → {formatCompactVnd(employee.currentPayroll)}</p>
    </article>
  ))}</div></div>;
}

function EmployeeChange({ employee }: { employee: PayrollDashboardEmployee }) {
  if (employee.isNew) return <Badge tone="info">Mới</Badge>;
  if (employee.changePercent === null) return <span className="text-caption text-text-muted">—</span>;
  const tone = employee.change > 0 ? "text-status-warning" : employee.change < 0 ? "text-status-success" : "text-text-muted";
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
