import { ErrorState } from "@/components/shared/error-state";
import {
  getCurrentOwnerStatus,
  getSettingsPermissionMatrix,
} from "@/features/settings/data";
import { SettingsOverviewPage } from "@/features/settings/settings-overview-page";
import { getStaffDirectory } from "@/features/staff/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function SettingsRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập cài đặt."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const canViewUsers = permissionResult.permissions.includes("staff.view");
  const [matrixResult, directoryResult, ownerStatus] = await Promise.all([
    getSettingsPermissionMatrix(),
    canViewUsers
      ? getStaffDirectory({ includeRoles: true })
      : Promise.resolve(null),
    getCurrentOwnerStatus(),
  ]);

  if (!matrixResult.ok) {
    return (
      <ErrorState
        description={matrixResult.error.message}
        title="Không tải được cấu hình phân quyền"
      />
    );
  }

  if (directoryResult && !directoryResult.ok) {
    return (
      <ErrorState
        description={directoryResult.error.message}
        title="Không tải được danh sách người dùng"
      />
    );
  }

  if (!ownerStatus.ok) {
    return (
      <ErrorState
        description={ownerStatus.error}
        title="Không xác minh được quyền Owner"
      />
    );
  }

  return (
    <SettingsOverviewPage
      canManageRoles={ownerStatus.isOwner}
      canViewAudit={permissionResult.permissions.includes("audit.view")}
      canViewUsers={canViewUsers}
      matrix={matrixResult.data}
      members={directoryResult?.ok ? directoryResult.members : null}
    />
  );
}
