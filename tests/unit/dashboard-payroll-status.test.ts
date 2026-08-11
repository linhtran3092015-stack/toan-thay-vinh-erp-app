import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPayrollDashboardResult: vi.fn(),
}));

vi.mock("@/features/payroll/data", () => ({
  getPayrollDashboardResult: dependencies.getPayrollDashboardResult,
}));

import { getRoleAwareDashboardReadModel } from "@/features/dashboard/data";

function entry(periodStatus: string) {
  return {
    payDate: "2026-08-31",
    payableAmountVnd: 100,
    payrollPeriodId: "period-1",
    payrollStatementId: `statement-${periodStatus}`,
    periodMonth: "2026-08-01",
    periodStatus,
    staffDisplayName: "Nguyễn An",
    staffEmployeeCode: "NV-001",
    staffId: "staff-1",
    totalDeductionsVnd: 0,
    totalEarningsVnd: 100,
    workHours: 1,
    workUnits: 1,
  };
}

describe("Global dashboard Payroll lifecycle buckets", () => {
  beforeEach(() => {
    dependencies.getPayrollDashboardResult.mockReset();
  });

  it("excludes an unsupported raw status from every known lifecycle bucket", async () => {
    dependencies.getPayrollDashboardResult.mockResolvedValue({
      data: [entry("draft"), entry("review"), entry("approved"), entry("constructor")],
      ok: true,
    });

    const dashboard = await getRoleAwareDashboardReadModel(["payroll.view"]);

    expect(dashboard.payroll).toEqual({
      data: {
        approvedStatementCount: 1,
        draftStatementCount: 1,
        latestPeriodMonth: "2026-08-01",
        reviewStatementCount: 1,
        statementCount: 4,
        totalPayableVnd: 400,
      },
      status: "ready",
    });
  });
});
