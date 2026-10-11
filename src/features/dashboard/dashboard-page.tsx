import type { RoleAwareDashboardReadModel } from "@/features/dashboard/read-models";
import { DashboardHeader } from "./components/dashboard-header";
import { DashboardExecutiveKpis } from "./components/dashboard-executive-kpis";
import { DashboardAttentionPanel } from "./components/dashboard-attention-panel";
import { DashboardRevenueTrendChart } from "./components/dashboard-revenue-trend-chart";
import { DashboardRevenueCompositionChart } from "./components/dashboard-revenue-composition-chart";
import { DashboardTopClassesChart } from "./components/dashboard-top-classes-chart";
import { DashboardAdmissionsFunnel } from "./components/dashboard-admissions-funnel";
import { DashboardStudentStatusChart } from "./components/dashboard-student-status-chart";
import { DashboardReceivablesAgingChart } from "./components/dashboard-receivables-aging-chart";
import { DashboardPayrollSummaryCard } from "./components/dashboard-payroll-summary-card";
import { DashboardOperationalHighlights } from "./components/dashboard-operational-highlights";

interface DashboardPageProps {
  centerDisplayName?: string;
  dashboard: RoleAwareDashboardReadModel;
  todayPanel?: React.ReactNode;
  userDisplayName?: string | null;
}

export function DashboardPage({
  centerDisplayName,
  dashboard,
  todayPanel,
  userDisplayName,
}: DashboardPageProps) {
  const sections = [
    dashboard.kpis,
    dashboard.attention,
    dashboard.revenueTrend,
    dashboard.revenueComposition,
    dashboard.topClasses,
    dashboard.admissionsFunnel,
    dashboard.studentStatus,
    dashboard.receivablesAging,
    dashboard.payrollSummary,
    dashboard.operationalHighlights,
  ];

  const visibleCount = sections.filter((s) => s.status !== "hidden").length;

  return (
    <div className="grid min-w-0 gap-6 pb-12">
      {/* 1. Executive Header */}
      <DashboardHeader
        availableMonths={dashboard.availableMonths}
        centerDisplayName={centerDisplayName}
        displayName={userDisplayName}
        lastUpdatedAt={dashboard.lastUpdatedAt}
        selectedMonth={dashboard.selectedMonth}
      />

      {todayPanel}

      {visibleCount === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface-1 p-8 text-center shadow-xs">
          <p className="font-display text-base font-bold text-ink">
            Chưa có quyền xem các khối dữ liệu chuyên sâu
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted sm:text-sm">
            Việc hôm nay của bạn hiển thị ở trên. Các khối tài chính, tuyển sinh, học vụ, nhân sự chỉ hiện với tài khoản được cấp quyền tương ứng.
          </p>
        </div>
      ) : null}

      {/* 2. Executive Top 5 KPIs */}
      <DashboardExecutiveKpis section={dashboard.kpis} />

      {/* 3. Attention Center */}
      <DashboardAttentionPanel section={dashboard.attention} />

      {/* 4. Financial Charts: Revenue Trend & Revenue Breakdown */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7 xl:col-span-8">
          <DashboardRevenueTrendChart
            availableYears={dashboard.availableYears}
            section={dashboard.revenueTrend}
            selectedYear={dashboard.selectedYear}
          />
        </div>
        <div className="min-w-0 lg:col-span-5 xl:col-span-4">
          <DashboardRevenueCompositionChart
            section={dashboard.revenueComposition}
          />
        </div>
      </div>

      {/* 5. Admissions Funnel & Student Status */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <DashboardAdmissionsFunnel section={dashboard.admissionsFunnel} />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <DashboardStudentStatusChart section={dashboard.studentStatus} />
        </div>
      </div>

      {/* 6. Top Classes & Receivables Aging */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-6">
          <DashboardTopClassesChart section={dashboard.topClasses} />
        </div>
        <div className="min-w-0 lg:col-span-6">
          <DashboardReceivablesAgingChart
            section={dashboard.receivablesAging}
          />
        </div>
      </div>

      {/* 7. Payroll Summary Card */}
      <DashboardPayrollSummaryCard
        section={dashboard.payrollSummary}
        selectedMonth={dashboard.selectedMonth}
      />

      {/* 8. Operational Highlights */}
      <DashboardOperationalHighlights
        section={dashboard.operationalHighlights}
      />

      {/* Security & RLS Footer Notice */}
      <footer className="rounded-xl border border-hairline bg-surface-2 p-4 text-center">
        <p className="text-xs leading-relaxed text-ink-muted">
          Dữ liệu điều hành được tổng hợp trực tiếp theo thời gian thực từ cơ sở dữ liệu và bảo vệ nghiêm ngặt bởi phân quyền Role-Based Access Control (RBAC) & Row-Level Security (RLS).
        </p>
      </footer>
    </div>
  );
}
