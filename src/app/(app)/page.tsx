import { Suspense } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { DashboardHome } from "@/features/dashboard/components/home/dashboard-home";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { getRoleAwareDashboardReadModel } from "@/features/dashboard/data";
import { getDashboardHomeReadModel } from "@/features/dashboard/home-data";
import { StaffLiveEstimateCard } from "@/features/payroll/estimate/components/staff-live-estimate-card";
import { getCenterDisplayName } from "@/features/settings/system-settings-data";
import { StudentCareDashboardCard } from "@/features/student-care/dashboard-card";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

interface PageProps {
  searchParams?: Promise<{
    month?: string;
  }>;
}

/**
 * Home dashboard (design 02). The redesigned blocks come from
 * getDashboardHomeReadModel; the existing executive analytics stay below as
 * "Phân tích" with their own section gating. Dropped design blocks are listed
 * at the top of features/dashboard/components/home/dashboard-home.tsx.
 */
export default async function Home({ searchParams }: PageProps) {
  const [permissionResult, resolvedSearchParams] = await Promise.all([
    getCachedDatabasePermissions(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Dashboard."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const permissions = permissionResult.permissions;

  if (!permissions.includes("dashboard.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("dashboard.view")}
        title="Không có quyền xem Dashboard"
      />
    );
  }

  // A malformed month (e.g. 2026-13) would fail the executive RPC, and with it
  // the home work list; fall back to the current month instead.
  const monthParam = resolvedSearchParams?.month;
  const requestedMonth = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : undefined;

  // A failed executive read hides the analytics and fails its home feeds; the rest of the page still renders.
  const dashboardPromise = getRoleAwareDashboardReadModel(permissions, requestedMonth).catch(() => null);
  const [dashboard, home, centerDisplayName] = await Promise.all([
    dashboardPromise,
    getDashboardHomeReadModel(permissions, dashboardPromise),
    getCenterDisplayName(),
  ]);
  const retryHref = requestedMonth ? `/?month=${requestedMonth}` : "/";

  return (
    <DashboardHome
      analytics={
        dashboard ? (
          <DashboardPage
            dashboard={dashboard}
            studentCare={
              <Suspense fallback={<p className="text-secondary text-text-muted">Đang tải chăm sóc học viên…</p>}>
                <StudentCareDashboardCard />
              </Suspense>
            }
          />
        ) : (
          <ErrorState description="Phần phân tích chưa tải được; các khối phía trên vẫn dùng được." title="Không tải được số liệu phân tích" />
        )
      }
      centerDisplayName={centerDisplayName}
      model={home}
      payrollEstimate={
        permissions.includes("payroll.view") ? (
          <StaffLiveEstimateCard month={`${home.today.slice(0, 7)}-01`} />
        ) : undefined
      }
      retryHref={retryHref}
    />
  );
}
