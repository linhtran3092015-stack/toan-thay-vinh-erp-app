import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPayrollDashboardResult: vi.fn(),
}));

vi.mock("@/features/payroll/data", () => ({
  getPayrollDashboardResult: dependencies.getPayrollDashboardResult,
}));

import { getRoleAwareDashboardReadModel } from "@/features/dashboard/data";

function entry(periodStatus: string, payableAmountVnd = 100) {
  return {
    payDate: "2026-08-31",
    payableAmountVnd,
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
      data: [
        entry("draft", 1),
        entry("review", 999_999_999),
        entry("approved", 25),
        entry("constructor", 50),
      ],
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
      },
      status: "ready",
    });
  });

  it("does not reconstruct a Payroll payable total from statement rows", async () => {
    dependencies.getPayrollDashboardResult.mockResolvedValue({
      data: [entry("draft", 1), entry("review", 999_999_999)],
      ok: true,
    });

    const dashboard = await getRoleAwareDashboardReadModel(["payroll.view"]);

    expect(dashboard.payroll).toEqual({
      data: {
        approvedStatementCount: 0,
        draftStatementCount: 1,
        latestPeriodMonth: "2026-08-01",
        reviewStatementCount: 1,
        statementCount: 2,
      },
      status: "ready",
    });
  });

  it("does not retain a client-payable aggregate in the dashboard adapter", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/dashboard/data.ts"),
      "utf8",
    );

    expect(source).not.toContain("totalPayableVnd");
    expect(source).not.toContain("payableAmountVnd");
  });
});
