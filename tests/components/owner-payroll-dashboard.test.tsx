import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PayrollCompositionChart } from "@/features/payroll/dashboard/components/payroll-dashboard-charts";
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

  // Value: protects=the owner composition chart reads like the payslip: "Tổng khấu trừ" holds only real deductions (advances) and "Tổng thu nhập" is earnings net of the piecework offset and manual decreases, so income − deductions = Thực trả;
  // fails_when=PayrollCompositionChart sums every deduction item into Tổng khấu trừ again (1.400.000 ₫), or Tổng thu nhập stops netting the offset / manual decrease (3.000.000 ₫ or 2.200.000 ₫);
  // why_new=the dashboard fixtures carry a single earning item, so the old and new totals render the same;
  // seam=none (PayrollCompositionChart renders fixture items); no_claim=does not prove the dashboard read model's composition rows or legend colours
  it("nets the piecework offset and manual decreases into Tổng thu nhập in the composition chart", () => {
    render(
      <PayrollCompositionChart
        items={[
          { amountVnd: 3_000_000, direction: "earning", label: "Lương công offline", lineType: "base_offline", sharePercent: 100 },
          { amountVnd: 800_000, direction: "deduction", label: "Phần lương khoán đã tính trong lương cứng", lineType: "piecework_offset", sharePercent: 0 },
          { amountVnd: 100_000, direction: "deduction", label: "Điều chỉnh giảm", lineType: "manual_deduction", sharePercent: 0 },
          { amountVnd: 500_000, direction: "deduction", label: "Khấu trừ tạm ứng", lineType: "advance_deduction", sharePercent: 0 },
        ]}
        netPayroll={1_600_000}
      />,
    );

    const totals = screen.getByText("Tổng khấu trừ").closest("dl") as HTMLElement;
    const figure = (label: string) => within(totals).getByText(label).nextElementSibling?.textContent;
    expect(figure("Tổng thu nhập")).toBe("2.100.000 ₫");
    expect(figure("Tổng khấu trừ")).toBe("500.000 ₫");
    expect(figure("Thực trả")).toBe("1.600.000 ₫");
  });
});
