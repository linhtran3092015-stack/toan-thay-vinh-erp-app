import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { AdvanceListPage } from "@/features/advances/advance-list-page";
import { getSalaryAdvancesDashboardResult } from "@/features/advances/data";
import { getCachedCurrentAuthUser } from "@/features/auth/current-user";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function AdvancesRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập tạm ứng."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("advances.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("advances.view")}
        title="Không có quyền xem tạm ứng"
      />
    );
  }

  // The viewer id only sets their own rows apart (the RPCs refuse a self-decision);
  // it is the per-request cached user the layout already read.
  const [advancesResult, authResult] = await Promise.all([
    getSalaryAdvancesDashboardResult(),
    getCachedCurrentAuthUser(),
  ]);

  if (!advancesResult.ok) {
    return (
      <ErrorState
        description="Không tải được dữ liệu tạm ứng từ hệ thống."
        title="Không tải được tạm ứng"
      />
    );
  }

  const canRequest = permissionResult.permissions.includes("advances.request");
  const canReview = permissionResult.permissions.includes("advances.review");
  const canApprove = permissionResult.permissions.includes(
    "advances.owner_approve",
  );

  if (advancesResult.data.length === 0 && !canRequest) {
    return (
      <EmptyState
        description="Chưa có yêu cầu tạm ứng nào thuộc phạm vi tài khoản hiện tại."
        title="Chưa có yêu cầu tạm ứng"
      />
    );
  }

  return (
    <AdvanceListPage
      canApprove={canApprove}
      canRequest={canRequest}
      canReview={canReview}
      canViewPayroll={permissionResult.permissions.includes("payroll.view")}
      entries={advancesResult.data}
      today={getVietnamToday()}
      viewerId={authResult.ok ? authResult.user.id : null}
    />
  );
}
