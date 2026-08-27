import { describe, expect, it } from "vitest";

import { buildPayrollDashboardData, calculateChangePercent } from "@/features/payroll/dashboard/aggregate";
import type { PayrollDashboardSource } from "@/features/payroll/dashboard/read-models";

const ids = {
  an: "11111111-1111-4111-8111-111111111111",
  binh: "22222222-2222-4222-8222-222222222222",
  chi: "33333333-3333-4333-8333-333333333333",
};

function source(overrides: Partial<PayrollDashboardSource> = {}): PayrollDashboardSource {
  return {
    composition: [
      { amountVnd: 15_000_000, direction: "earning", lineType: "base_offline", month: "2026-08-01" },
      { amountVnd: 5_000_000, direction: "earning", lineType: "grading_bonus", month: "2026-08-01" },
      { amountVnd: 2_000_000, direction: "deduction", lineType: "advance_deduction", month: "2026-08-01" },
    ],
    periods: [
      { month: "2026-08-01", status: "draft" },
      { month: "2026-07-01", status: "approved" },
    ],
    positionOptions: [
      { code: "teaching_assistant" },
      { code: "admissions_manager" },
      { code: "operations_assistant" },
    ],
    selectedMonth: "2026-08-01",
    selectedPositionCode: null,
    statements: [
      {
        month: "2026-08-01",
        payableAmountVnd: 12_000_000,
        payrollStatementId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        periodStatus: "draft",
        positionCode: "teaching_assistant",
        staffDisplayName: "Nguyễn An",
        staffEmployeeCode: "NS-001",
        staffId: ids.an,
        totalDeductionsVnd: 1_000_000,
        totalEarningsVnd: 13_000_000,
      },
      {
        month: "2026-08-01",
        payableAmountVnd: 6_000_000,
        payrollStatementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        periodStatus: "draft",
        positionCode: "admissions_manager",
        staffDisplayName: "Trần Bình",
        staffEmployeeCode: "NS-002",
        staffId: ids.binh,
        totalDeductionsVnd: 1_000_000,
        totalEarningsVnd: 7_000_000,
      },
      {
        month: "2026-07-01",
        payableAmountVnd: 8_000_000,
        payrollStatementId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        periodStatus: "approved",
        positionCode: "teaching_assistant",
        staffDisplayName: "Nguyễn An",
        staffEmployeeCode: "NS-001",
        staffId: ids.an,
        totalDeductionsVnd: 0,
        totalEarningsVnd: 8_000_000,
      },
      {
        month: "2026-07-01",
        payableAmountVnd: 2_000_000,
        payrollStatementId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        periodStatus: "approved",
        positionCode: "operations_assistant",
        staffDisplayName: "Lê Chi",
        staffEmployeeCode: null,
        staffId: ids.chi,
        totalDeductionsVnd: 0,
        totalEarningsVnd: 2_000_000,
      },
    ],
    ...overrides,
  };
}

describe("owner payroll dashboard aggregation", () => {
  it("uses payable amounts once per current statement for every KPI and position total", () => {
    const dashboard = buildPayrollDashboardData(source());

    expect(dashboard.summary).toMatchObject({
      averageSalary: 9_000_000,
      employeeChange: 0,
      employeeCount: 2,
      payrollChange: 8_000_000,
      payrollChangePercent: 80,
      previousMonthPayroll: 10_000_000,
      totalPayroll: 18_000_000,
    });
    expect(dashboard.summary.highestPaidEmployee?.staffId).toBe(ids.an);
    expect(dashboard.byPosition.reduce((sum, item) => sum + item.totalPayroll, 0)).toBe(18_000_000);
    expect(dashboard.byPosition.reduce((sum, item) => sum + item.employeeCount, 0)).toBe(2);
    expect(dashboard.byPosition.reduce((sum, item) => sum + item.sharePercent, 0)).toBeCloseTo(100);
    expect(dashboard.byPosition.map((item) => item.positionName)).toEqual(["Trợ giảng", "Quản lý tuyển sinh"]);
  });

  it("compares the immediate previous month, including new and departed employees", () => {
    const dashboard = buildPayrollDashboardData(source());

    expect(dashboard.significantChanges.increases.map((employee) => [employee.staffId, employee.change])).toEqual([
      [ids.binh, 6_000_000],
      [ids.an, 4_000_000],
    ]);
    expect(dashboard.significantChanges.increases[0]).toMatchObject({ changePercent: null, isNew: true });
    expect(dashboard.significantChanges.decreases[0]).toMatchObject({
      change: -2_000_000,
      changePercent: -100,
      currentPayroll: 0,
      staffId: ids.chi,
    });
  });

  it("keeps composition tied to stored line types and renders six calendar months", () => {
    const dashboard = buildPayrollDashboardData(source());

    expect(dashboard.composition.map((item) => [item.label, item.amountVnd, item.direction])).toEqual([
      ["Lương công offline", 15_000_000, "earning"],
      ["Thưởng chấm bài", 5_000_000, "earning"],
      ["Khấu trừ tạm ứng", 2_000_000, "deduction"],
    ]);
    expect(dashboard.composition.map((item) => item.sharePercent)).toEqual([75, 25, 10]);
    expect(dashboard.trend).toHaveLength(6);
    expect(dashboard.trend.at(-2)).toEqual({ employeeCount: 2, month: "2026-07-01", totalPayroll: 10_000_000 });
    expect(dashboard.trend.at(-1)).toEqual({ employeeCount: 2, month: "2026-08-01", totalPayroll: 18_000_000 });
  });

  it("handles a missing previous month, zero payroll, and null position without Infinity", () => {
    const onlyCurrent = source({
      composition: [],
      positionOptions: [{ code: null }],
      statements: [{
        ...source().statements[0],
        payableAmountVnd: 0,
        positionCode: null,
        totalDeductionsVnd: 1_000_000,
        totalEarningsVnd: 1_000_000,
      }],
    });
    const dashboard = buildPayrollDashboardData(onlyCurrent);

    expect(dashboard.summary.payrollChangePercent).toBeNull();
    expect(dashboard.topEmployees[0].changePercent).toBeNull();
    expect(dashboard.byPosition[0]).toMatchObject({ positionName: "Chưa phân loại", sharePercent: 0 });
    expect(dashboard.filters.positions).toEqual([{ code: "__unassigned__", name: "Chưa phân loại" }]);
    expect(JSON.stringify(dashboard)).not.toContain("Infinity");
  });

  it("returns null percentage whenever the comparison denominator is zero", () => {
    expect(calculateChangePercent(10, 0)).toBeNull();
    expect(calculateChangePercent(0, 0)).toBeNull();
    expect(calculateChangePercent(15, 10)).toBe(50);
  });

  it("keeps a selected position visible when it has no payroll rows yet", () => {
    const dashboard = buildPayrollDashboardData(source({
      positionOptions: [],
      selectedPositionCode: "operations_assistant",
      statements: [],
    }));

    expect(dashboard.filters.positions).toEqual([
      { code: "operations_assistant", name: "Trợ lý vận hành" },
    ]);
  });
});
