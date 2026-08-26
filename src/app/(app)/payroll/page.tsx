import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCurrentAuthUser } from "@/features/auth/current-user";
import { getPayrollManagementOverviewResult, getPayrollPeriodsWithDetailsResult } from "@/features/payroll/data";
import { PayrollPage } from "@/features/payroll/payroll-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function PayrollRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập bảng lương."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("payroll.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền payroll.view."
        title="Không có quyền xem bảng lương"
      />
    );
  }

  const canResolveFeedback = permissionResult.permissions.includes(
    "payroll.feedback.resolve",
  );
  const canImport = permissionResult.permissions.includes("payroll.import");
  const canManage = permissionResult.permissions.includes("payroll.manage");
  const canReconcile = permissionResult.permissions.includes(
    "payroll.accountant_reconcile",
  );
  const canApprove = permissionResult.permissions.includes(
    "payroll.owner_approve",
  );
  const canViewManagement = canManage || canReconcile || canApprove;
  const [payrollResult, authUserResult, correctionsResult] = await Promise.all([
    getPayrollPeriodsWithDetailsResult(),
    getCurrentAuthUser(),
    canViewManagement ? getPayrollManagementOverviewResult() : Promise.resolve({ data: { correctionRequests: [], importBatches: [], issues: [] }, ok: true } as const),
  ]);

  if (!payrollResult.ok || !authUserResult.ok || !correctionsResult.ok) {
    return (
      <ErrorState
        description="Không tải được dữ liệu bảng lương từ hệ thống."
        title="Không tải được bảng lương"
      />
    );
  }

  if (payrollResult.data.length === 0 && !canManage) {
    return (
      <EmptyState
        description="Chưa có bảng lương nào thuộc phạm vi tài khoản hiện tại."
        title="Chưa có bảng lương"
      />
    );
  }

  return (
    <PayrollPage
      canApprove={canApprove}
      canImport={canImport}
      canManage={canManage}
      canReconcile={canReconcile}
      canResolveFeedback={canResolveFeedback}
      currentStaffId={authUserResult.user.id}
      correctionRequests={correctionsResult.data.correctionRequests}
      importBatches={correctionsResult.data.importBatches}
      issues={correctionsResult.data.issues}
      periods={payrollResult.data}
    />
  );
}
