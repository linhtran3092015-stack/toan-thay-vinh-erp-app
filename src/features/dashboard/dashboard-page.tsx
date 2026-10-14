import type { ReactNode } from "react";

import type { RoleAwareDashboardReadModel } from "@/features/dashboard/read-models";
import { DashboardHeader } from "./components/dashboard-header";
import { DashboardExecutiveKpis } from "./components/dashboard-executive-kpis";
import { DashboardRevenueTrendChart } from "./components/dashboard-revenue-trend-chart";
import { DashboardRevenueCompositionChart } from "./components/dashboard-revenue-composition-chart";
import { DashboardTopClassesChart } from "./components/dashboard-top-classes-chart";
import { DashboardAdmissionsFunnel } from "./components/dashboard-admissions-funnel";
import { DashboardStudentStatusChart } from "./components/dashboard-student-status-chart";
import { DashboardReceivablesAgingChart } from "./components/dashboard-receivables-aging-chart";
import { DashboardPayrollSummaryCard } from "./components/dashboard-payroll-summary-card";
import { DashboardOperationalHighlights } from "./components/dashboard-operational-highlights";

interface DashboardPageProps {
  dashboard: RoleAwareDashboardReadModel;
  /** Month picker route; the dev preview passes its own path and query. */
  hrefBase?: string;
  /** Extra analytics block (the student-care card) placed after the charts. */
  studentCare?: ReactNode;
}

/**
 * Executive analytics, kept under the redesigned home dashboard as the
 * "Phân tích" section. Section gating is unchanged: each block renders from
 * its own section state and disappears when hidden. Its attention list moved
 * into the dashboard's "Cần bạn xử lý" block, so it is not repeated here.
 */
export function DashboardPage({ dashboard, hrefBase, studentCare }: DashboardPageProps) {
  const sections = [
    dashboard.kpis,
    dashboard.revenueTrend,
    dashboard.revenueComposition,
    dashboard.topClasses,
    dashboard.admissionsFunnel,
    dashboard.studentStatus,
    dashboard.receivablesAging,
    dashboard.payrollSummary,
    dashboard.operationalHighlights,
  ];

  const visibleCount = sections.filter((section) => section.status !== "hidden").length;

  if (visibleCount === 0 && !studentCare) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-analytics-title" className="grid min-w-0 gap-6">
      <DashboardHeader
        availableMonths={dashboard.availableMonths}
        hrefBase={hrefBase}
        lastUpdatedAt={dashboard.lastUpdatedAt}
        selectedMonth={dashboard.selectedMonth}
      />

      {/* Top executive KPIs */}
      <DashboardExecutiveKpis section={dashboard.kpis} />

      {/* Revenue trend & composition */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7 xl:col-span-8">
          <DashboardRevenueTrendChart
            availableYears={dashboard.availableYears}
            section={dashboard.revenueTrend}
            selectedYear={dashboard.selectedYear}
          />
        </div>
        <div className="min-w-0 lg:col-span-5 xl:col-span-4">
          <DashboardRevenueCompositionChart section={dashboard.revenueComposition} />
        </div>
      </div>

      {/* Admissions funnel & student status */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <DashboardAdmissionsFunnel section={dashboard.admissionsFunnel} />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <DashboardStudentStatusChart section={dashboard.studentStatus} />
        </div>
      </div>

      {/* Top classes & receivables aging */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-6">
          <DashboardTopClassesChart section={dashboard.topClasses} />
        </div>
        <div className="min-w-0 lg:col-span-6">
          <DashboardReceivablesAgingChart section={dashboard.receivablesAging} />
        </div>
      </div>

      {/* Payroll summary */}
      <DashboardPayrollSummaryCard section={dashboard.payrollSummary} selectedMonth={dashboard.selectedMonth} />

      {/* Operational highlights */}
      <DashboardOperationalHighlights section={dashboard.operationalHighlights} />

      {studentCare}
    </section>
  );
}
