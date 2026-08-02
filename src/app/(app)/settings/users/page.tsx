import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getStaffDirectory } from "@/features/staff/data";
import { StaffDirectoryPage } from "@/features/staff/staff-directory-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

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
        description="Tài khoản hiện tại không có quyền staff.view."
        title="Không có quyền xem người dùng"
      />
    );
  }

  const directoryResult = await getStaffDirectory({ includeRoles: true });

  if (!directoryResult.ok) {
    return (
      <ErrorState
        description={directoryResult.error.message}
        title="Không tải được danh sách người dùng"
      />
    );
  }

  if (directoryResult.members.length === 0) {
    return (
      <EmptyState
        description="Chưa có profile nào được đồng bộ từ Supabase Auth."
        title="Danh sách người dùng đang trống"
      />
    );
  }

  return (
    <StaffDirectoryPage
      canManageRoles={permissionResult.permissions.includes(
        "staff.roles.manage",
      )}
      canViewRoles
      description="Các tài khoản đã được đồng bộ từ Supabase Auth. Mọi thay đổi vai trò đều yêu cầu lý do và được ghi audit."
      eyebrow="Tài khoản truy cập"
      headingLevel={2}
      members={directoryResult.members}
      roleOptions={directoryResult.roleOptions ?? []}
      title="Người dùng và vai trò"
    />
  );
}
