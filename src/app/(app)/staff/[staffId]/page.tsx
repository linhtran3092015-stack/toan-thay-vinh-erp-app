import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCurrentAuthUser } from "@/features/auth/current-user";
import { getStaffDetail } from "@/features/staff/data";
import { StaffDetailPage } from "@/features/staff/staff-detail-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface StaffDetailRouteProps {
  params: Promise<{
    staffId: string;
  }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function StaffDetailRoute({
  params,
}: StaffDetailRouteProps) {
  const { staffId } = await params;
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền xem hồ sơ nhân sự."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("staff.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("staff.view")}
        title="Không có quyền xem hồ sơ nhân sự"
      />
    );
  }

  if (!UUID_PATTERN.test(staffId)) {
    return (
      <EmptyState
        description="Mã hồ sơ nhân sự trên đường dẫn không hợp lệ."
        title="Không tìm thấy hồ sơ nhân sự"
      />
    );
  }

  const authUserResult = await getCurrentAuthUser();

  if (!authUserResult.ok) {
    return (
      <ErrorState
        description="Không thể xác minh phiên đăng nhập hiện tại."
        title="Không tải được hồ sơ nhân sự"
      />
    );
  }

  const canViewRoles = permissionResult.permissions.includes(
    "staff.roles.view",
  );
  const canViewRateVersions =
    permissionResult.permissions.includes("staff.manage_rates") ||
    authUserResult.user.id === staffId;
  const canManageProfile = permissionResult.permissions.includes(
    "staff.manage",
  );
  const canManageRateVersions = permissionResult.permissions.includes(
    "staff.manage_rates",
  );
  const canManagePayrollProfile = permissionResult.permissions.includes(
    "staff.manage_payroll_profile",
  );
  const canSubmitBankAccount =
    authUserResult.user.id === staffId ||
    permissionResult.permissions.includes("staff.bank.manage");
  const canManageBankAccount = permissionResult.permissions.includes("staff.bank.manage");

  const detailResult = await getStaffDetail(staffId, {
    includePayrollProfile: true,
    includeRateVersions: canViewRateVersions,
    includeRoles: canViewRoles,
  });

  if (!detailResult.ok) {
    if (detailResult.error.code === "profile_not_found") {
      return (
        <EmptyState
          description="Hồ sơ không tồn tại hoặc tài khoản hiện tại không còn quyền truy cập."
          title="Không tìm thấy hồ sơ nhân sự"
        />
      );
    }

    return (
      <ErrorState
        description={detailResult.error.message}
        title="Không tải được hồ sơ nhân sự"
      />
    );
  }

  return (
    <StaffDetailPage
      canManageProfile={canManageProfile}
      canManageBankAccount={canManageBankAccount}
      canManagePayrollProfile={canManagePayrollProfile}
      canManageRateVersions={canManageRateVersions}
      canSubmitBankAccount={canSubmitBankAccount}
      canViewRateVersions={canViewRateVersions}
      canViewRoles={canViewRoles}
      detail={detailResult.detail}
    />
  );
}
