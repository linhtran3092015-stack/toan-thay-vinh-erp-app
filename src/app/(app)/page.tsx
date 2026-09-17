import { ErrorState } from "@/components/shared/error-state";
import { Suspense } from "react";
import { StudentCareDashboardCard } from "@/features/student-care/dashboard-card";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCachedCurrentAuthUser } from "@/features/auth/current-user";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { getRoleAwareDashboardReadModel } from "@/features/dashboard/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface PageProps {
  searchParams?: Promise<{
    month?: string;
  }>;
}

export default async function Home({ searchParams }: PageProps) {
  const [permissionResult, authResult, resolvedSearchParams] = await Promise.all([
    getCachedDatabasePermissions(),
    getCachedCurrentAuthUser(),
    searchParams ? await searchParams : Promise.resolve(undefined),
  ]);

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Dashboard."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "dashboard.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền dashboard.view."
        title="Không có quyền xem Dashboard"
      />
    );
  }

  const requestedMonth = resolvedSearchParams?.month;

  const dashboard = await getRoleAwareDashboardReadModel(
    permissionResult.permissions,
    requestedMonth,
  );

  const userDisplayName = authResult.ok ? authResult.user.displayName : null;

  return (
    <div className="space-y-5">
    <Suspense fallback={<p>Đang tải chăm sóc học viên…</p>}><StudentCareDashboardCard /></Suspense>
    <DashboardPage
      dashboard={dashboard}
      userDisplayName={userDisplayName}
    />
    </div>
  );
}
