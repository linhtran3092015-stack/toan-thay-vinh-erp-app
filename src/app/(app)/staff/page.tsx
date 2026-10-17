import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getStaffDirectory } from "@/features/staff/data";
import { StaffDirectoryPage } from "@/features/staff/staff-directory-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function StaffRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập danh sách nhân sự."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("staff.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("staff.view")}
        title="Không có quyền xem danh sách nhân sự"
      />
    );
  }

  const canViewRoles =
    permissionResult.permissions.includes("staff.roles.view");

  const canManageRoles =
    canViewRoles &&
    permissionResult.permissions.includes("staff.roles.manage");

  // /settings/users also needs `settings.view` (settings layout gate).
  const canOpenAccounts = permissionResult.permissions.includes("settings.view");

  const directoryResult = await getStaffDirectory({
    includeRoles: canViewRoles,
  });

  if (!directoryResult.ok) {
    return (
      <ErrorState
        description={directoryResult.error.message}
        title="Không tải được danh sách nhân sự"
      />
    );
  }

  if (directoryResult.members.length === 0) {
    return (
      <EmptyState
        description="Chưa có hồ sơ nhân sự nào được đồng bộ từ Supabase Auth."
        title="Danh sách nhân sự đang trống"
      />
    );
  }

  return (
    <StaffDirectoryPage
      canManageRoles={canManageRoles}
      canOpenAccounts={canOpenAccounts}
      canViewRoles={canViewRoles}
      members={directoryResult.members}
      roleOptions={directoryResult.roleOptions ?? []}
    />
  );
}
