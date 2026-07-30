import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { CommissionListPage } from "@/features/commissions/commission-list-page";
import { getSalesCommissionAccrualsDashboardResult } from "@/features/commissions/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function CommissionsRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập hoa hồng Sale."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("commissions.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền commissions.view."
        title="Không có quyền xem hoa hồng Sale"
      />
    );
  }

  const commissionsResult = await getSalesCommissionAccrualsDashboardResult();

  if (!commissionsResult.ok) {
    return (
      <ErrorState
        description="Không tải được dữ liệu doanh thu hoa hồng từ hệ thống."
        title="Không tải được hoa hồng Sale"
      />
    );
  }

  return (
    <CommissionListPage
      canManage={permissionResult.permissions.includes("commissions.manage")}
      entries={commissionsResult.data}
    />
  );
}
