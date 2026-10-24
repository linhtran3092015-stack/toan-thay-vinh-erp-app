import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCurrentAuthUser } from "@/features/auth/current-user";
import { getPayrollManagementOverviewResult, getRecentPayrollPeriodsResult } from "@/features/payroll/data";
import { getUnreconciledReadMessage } from "@/features/payroll/read-models";
import { getMyPayrollEstimateResult } from "@/features/payroll/estimate/data";
import { PayrollPage } from "@/features/payroll/payroll-page";
import { parsePayrollPeriodCount, parsePayrollPeriodId } from "@/features/payroll/period-window";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function PayrollRoute({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[]; periods?: string | string[] }>;
}) {
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
        description={permissionDeniedDescription("payroll.view")}
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
  const now = new Date();
  const currentMonth = `${new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(now).slice(0, 7)}-01`;

  // The latest few periods (plus open ones); "?periods=" grows the window and
  // "?period=" names one more to show, e.g. from a Tạm ứng link.
  const search = await searchParams;
  const periodCount = parsePayrollPeriodCount(search.periods);
  const includedPeriodId = parsePayrollPeriodId(search.period);

  const [payrollResult, authUserResult, correctionsResult, estimateResult] = await Promise.all([
    getRecentPayrollPeriodsResult(periodCount, includedPeriodId),
    getCurrentAuthUser(),
    canViewManagement ? getPayrollManagementOverviewResult() : Promise.resolve({ data: { correctionRequests: [], importBatches: [], issues: [] }, ok: true } as const),
    getMyPayrollEstimateResult(currentMonth),
  ]);

  if (!payrollResult.ok || !authUserResult.ok || !correctionsResult.ok) {
    return (
      <ErrorState
        description={!payrollResult.ok && payrollResult.reason === "unreconciled"
          ? getUnreconciledReadMessage(canManage)
          : "Không tải được dữ liệu bảng lương từ hệ thống."}
        title="Không tải được bảng lương"
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
      correctionRequests={correctionsResult.data.correctionRequests}
      currentMonth={currentMonth}
      currentStaffId={authUserResult.user.id}
      importBatches={correctionsResult.data.importBatches}
      initialEstimate={estimateResult.ok ? estimateResult.data : null}
      issues={correctionsResult.data.issues}
      includedPeriodId={includedPeriodId}
      olderPeriodCount={payrollResult.data.olderPeriodCount}
      periodCount={periodCount}
      periods={payrollResult.data.periods}
    />
  );
}
