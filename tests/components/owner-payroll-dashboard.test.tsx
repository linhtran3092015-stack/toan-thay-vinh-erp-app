import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OwnerPayrollDashboardPage } from "@/features/payroll/dashboard/payroll-dashboard-page";
import type { PayrollDashboardData } from "@/features/payroll/dashboard/read-models";

const employee = {
  change: 4_000_000,
  changePercent: 50,
  currentPayroll: 12_000_000,
  isNew: false,
  positionCode: "teaching_assistant",
  positionName: "Trợ giảng",
  previousPayroll: 8_000_000,
  sharePercent: 100,
  staffDisplayName: "Nguyễn An",
  staffEmployeeCode: "NS-001",
  staffId: "11111111-1111-4111-8111-111111111111",
};

function dashboard(overrides: Partial<PayrollDashboardData> = {}): PayrollDashboardData {
  return {
    byPosition: [{
      averagePayroll: 12_000_000,
      employeeCount: 1,
      highestPayroll: 12_000_000,
      lowestPayroll: 12_000_000,
      positionCode: "teaching_assistant",
      positionName: "Trợ giảng",
      sharePercent: 100,
      totalPayroll: 12_000_000,
    }],
    composition: [{ amountVnd: 12_000_000, direction: "earning", label: "Lương công offline", lineType: "base_offline", sharePercent: 100 }],
    filters: {
      availableMonths: [{ month: "2026-08-01", status: "draft" }],
      positions: [{ code: "teaching_assistant", name: "Trợ giảng" }],
      selectedMonth: "2026-08-01",
      selectedPositionCode: null,
    },
    insights: ["Trợ giảng chiếm 100,0% tổng quỹ lương."],
    periodStatus: "draft",
    significantChanges: { decreases: [], increases: [employee] },
    summary: {
      averageSalary: 12_000_000,
      employeeChange: 0,
      employeeCount: 1,
      highestPaidEmployee: employee,
      payrollChange: 4_000_000,
      payrollChangePercent: 50,
      previousMonthPayroll: 8_000_000,
      totalPayroll: 12_000_000,
    },
    topEmployees: [employee],
    trend: [
      { employeeCount: 0, month: "2026-03-01", totalPayroll: 0 },
      { employeeCount: 0, month: "2026-04-01", totalPayroll: 0 },
      { employeeCount: 0, month: "2026-05-01", totalPayroll: 0 },
      { employeeCount: 0, month: "2026-06-01", totalPayroll: 0 },
      { employeeCount: 1, month: "2026-07-01", totalPayroll: 8_000_000 },
      { employeeCount: 1, month: "2026-08-01", totalPayroll: 12_000_000 },
    ],
    ...overrides,
  };
}

afterEach(cleanup);

describe("Owner payroll dashboard presentation", () => {
  it("renders executive KPIs, all requested charts, insights, tables and dynamic filters", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Quỹ lương tháng 08/2026" })).toBeInTheDocument();
    expect(screen.getByLabelText("Chỉ số quỹ lương chính")).toHaveTextContent("12.000.000 ₫");
    expect(screen.getByRole("img", { name: /Biểu đồ cơ cấu quỹ lương/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Biểu đồ thanh chi phí lương theo vị trí" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Biểu đồ xu hướng quỹ lương sáu tháng" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cơ cấu các khoản chi" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Top nhân sự có tổng lương cao nhất" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Biến động đáng chú ý" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tổng hợp theo vị trí" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Trợ giảng" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Nguyễn An" }).every((link) => link.getAttribute("href") === `/staff/${employee.staffId}`)).toBe(true);
  });

  it("renders a non-jumping empty state with a link back to payroll", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard({
      byPosition: [],
      composition: [],
      insights: [],
      significantChanges: { decreases: [], increases: [] },
      summary: {
        averageSalary: 0,
        employeeChange: 0,
        employeeCount: 0,
        highestPaidEmployee: null,
        payrollChange: 0,
        payrollChangePercent: null,
        previousMonthPayroll: 0,
        totalPayroll: 0,
      },
      topEmployees: [],
    })} />);

    expect(screen.getByRole("heading", { name: "Chưa có dữ liệu lương cho tháng 08/2026" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem bảng lương" })).toHaveAttribute("href", "/payroll");
    expect(screen.queryByLabelText("Chỉ số quỹ lương chính")).not.toBeInTheDocument();
  });
});
