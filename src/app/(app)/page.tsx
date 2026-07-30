import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getRoleAwareDashboardReadModel } from "@/features/dashboard/data";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function Home() {
  const permissionResult =
    await getCachedDatabasePermissions();

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

  const dashboard =
    await getRoleAwareDashboardReadModel(
      permissionResult.permissions,
    );

  return <DashboardPage dashboard={dashboard} />;
}
