import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { AccountManagementPage } from "@/features/settings/account-management-page";
import {
  getCurrentOwnerStatus,
  getSettingsAccountInvitations,
  getSettingsPermissionMatrix,
} from "@/features/settings/data";
import { getStaffDirectory } from "@/features/staff/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function SettingsUsersRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền xem danh sách người dùng."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("staff.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("staff.view")}
        title="Không có quyền xem người dùng"
      />
    );
  }

  const [directoryResult, matrixResult, ownerStatus] = await Promise.all([
    getStaffDirectory({ includeRoles: true }),
    getSettingsPermissionMatrix(),
    getCurrentOwnerStatus(),
  ]);

  if (!directoryResult.ok) {
    return (
      <ErrorState
        description={directoryResult.error.message}
        title="Không tải được danh sách người dùng"
      />
    );
  }

  if (!matrixResult.ok) {
    return (
      <ErrorState
        description={matrixResult.error.message}
        title="Không tải được danh mục vai trò"
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

  const invitationsResult = ownerStatus.isOwner
    ? await getSettingsAccountInvitations()
    : { invitations: [], ok: true as const };

  if (!invitationsResult.ok) {
    return (
      <ErrorState
        description={invitationsResult.error.message}
        title="Không tải được tài khoản đang chờ"
      />
    );
  }

  return (
    <AccountManagementPage
      canManage={ownerStatus.isOwner}
      invitations={invitationsResult.invitations}
      members={directoryResult.members}
      roleOptions={directoryResult.roleOptions ?? []}
      roles={matrixResult.data.roles}
    />
  );
}
