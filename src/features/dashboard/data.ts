import "server-only";

import { getSalaryAdvancesDashboardResult } from "@/features/advances/data";
import { getCoachingRecordsDashboardResult } from "@/features/coaching/data";
import type {
  DashboardAdvanceSummary,
  DashboardCoachingSummary,
  DashboardFinanceSummary,
  DashboardGradingCreditSummary,
  DashboardPayrollSummary,
  DashboardSectionState,
  RoleAwareDashboardReadModel,
} from "@/features/dashboard/read-models";
import { getFinanceOverviewResult } from "@/features/finance/data";
import { getGradingCreditsDashboardResult } from "@/features/grading-credits/data";
import { getPayrollDashboardResult } from "@/features/payroll/data";
import type { PermissionCode } from "@/lib/permissions/types";

function hiddenSection<T>(): DashboardSectionState<T> {
  return { status: "hidden" };
}

function errorSection<T>(): DashboardSectionState<T> {
  return { status: "error" };
}

function readySection<T>(data: T): DashboardSectionState<T> {
  return {
    data,
    status: "ready",
  };
}

function hasPermission(
  permissions: readonly PermissionCode[],
  permission: PermissionCode,
): boolean {
  return permissions.includes(permission);
}

async function loadFinanceSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardFinanceSummary>> {
  if (!hasPermission(permissions, "finance.view")) {
    return hiddenSection();
  }

  const result = await getFinanceOverviewResult();

  if (!result.ok) {
    return errorSection();
  }

  const {
    disbursementVnd,
    receiptVnd,
    refundVnd,
  } = result.data.cashflowSummary;

  return readySection({
    disbursementVnd,
    netCashflowVnd:
      receiptVnd - disbursementVnd - refundVnd,
    paymentRequestCount:
      result.data.totalPaymentRequestsCount,
    receiptVnd,
    refundVnd,
  });
}

async function loadPayrollSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardPayrollSummary>> {
  if (!hasPermission(permissions, "payroll.view")) {
    return hiddenSection();
  }

  const result = await getPayrollDashboardResult();

  if (!result.ok) {
    return errorSection();
  }

  const entries = result.data;

  const latestPeriodMonth = entries.reduce<string | null>(
    (latest, entry) =>
      latest === null || entry.periodMonth > latest
        ? entry.periodMonth
        : latest,
    null,
  );

  return readySection({
    approvedStatementCount: entries.filter(
      (entry) => entry.periodStatus === "approved",
    ).length,
    draftStatementCount: entries.filter(
      (entry) => entry.periodStatus === "draft",
    ).length,
    latestPeriodMonth,
    reviewStatementCount: entries.filter(
      (entry) => entry.periodStatus === "review",
    ).length,
    statementCount: entries.length,
    totalPayableVnd: entries.reduce(
      (total, entry) => total + entry.payableAmountVnd,
      0,
    ),
  });
}

async function loadAdvanceSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardAdvanceSummary>> {
  if (!hasPermission(permissions, "advances.view")) {
    return hiddenSection();
  }

  const result =
    await getSalaryAdvancesDashboardResult();

  if (!result.ok) {
    return errorSection();
  }

  const entries = result.data;

  return readySection({
    approvedUndeductedCount: entries.filter(
      (entry) => entry.status === "approved",
    ).length,
    deductedCount: entries.filter(
      (entry) => entry.status === "deducted",
    ).length,
    pendingReviewCount: entries.filter(
      (entry) =>
        entry.status === "requested" ||
        entry.status === "review",
    ).length,
    rejectedCount: entries.filter(
      (entry) => entry.status === "rejected",
    ).length,
    requestCount: entries.length,
    totalRequestedVnd: entries.reduce(
      (total, entry) => total + entry.amountVnd,
      0,
    ),
  });
}

async function loadGradingCreditSummary(
  permissions: readonly PermissionCode[],
): Promise<
  DashboardSectionState<DashboardGradingCreditSummary>
> {
  if (
    !hasPermission(
      permissions,
      "grading_credits.view",
    )
  ) {
    return hiddenSection();
  }

  const result =
    await getGradingCreditsDashboardResult();

  if (!result.ok) {
    return errorSection();
  }

  const entries = result.data;

  const latestCreditedAt = entries.reduce<string | null>(
    (latest, entry) =>
      latest === null || entry.creditedAt > latest
        ? entry.creditedAt
        : latest,
    null,
  );

  return readySection({
    entryCount: entries.length,
    latestCreditedAt,
    totalCreditUnits: entries.reduce(
      (total, entry) => total + entry.creditUnits,
      0,
    ),
  });
}

async function loadCoachingSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardCoachingSummary>> {
  if (!hasPermission(permissions, "coaching.view")) {
    return hiddenSection();
  }

  const result =
    await getCoachingRecordsDashboardResult();

  if (!result.ok) {
    return errorSection();
  }

  const entries = result.data;

  return readySection({
    closedCount: entries.filter(
      (entry) => entry.currentStatus === "closed",
    ).length,
    highPriorityCount: entries.filter(
      (entry) =>
        entry.priority === "high" &&
        (entry.currentStatus === "open" ||
          entry.currentStatus === "in_progress"),
    ).length,
    inProgressCount: entries.filter(
      (entry) =>
        entry.currentStatus === "in_progress",
    ).length,
    openCount: entries.filter(
      (entry) => entry.currentStatus === "open",
    ).length,
    recordCount: entries.length,
  });
}

export async function getRoleAwareDashboardReadModel(
  permissions: readonly PermissionCode[],
): Promise<RoleAwareDashboardReadModel> {
  const [
    finance,
    payroll,
    advances,
    gradingCredits,
    coaching,
  ] = await Promise.all([
    loadFinanceSummary(permissions),
    loadPayrollSummary(permissions),
    loadAdvanceSummary(permissions),
    loadGradingCreditSummary(permissions),
    loadCoachingSummary(permissions),
  ]);

  return {
    advances,
    coaching,
    finance,
    gradingCredits,
    payroll,
  };
}
