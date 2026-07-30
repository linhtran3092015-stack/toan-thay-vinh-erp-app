import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ReportsPage } from "@/features/reports/reports-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function ReportsRoute() {
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập trung tâm Báo cáo."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "reports.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền reports.view."
        title="Không có quyền xem Báo cáo"
      />
    );
  }

  return (
    <ReportsPage
      permissions={
        permissionResult.permissions
      }
    />
  );
}
