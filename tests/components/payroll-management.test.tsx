import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreatePayrollDraftDialog } from "@/features/payroll/components/create-payroll-draft-dialog";
import { PayrollImportDialog } from "@/features/payroll/components/payroll-import-dialog";
import { PayrollManualLineDialog } from "@/features/payroll/components/payroll-manual-line-dialog";
import { PayrollPage } from "@/features/payroll/payroll-page";
import type { PayrollLineRead, PayrollPeriodRead } from "@/features/payroll/read-models";

const mockToFile = vi.fn().mockResolvedValue(undefined);
const mockWriteExcelFile = vi.fn().mockReturnValue({ toFile: mockToFile });

vi.mock("write-excel-file/browser", () => ({
  default: mockWriteExcelFile,
}));

const actions = vi.hoisted(() => ({
  addPayrollManualLineAction: vi.fn(),
  createPayrollDraftAction: vi.fn(),
  createPayrollImportBatchAction: vi.fn(),
  resetPayrollDraftAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/payroll/actions/payroll-actions", () => actions);

const statementId = "11111111-1111-4111-8111-111111111111";

const line = (overrides: Partial<PayrollLineRead>): PayrollLineRead => ({
  amountVnd: 1_000,
  direction: "earning",
  evidenceSnapshot: {},
  formulaSnapshot: {},
  id: "line-1",
  lineType: "hourly_wage",
  note: "Dữ liệu đã ghi nhận",
  payrollStatementId: statementId,
  policyCode: null,
  quantity: null,
  sourceKind: null,
  unitCount: 9,
  unitLabel: null,
  unitRateVnd: 100,
  workMinutes: null,
  ...overrides,
});

const period = (overrides: Partial<PayrollPeriodRead> = {}): PayrollPeriodRead => ({
  blockingIssueCount: 0,
  currentRevision: 1,
  feedbackClosedAt: "2026-05-20T00:00:00Z",
  feedbackOpenedAt: "2026-05-15T00:00:00Z",
  id: "22222222-2222-4222-8222-222222222222",
  lastCalculatedAt: "2026-05-20T08:30:00Z",
  payDate: "2026-05-28",
  pendingCorrectionCount: 0,
  periodMonth: "2026-04-01",
  statements: [{
    id: statementId,
    lines: [
      line({ id: "line-1", lineType: "hourly_wage" }),
      line({ direction: "deduction", id: "line-2", lineType: "manual_deduction", note: null, unitCount: null, unitRateVnd: null }),
    ],
    payableAmountVnd: 777,
    payrollPeriodId: "22222222-2222-4222-8222-222222222222",
    staffDisplayName: "Nguyễn Minh An",
    staffEmployeeCode: "NS-001",
    staffId: "33333333-3333-4333-833333333333",
    totalDeductionsVnd: 111,
    totalEarningsVnd: 888,
    workHours: 18,
    workMinutes: 1_080,
    workUnits: 2,
  }],
  status: "draft",
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

/** Renders one view-only statement with the given lines and stored totals. */
function renderStatement(lines: PayrollLineRead[], totals: { payableAmountVnd: number; totalDeductionsVnd: number; totalEarningsVnd: number }) {
  render(<PayrollPage canApprove={false} canManage={false} canReconcile={false} periods={[period({ statements: [{ ...period().statements[0], lines, ...totals }] })]} />);
}

function openPayslip() {
  fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
  return screen.getByRole("dialog", { name: /Phiếu lương/ });
}

/** Operations assistant below the 85% floor (900.000 VND of bonuses, all inside lương cứng), plus an optional advance. */
function pieceworkStatement(advanceVnd: number) {
  const lines = [
    line({ amountVnd: 1_500_000, id: "w-base", lineType: "base_offline" }),
    line({ amountVnd: 655_340, id: "w-renewal", lineType: "operations_grade_renewal_bonus" }),
    line({ amountVnd: 244_660, id: "w-grading", lineType: "grading_bonus" }),
    line({
      amountVnd: 900_000,
      direction: "deduction",
      formulaSnapshot: { base_salary_vnd: 1_500_000, basis_points: 8_500, piecework_vnd: 900_000 },
      id: "w-offset",
      lineType: "piecework_offset",
      note: "Bù trừ lương khoán đến ngưỡng 85% lương cứng.",
    }),
    ...(advanceVnd > 0 ? [line({ amountVnd: advanceVnd, direction: "deduction", id: "w-advance", lineType: "advance_deduction", note: null })] : []),
  ];
  return {
    lines,
    totals: { payableAmountVnd: 1_500_000 - advanceVnd, totalDeductionsVnd: 900_000 + advanceVnd, totalEarningsVnd: 2_400_000 },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Payroll 1 presentation", () => {
  it("presents Payroll 0 totals and immutable line facts without unauthorized Payroll 2 controls", () => {
    const allLineTypes = [
      "hourly_wage", "revenue_bonus", "kpi_bonus", "grading_bonus",
      "commission", "manual_reward", "manual_deduction", "advance_deduction",
    ].map((lineType, index) => line({
      direction: lineType === "manual_deduction" || lineType === "advance_deduction" ? "deduction" : "earning",
      id: `line-${index}`,
      lineType,
      unitCount: lineType === "hourly_wage" ? 9 : null,
      unitRateVnd: lineType === "hourly_wage" ? 100 : null,
    }));
    // Six earnings and two deductions of 1.000 VND each.
    const renderedPeriod = period({ statements: [{
      ...period().statements[0],
      lines: allLineTypes,
      payableAmountVnd: 4_000,
      totalDeductionsVnd: 2_000,
      totalEarningsVnd: 6_000,
    }] });

    render(<PayrollPage canApprove={false} canManage canReconcile={false} periods={[renderedPeriod]} />);

    // The manual deduction is a correction netted into income; only the advance is "Khấu trừ".
    const statementTable = screen.getByRole("table", { name: "Danh sách bảng lương nhân sự" });
    expect(statementTable).toHaveTextContent("Thu nhập");
    expect(statementTable).toHaveTextContent("5.000 VND");
    expect(statementTable).toHaveTextContent("4.000 VND");
    expect(screen.getAllByText("2 công")).not.toHaveLength(0);
    expect(screen.getAllByText("18 giờ")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /gửi đối soát|duyệt/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("Tổng thu nhập");
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("Tổng thu nhập − Khấu trừ = Thực nhận");
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("5.000 VND − 1.000 VND = 4.000 VND");
    // The manual decrease sits under "Điều chỉnh"; "Tạm ứng & khấu trừ" keeps the advance only.
    const payslip = screen.getByRole("dialog", { name: /Phiếu lương/ });
    expect(within(payslip).getByRole("region", { name: "Điều chỉnh" })).toHaveTextContent("Điều chỉnh giảm");
    const realDeductions = within(payslip).getByRole("region", { name: "Tạm ứng & khấu trừ" });
    expect(realDeductions).toHaveTextContent("Khấu trừ tạm ứng");
    expect(realDeductions).toHaveTextContent("−1.000 VND");
    expect(realDeductions).not.toHaveTextContent("Điều chỉnh giảm");
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("Công & giờ làm");
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("Chấm bài");
    expect(screen.getAllByText("Lương theo giờ")).not.toHaveLength(0);
    expect(screen.getAllByText("Thưởng doanh thu")).not.toHaveLength(0);
    expect(screen.getAllByText("Thưởng KPI")).not.toHaveLength(0);
    expect(screen.getAllByText("Thưởng chấm bài")).not.toHaveLength(0);
    expect(screen.getAllByText("Hoa hồng")).not.toHaveLength(0);
    expect(screen.getAllByText("Điều chỉnh tăng")).not.toHaveLength(0);
    expect(screen.getAllByText("Điều chỉnh giảm")).not.toHaveLength(0);
    expect(screen.getAllByText("Khấu trừ tạm ứng")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã ghi nhận")).not.toHaveLength(0);
    expect(screen.queryByText("Số lượng: 0")).not.toBeInTheDocument();
    expect(screen.queryByText("Đơn giá: 0 VND")).not.toBeInTheDocument();
  });

  // Value: protects=an operations payslip shows the 85% floor inside "Lương khoán" with its explanation, corrections under "Điều chỉnh", and "Khấu trừ" at 0 when there is no advance;
  // fails_when=the offset or a manual deduction is listed or totalled under "Tạm ứng & khấu trừ", or the summary card still shows the offset as Khấu trừ;
  // why_new=staff read "Bù trừ & khấu trừ −900.000 VND" as a cut in pay;
  // seam=PayrollPage → PayrollPayslipDialog with fixture lines; no_claim=does not prove the engine's offset amount
  it("shows the piecework floor as lương khoán, not as a deduction", () => {
    const pieceworkLines = [
      line({ amountVnd: 1_500_000, id: "p-base", lineType: "base_offline" }),
      line({ amountVnd: 900_000, id: "p-renewal", lineType: "operations_grade_renewal_bonus" }),
      line({
        amountVnd: 900_000,
        direction: "deduction",
        formulaSnapshot: { base_salary_vnd: 1_500_000, basis_points: 8_500, piecework_vnd: 900_000 },
        id: "p-offset",
        lineType: "piecework_offset",
        note: "Bù trừ lương khoán đến ngưỡng 85% lương cứng.",
      }),
      line({ amountVnd: 80_000, id: "p-dinner", lineType: "manual_reward", note: "Phụ cấp ăn tối" }),
    ];
    render(<PayrollPage canApprove={false} canManage={false} canReconcile={false} periods={[period({ statements: [{
      ...period().statements[0],
      lines: pieceworkLines,
      payableAmountVnd: 1_580_000,
      totalDeductionsVnd: 900_000,
      totalEarningsVnd: 2_480_000,
    }] })]} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    const dialog = screen.getByRole("dialog", { name: /Phiếu lương/ });

    const summary = within(dialog).getByRole("region", { name: "Tóm tắt thu nhập" });
    expect(summary).toHaveTextContent("Tổng thu nhập1.580.000 VND");
    expect(summary).toHaveTextContent("Khấu trừ0 VND");
    const piecework = within(dialog).getByRole("region", { name: "Lương khoán" });
    expect(piecework).toHaveTextContent("Phần lương khoán đã tính trong lương cứng");
    expect(piecework).toHaveTextContent("Không phải khoản bị trừ");
    expect(piecework).toHaveTextContent("chưa vượt 85% lương cứng (1.500.000 VND × 85% = 1.275.000 VND)");
    expect(piecework).not.toHaveTextContent("Bù trừ");
    expect(within(dialog).getByRole("region", { name: "Điều chỉnh" })).toHaveTextContent("Điều chỉnh tăng");
    expect(within(dialog).getByRole("region", { name: "Tạm ứng & khấu trừ" })).toHaveTextContent("Không phát sinh hạng mục trong nhóm này.");
  });

  // Value: protects=the statement list's Thu nhập / Khấu trừ / Thực nhận columns (and the narrow-screen record) show income net of manual decreases and only real deductions, reconciling to the stored payable;
  // fails_when=PayrollStatementTableRow or PayrollStatementRecord goes back to statement.totalDeductionsVnd (2.000 VND) or totalEarningsVnd (5.000 VND), or the columns are reordered so Khấu trừ shows another figure;
  // why_new=the first presentation test only checks that "5.000 VND" and "4.000 VND" occur somewhere in the table, which the stored totals also satisfy;
  // seam=PayrollPage with fixture lines; no_claim=does not prove the stored totals match the lines
  it("shows only real deductions in the statement list's Khấu trừ column", () => {
    renderStatement([
      line({ amountVnd: 5_000, id: "l-wage", lineType: "hourly_wage" }),
      line({ amountVnd: 1_000, direction: "deduction", id: "l-manual", lineType: "manual_deduction", note: "Trả lại phần tính dư" }),
      line({ amountVnd: 1_000, direction: "deduction", id: "l-advance", lineType: "advance_deduction", note: null }),
    ], { payableAmountVnd: 3_000, totalDeductionsVnd: 2_000, totalEarningsVnd: 5_000 });

    const table = screen.getByRole("table", { name: "Danh sách bảng lương nhân sự" });
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
    const row = within(table).getByText("Nguyễn Minh An").closest("tr") as HTMLTableRowElement;
    const cell = (header: string) => row.cells[headers.indexOf(header)]?.textContent;
    expect([cell("Thu nhập"), cell("Khấu trừ"), cell("Thực nhận")]).toEqual(["4.000 VND", "1.000 VND", "3.000 VND"]);

    const record = screen.getByRole("list", { name: /danh sách bảng lương nhân sự/i });
    expect(within(record).getByText("Thu nhập").nextElementSibling?.textContent).toBe("4.000 VND");
    expect(within(record).getByText("Khấu trừ").nextElementSibling?.textContent).toBe("1.000 VND");
  });

  // Value: protects=a statement with neither a piecework offset nor a manual line shows no empty "Lương khoán" or "Điều chỉnh" section, while its Chấm bài and Phụ cấp sections keep their place;
  // fails_when=optionalSections stops hiding empty piecework / manual groups (two "Không phát sinh hạng mục" boxes appear for most staff), or the piecework-only hiding of Chấm bài / Phụ cấp is applied to every statement;
  // why_new=both dialog fixtures carry manual lines and one carries an offset, so the empty-section rule never runs;
  // seam=PayrollPage → PayrollPayslipDialog with fixture lines; no_claim=does not cover the printable payslip (payroll-payslip-card covers it)
  it("keeps Lương khoán and Điều chỉnh out of an ordinary payslip", () => {
    renderStatement([
      line({ amountVnd: 4_000_000, id: "o-base", lineType: "base_offline" }),
      line({ amountVnd: 500_000, direction: "deduction", id: "o-advance", lineType: "advance_deduction", note: null }),
    ], { payableAmountVnd: 3_500_000, totalDeductionsVnd: 500_000, totalEarningsVnd: 4_000_000 });

    const dialog = openPayslip();
    expect(within(dialog).queryByRole("region", { name: "Lương khoán" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("region", { name: "Điều chỉnh" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Chấm bài" })).toHaveTextContent("Không phát sinh hạng mục trong nhóm này.");
    expect(within(dialog).getByRole("region", { name: "Phụ cấp, thưởng & hoa hồng" })).toHaveTextContent("Không phát sinh hạng mục trong nhóm này.");
    expect(within(dialog).getByRole("region", { name: "Tạm ứng & khấu trừ" })).toHaveTextContent("Khấu trừ tạm ứng");
  });

  // Value: protects=on a piecework payslip the grading bonus and other bonuses sit inside "Lương khoán", and the "Chấm bài" and "Phụ cấp, thưởng & hoa hồng" sections that would only ever be empty are not shown;
  // fails_when=sectionsInsidePiecework stops hiding the empty Chấm bài / Phụ cấp groups, or getPayslipSection checks grading_bonus before piecework (the grading bonus leaves Lương khoán for its own Chấm bài section);
  // why_new=the existing piecework dialog fixture has no grading bonus and never asserts which sections are absent;
  // seam=PayrollPage → PayrollPayslipDialog with fixture lines; no_claim=does not prove the engine counts the grading bonus as lương khoán
  it("folds Chấm bài and Phụ cấp into Lương khoán on a piecework payslip", () => {
    const { lines, totals } = pieceworkStatement(200_000);
    renderStatement(lines, totals);

    const dialog = openPayslip();
    expect(within(dialog).queryByRole("region", { name: "Chấm bài" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("region", { name: "Phụ cấp, thưởng & hoa hồng" })).not.toBeInTheDocument();
    const piecework = within(dialog).getByRole("region", { name: "Lương khoán" });
    expect(piecework).toHaveTextContent("Thưởng chấm bài");
    expect(piecework).toHaveTextContent("Thưởng tái phí khối phụ trách");
  });

  // Value: protects=on the payslip dialog only real deductions read as money taken away: the offset amount is not red, the advance amount is, and the "Khấu trừ" summary tile is red only when it is above 0;
  // fails_when=getAmountClassName (or the inline class) paints every deduction text-danger again, stops painting the advance, or SummaryAmount colours the deduction tile red at 0 VND;
  // why_new=no dialog test asserted a colour, so the offset kept looking like a cut in pay while every text assertion passed;
  // seam=PayrollPage → PayrollPayslipDialog with fixture lines; no_claim=does not check the rendered colour, only the design-token class
  it("colours only the advance and a non-zero Khấu trừ tile as deductions", () => {
    const withAdvance = pieceworkStatement(200_000);
    renderStatement(withAdvance.lines, withAdvance.totals);
    let dialog = openPayslip();

    const offsetAmounts = within(within(dialog).getByRole("region", { name: "Lương khoán" })).getAllByText("−900.000 VND");
    expect(offsetAmounts.length).toBeGreaterThan(0);
    for (const amount of offsetAmounts) expect(amount).not.toHaveClass("text-danger");
    // The group row and the line row (the section header total is styled as a heading, not as a line amount).
    const advanceAmounts = within(within(dialog).getByRole("region", { name: "Tạm ứng & khấu trừ" })).getAllByText("−200.000 VND").filter((amount) => amount.closest("summary, li"));
    expect(advanceAmounts).toHaveLength(2);
    for (const amount of advanceAmounts) expect(amount).toHaveClass("text-danger");
    let tile = within(within(dialog).getByRole("region", { name: "Tóm tắt thu nhập" })).getByText("Khấu trừ").nextElementSibling;
    expect(tile?.textContent).toBe("−200.000 VND");
    expect(tile).toHaveClass("text-danger");

    cleanup();
    const withoutAdvance = pieceworkStatement(0);
    renderStatement(withoutAdvance.lines, withoutAdvance.totals);
    dialog = openPayslip();
    tile = within(within(dialog).getByRole("region", { name: "Tóm tắt thu nhập" })).getByText("Khấu trừ").nextElementSibling;
    expect(tile?.textContent).toBe("0 VND");
    expect(tile).not.toHaveClass("text-danger");
  });

  // Value: protects=on the payslip dialog, manual decreases that outweigh increases give the "Điều chỉnh" section a signed net decrease;
  // fails_when=PayslipGroup's total goes back to summing amountVnd without direction (70.000 VND) or drops the minus sign of a negative total (30.000 VND);
  // why_new=the dialog's adjustments fixtures net positive, so the negative total never renders;
  // seam=PayrollPage → PayrollPayslipDialog with fixture lines; no_claim=does not cover the printable payslip or PDF (their own tests do)
  it("signs a net-negative Điều chỉnh total in the dialog", () => {
    renderStatement([
      line({ amountVnd: 500_000, id: "n-base", lineType: "base_offline" }),
      line({ amountVnd: 20_000, id: "n-reward", lineType: "manual_reward", note: "Phụ cấp gửi xe" }),
      line({ amountVnd: 50_000, direction: "deduction", id: "n-deduction", lineType: "manual_deduction", note: "Trả lại phần tính dư" }),
    ], { payableAmountVnd: 470_000, totalDeductionsVnd: 50_000, totalEarningsVnd: 520_000 });

    const adjustments = within(openPayslip()).getByRole("region", { name: "Điều chỉnh" });
    expect(within(adjustments).getByLabelText("Tổng Điều chỉnh").textContent).toBe("−30.000 VND");
  });

  // Value: protects=on the payslip dialog each manual correction is its own row with the manager's note visible without expanding it, even when two share a line type;
  // fails_when=the "manual" section goes back to groupPayrollLines (one "Điều chỉnh tăng · 2 phát sinh" row) or the row subtitle stops showing the note;
  // why_new=staff read the reason for a correction on this dialog; grouped rows hid it behind "Xem căn cứ tính";
  // seam=PayrollPage → PayrollPayslipDialog with fixture lines; no_claim=does not check the expanded per-line detail
  it("shows each correction as its own row with its note in the dialog", () => {
    renderStatement([
      line({ amountVnd: 500_000, id: "c-base", lineType: "base_offline" }),
      line({ amountVnd: 20_000, id: "c-reward-1", lineType: "manual_reward", note: "Phụ cấp gửi xe" }),
      line({ amountVnd: 40_000, id: "c-reward-2", lineType: "manual_reward", note: "Phụ cấp ăn tối 1 ngày" }),
    ], { payableAmountVnd: 560_000, totalDeductionsVnd: 0, totalEarningsVnd: 560_000 });

    const adjustments = within(openPayslip()).getByRole("region", { name: "Điều chỉnh" });
    const rows = adjustments.querySelectorAll("details > summary");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Phụ cấp gửi xe");
    expect(rows[0]).toHaveTextContent("20.000 VND");
    expect(rows[1]).toHaveTextContent("Phụ cấp ăn tối 1 ngày");
    expect(adjustments).not.toHaveTextContent("2 phát sinh");
  });

  // Value: protects=the manager sees, at the note field, that staff read the note on the payslip, and the textarea announces it;
  // fails_when=the hint is dropped or the textarea's aria-describedby stops pointing at it;
  // why_new=notes now print on the staff payslip and PDF;
  // seam=PayrollManualLineDialog rendered alone; no_claim=does not cover the error state, which replaces the hint
  it("tells the manager at the note field that staff see the note", () => {
    render(<PayrollManualLineDialog payrollStatementId={statementId} staffDisplayName="Nguyễn Minh An" />);
    fireEvent.click(screen.getByRole("button", { name: "Điều chỉnh" }));

    expect(screen.getByLabelText("Nội dung")).toHaveAccessibleDescription("Nhân sự thấy nội dung này trên phiếu lương, ở mục Điều chỉnh.");
    expect(screen.getByRole("dialog", { name: "Điều chỉnh bảng lương" })).toHaveTextContent("điều chỉnh giảm trừ vào Thực nhận");
  });

  // Value: protects=a note error replaces the hint as the textarea's accessible description, so screen readers announce the error;
  // fails_when=SelectField's describedby order flips (hint wins over error) or the error paragraph loses its id;
  // why_new=the note field is the only one with a hint; the existing describedby test uses the amount field;
  // seam=PayrollManualLineDialog with the mocked server action; no_claim=does not cover other fields
  it("announces a note error instead of the hint", async () => {
    actions.addPayrollManualLineAction.mockResolvedValueOnce({ fieldErrors: { note: ["Cần nêu nội dung điều chỉnh."] }, message: "Vui lòng kiểm tra lại khoản điều chỉnh.", status: "error" });
    render(<PayrollManualLineDialog payrollStatementId={statementId} staffDisplayName="Nguyễn Minh An" />);
    fireEvent.click(screen.getByRole("button", { name: "Điều chỉnh" }));
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "50000" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "x" } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Điều chỉnh bảng lương" })).getByRole("button", { name: "Ghi điều chỉnh" }));

    await waitFor(() => expect(screen.getByLabelText("Nội dung")).toHaveAccessibleDescription("Cần nêu nội dung điều chỉnh."));
  });

  // Value: protects=/payroll offers the next batch of older periods (it now reads only the latest few) and says how many remain;
  // fails_when=the control is missing when older periods exist, links to the wrong ?periods= value, or shows when nothing older exists;
  // why_new=before this change every period was rendered, so there was nothing to load;
  // seam=PayrollPage with fixture periods; no_claim=does not prove the route reads ?periods= (payroll-route.test covers it)
  it("offers older periods on request", () => {
    const { unmount } = render(<PayrollPage canApprove={false} canManage={false} canReconcile={false} olderPeriodCount={5} periodCount={3} periods={[period()]} />);

    expect(screen.getByText("Còn 5 kỳ lương cũ hơn chưa hiển thị.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem thêm 3 kỳ cũ hơn" })).toHaveAttribute("href", "/payroll?periods=6");

    unmount();
    const { unmount: unmountCap } = render(<PayrollPage canApprove={false} canManage={false} canReconcile={false} olderPeriodCount={4} periodCount={60} periods={[period()]} />);
    // At the 60-period cap the note says so instead of offering a link past the RPC's limit.
    expect(screen.getByText("Chỉ hiển thị 60 kỳ lương gần nhất; còn 4 kỳ cũ hơn.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /kỳ cũ hơn/ })).not.toBeInTheDocument();

    unmountCap();
    const { unmount: unmountNone } = render(<PayrollPage canApprove={false} canManage={false} canReconcile={false} periods={[period()]} />);
    expect(screen.queryByRole("link", { name: /kỳ cũ hơn/ })).not.toBeInTheDocument();

    // Extended by /ship test coverage audit (pass 2).
    // Value: protects=on /payroll opened from a Tạm ứng link (?period=), "Xem thêm … kỳ cũ hơn" keeps that period in the next URL so it stays on screen;
    // fails_when=PayrollPage stops passing includedPeriodId to getOlderPayrollPeriodsLink (an optional argument, so it still compiles) and the link drops &period=;
    // why_new=every PayrollPage render here omits includedPeriodId; period-window.test covers the helper alone, not the page's call;
    // seam=none; no_claim=does not prove the route hands ?period= to PayrollPage (payroll-route.test mocks PayrollPage and drops the prop)
    unmountNone();
    const linkedPeriodId = "b2000000-0000-4000-8000-000000202609";
    render(<PayrollPage canApprove={false} canManage={false} canReconcile={false} includedPeriodId={linkedPeriodId} olderPeriodCount={5} periodCount={3} periods={[period()]} />);
    expect(screen.getByRole("link", { name: "Xem thêm 3 kỳ cũ hơn" })).toHaveAttribute("href", `/payroll?periods=6&period=${linkedPeriodId}`);
  });

  // Value: protects=the payslip dialog explains a lương khoán that contradicts its offset instead of claiming it was all paid inside lương cứng;
  // fails_when=the dialog passes a mismatch to getPieceworkExplanation (it would print a negative or false "chưa vượt" sentence), drops the warning, or still prints the group total;
  // why_new=summarizePiecework now reports a negative added amount as a mismatch;
  // seam=PayrollPage → PayrollPayslipDialog with fixture lines; no_claim=does not cover the printable payslip (payslip-data fails closed there)
  it("warns in the dialog when lương khoán is below the offset", () => {
    const { lines, totals } = pieceworkStatement(0);
    renderStatement(lines.map((entry) => entry.id === "w-offset" ? { ...entry, formulaSnapshot: { ...entry.formulaSnapshot, piecework_vnd: 600_000 } } : entry), totals);

    const piecework = within(openPayslip()).getByRole("region", { name: "Lương khoán" });

    expect(piecework).toHaveTextContent("Lương khoán chưa khớp với phần đã trả trong lương cứng. Quản lý lương cần kiểm tra");
    expect(piecework).not.toHaveTextContent("chưa vượt");
    expect(within(piecework).getByLabelText("Tổng Lương khoán")).toHaveTextContent("—");
  });

  it("keeps a real zero-statement period distinct and fails closed for unknown status", () => {
    render(<PayrollPage canApprove={false} canManage canReconcile={false} periods={[
      period({ id: "empty-period", periodMonth: "2026-05-01", statements: [], status: "review" }),
      period({ id: "unknown-period", periodMonth: "2026-03-01", status: "archived" }),
    ]} />);

    expect(screen.getByText("Chưa có bảng lương nhân sự trong kỳ này.")).toBeInTheDocument();
    expect(screen.getByText("Chờ đối soát")).toBeInTheDocument();
    expect(screen.getByText("Trạng thái chưa hỗ trợ: archived")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Điều chỉnh" })).not.toBeInTheDocument();
  });

  it("keeps prototype-property status and line type values visibly unsupported and actionless", () => {
    render(<PayrollPage canApprove canManage canReconcile periods={[
      period({
        id: "prototype-period",
        statements: [{
          ...period().statements[0],
          lines: [line({ lineType: "constructor" })],
        }],
        status: "constructor",
      }),
    ]} />);

    expect(screen.getByText("Trạng thái chưa hỗ trợ: constructor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gửi đối soát|duyệt|điều chỉnh/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    expect(screen.getAllByText("Loại khoản chưa hỗ trợ: constructor")).not.toHaveLength(0);
    expect(screen.queryByText(/^function constructor/)).not.toBeInTheDocument();
  });

  it("uses reader-provided status labels and limits manual controls to an open draft", () => {
    render(<PayrollPage canApprove={false} canManage canReconcile={false} periods={[
      period({ feedbackClosedAt: null, id: "draft", status: "draft" }),
      period({ id: "review", status: "review" }),
      period({ id: "approved", status: "approved" }),
    ]} />);

    expect(screen.getByText("Nháp")).toBeInTheDocument();
    expect(screen.getByText("Chờ đối soát")).toBeInTheDocument();
    expect(screen.getByText("Đã duyệt & khóa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Điều chỉnh" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    expect(screen.getByRole("button", { name: "Điều chỉnh" })).toBeInTheDocument();
  });

  it("keeps view-only presentation read-only and preserves the 980/982 container contract", () => {
    render(<PayrollPage canApprove={false} canManage={false} canReconcile={false} periods={[period()]} />);

    expect(screen.queryByRole("button", { name: "Lập bảng lương" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Điều chỉnh" })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Danh sách bảng lương nhân sự" }).closest(".payroll-statement-work-area")).not.toBeNull();
    expect(screen.getByRole("list", { name: /danh sách bảng lương nhân sự/i })).toBeInTheDocument();
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const source = readFileSync(resolve(process.cwd(), "src/features/payroll/payroll-page.tsx"), "utf8");
    expect(globals).toMatch(/\.payroll-statement-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 982px\)[\s\S]*\.payroll-statement-table/);
    expect(source).toContain('min-w-[980px]');
    expect(source).not.toMatch(/\.reduce\(/);
  });
});

describe("Payroll 1 dialogs", () => {
  it("requires an explicit month confirmation before resetting a draft", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.resetPayrollDraftAction.mockReturnValueOnce(pending.promise);
    render(<PayrollPage canApprove={false} canManage canReconcile={false} periods={[
      period({ periodMonth: "2026-07-01" }),
    ]} />);

    const trigger = screen.getByRole("button", { name: "Đặt lại bản nháp" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Đặt lại bản nháp bảng lương" });
    expect(dialog).toHaveTextContent("bỏ toàn bộ khoản cộng, trừ thủ công");
    expect(dialog).toHaveTextContent("DAT LAI 07/2026");

    fireEvent.change(screen.getByLabelText("Lý do đặt lại"), {
      target: { value: "Dữ liệu kỳ tháng 7 đang sai" },
    });
    fireEvent.change(screen.getByLabelText(/Nhập DAT LAI 07\/2026 để xác nhận/), {
      target: { value: "DAT LAI 07/2026" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Đặt lại và tính từ đầu" }));

    await waitFor(() => expect(actions.resetPayrollDraftAction).toHaveBeenCalledWith({
      confirmation: "DAT LAI 07/2026",
      expectedRevision: 1,
      payrollPeriodId: "22222222-2222-4222-8222-222222222222",
      reason: "Dữ liệu kỳ tháng 7 đang sai",
    }));
    expect(dialog).toHaveTextContent("Đang đặt lại…");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pending.resolve({ message: "Đã đặt lại.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("serializes the create-draft month exactly and protects unresolved mutations before refreshing", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.createPayrollDraftAction.mockReturnValueOnce(pending.promise);
    render(<CreatePayrollDraftDialog />);

    const trigger = screen.getByRole("button", { name: "Lập bảng lương" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Lập bảng lương tháng" });
    fireEvent.change(screen.getByLabelText("Kỳ lương"), { target: { value: "2026-04" } });
    const submit = within(dialog).getByRole("button", { name: "Lập bảng lương" });
    fireEvent.click(submit);

    await waitFor(() => expect(actions.createPayrollDraftAction).toHaveBeenCalledWith({ periodMonth: "2026-04-01" }));
    expect(dialog).toHaveTextContent("Đang lập bảng lương…");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(submit);
    expect(actions.createPayrollDraftAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pending.resolve({ message: "Đã tạo bảng lương nháp.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("unlocks a returned create error immediately, associates it with the field, and clears it before retry", async () => {
    const first = deferred<{ fieldErrors: { periodMonth: string[] }; message: string; status: "error" }>();
    const second = deferred<{ message: string; status: "success" }>();
    actions.createPayrollDraftAction.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<CreatePayrollDraftDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Lập bảng lương" }));
    const dialog = screen.getByRole("dialog", { name: "Lập bảng lương tháng" });
    fireEvent.change(screen.getByLabelText("Kỳ lương"), { target: { value: "2026-04" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lập bảng lương" }));
    first.resolve({ fieldErrors: { periodMonth: ["Kỳ lương đã tồn tại."] }, message: "Kỳ lương đã tồn tại.", status: "error" });

    await screen.findByRole("alert");
    const month = screen.getByLabelText("Kỳ lương");
    expect(month).toHaveAttribute("aria-invalid", "true");
    const monthError = document.getElementById(month.getAttribute("aria-describedby") ?? "");
    expect(monthError).toHaveTextContent("Kỳ lương đã tồn tại.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Lập bảng lương" }));
    await waitFor(() => expect(actions.createPayrollDraftAction).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    second.resolve({ message: "Đã tạo bảng lương nháp.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("restores the approved close behavior after an error for both Payroll 1 dialogs", async () => {
    actions.createPayrollDraftAction.mockResolvedValueOnce({ message: "Kỳ lương đã tồn tại.", status: "error" });
    render(<CreatePayrollDraftDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Lập bảng lương" }));
    const createDialog = screen.getByRole("dialog", { name: "Lập bảng lương tháng" });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Lập bảng lương" }));
    await screen.findByRole("alert");
    fireEvent.click(within(createDialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    cleanup();
    actions.addPayrollManualLineAction.mockResolvedValueOnce({ message: "Kỳ lương không còn là nháp.", status: "error" });
    render(<PayrollManualLineDialog payrollStatementId={statementId} staffDisplayName="Nguyễn Minh An" />);
    fireEvent.click(screen.getByRole("button", { name: "Điều chỉnh" }));
    const manualDialog = screen.getByRole("dialog", { name: "Điều chỉnh bảng lương" });
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Ghi nhận" } });
    fireEvent.click(within(manualDialog).getByRole("button", { name: "Ghi điều chỉnh" }));
    await screen.findByRole("alert");
    fireEvent.keyDown(manualDialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("preserves both exact manual payloads, field errors, and dismissal safety", async () => {
    const first = deferred<{ fieldErrors: { amountVnd: string[] }; message: string; status: "error" }>();
    const second = deferred<{ message: string; status: "success" }>();
    actions.addPayrollManualLineAction.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValueOnce({ message: "Đã thêm.", status: "success" });
    render(<PayrollManualLineDialog payrollStatementId={statementId} staffDisplayName="Nguyễn Minh An" />);

    const trigger = screen.getByRole("button", { name: "Điều chỉnh" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Điều chỉnh bảng lương" });
    const amountInput = screen.getByLabelText("Số tiền (VND)");
    expect(amountInput).toHaveAttribute("min", "1");
    expect(amountInput).toHaveAttribute("step", "1");
    fireEvent.change(amountInput, { target: { value: "125000" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Thưởng hỗ trợ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ghi điều chỉnh" }));
    await waitFor(() => expect(actions.addPayrollManualLineAction).toHaveBeenCalledWith({ amountVnd: 125000, lineType: "manual_reward", note: "Thưởng hỗ trợ", payrollStatementId: statementId }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(actions.addPayrollManualLineAction).toHaveBeenCalledOnce();

    first.resolve({ fieldErrors: { amountVnd: ["Số tiền không hợp lệ."] }, message: "Số tiền không hợp lệ.", status: "error" });
    await screen.findByRole("alert");
    const amount = screen.getByLabelText("Số tiền (VND)");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    const amountError = document.getElementById(amount.getAttribute("aria-describedby") ?? "");
    expect(amountError).toHaveTextContent("Số tiền không hợp lệ.");
    fireEvent.change(screen.getByLabelText("Loại điều chỉnh"), { target: { value: "manual_deduction" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ghi điều chỉnh" }));
    await waitFor(() => expect(actions.addPayrollManualLineAction).toHaveBeenLastCalledWith({ amountVnd: 125000, lineType: "manual_deduction", note: "Thưởng hỗ trợ", payrollStatementId: statementId }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    second.resolve({ message: "Đã thêm.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("downloads excel template with correct filename when Tải tệp mẫu button is clicked", async () => {
    render(<PayrollImportDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Nhập Excel" }));
    const dialog = screen.getByRole("dialog", { name: "Nhập dữ liệu dự phòng từ Excel" });
    expect(dialog).toBeInTheDocument();

    const downloadButton = within(dialog).getByRole("button", { name: "Tải tệp mẫu" });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockToFile).toHaveBeenCalledWith("mau-timekeeping.xlsx");
    });

    fireEvent.change(screen.getByLabelText("Loại dữ liệu"), { target: { value: "grading" } });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockToFile).toHaveBeenCalledWith("mau-grading.xlsx");
    });
  });

  it("displays clear error when adjusting a stale revision statement", async () => {
    const pending = deferred<{ message: string; status: "error" }>();
    actions.addPayrollManualLineAction.mockReset().mockReturnValueOnce(pending.promise);
    render(<PayrollManualLineDialog payrollStatementId={statementId} staffDisplayName="Nguyễn Minh An" />);

    const trigger = screen.getByRole("button", { name: "Điều chỉnh" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Điều chỉnh bảng lương" });
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "50000" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Thưởng dự án" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ghi điều chỉnh" }));

    await waitFor(() => expect(actions.addPayrollManualLineAction).toHaveBeenCalledOnce());

    pending.resolve({
      message:
        "Chỉ có thể điều chỉnh trên bản tính lương nháp hiện tại. Hãy tải lại trang và kiểm tra trước khi thực hiện.",
      status: "error",
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Chỉ có thể điều chỉnh trên bản tính lương nháp hiện tại. Hãy tải lại trang và kiểm tra trước khi thực hiện.",
    );
  });

  it("displays clear error when attempting self-adjustment on own statement", async () => {
    const pending = deferred<{ message: string; status: "error" }>();
    actions.addPayrollManualLineAction.mockReset().mockReturnValueOnce(pending.promise);
    render(<PayrollManualLineDialog payrollStatementId={statementId} staffDisplayName="Nguyễn Minh An" />);

    const trigger = screen.getByRole("button", { name: "Điều chỉnh" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Điều chỉnh bảng lương" });
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "50000" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Thưởng dự án" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ghi điều chỉnh" }));

    await waitFor(() => expect(actions.addPayrollManualLineAction).toHaveBeenCalledOnce());

    pending.resolve({
      message: "Không thể tự thêm điều chỉnh cho bảng lương của chính mình.",
      status: "error",
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không thể tự thêm điều chỉnh cho bảng lương của chính mình.");
  });

  it("passes CURRENT statement id from PayrollPage to addPayrollManualLineAction", async () => {
    const currentStatementId = "fa70d806-18e0-4b04-af6e-b045156a13fa";
    actions.addPayrollManualLineAction.mockResolvedValueOnce({ message: "Đã thêm.", status: "success" });

    const currentPeriod = period({
      feedbackClosedAt: null,
      id: "current-period-id",
      statements: [
        {
          id: currentStatementId,
          lines: [line({ id: "current-line-1", payrollStatementId: currentStatementId })],
          payableAmountVnd: 500000,
          payrollPeriodId: "current-period-id",
          staffDisplayName: "Nguyễn Minh An",
          staffEmployeeCode: "NV17",
          staffId: "staff-nv17",
          totalDeductionsVnd: 0,
          totalEarningsVnd: 500000,
          workHours: 9,
          workMinutes: 540,
          workUnits: 1,
        },
      ],
      status: "draft",
    });

    render(<PayrollPage canApprove={false} canManage canReconcile={false} periods={[currentPeriod]} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    const payslipDialog = screen.getByRole("dialog", { name: /Phiếu lương/ });
    expect(payslipDialog).toBeInTheDocument();

    fireEvent.click(within(payslipDialog).getByRole("button", { name: "Điều chỉnh" }));
    const manualDialog = screen.getByRole("dialog", { name: "Điều chỉnh bảng lương" });
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Thưởng đúng phiên bản" } });
    fireEvent.click(within(manualDialog).getByRole("button", { name: "Ghi điều chỉnh" }));

    await waitFor(() =>
      expect(actions.addPayrollManualLineAction).toHaveBeenCalledWith({
        amountVnd: 100000,
        lineType: "manual_reward",
        note: "Thưởng đúng phiên bản",
        payrollStatementId: currentStatementId,
      }),
    );
  });

  it("renders rich context details for payroll calculation issues", () => {
    const testIssues = [
      {
        details: {
          amount_vnd: 50000000,
          event_date: "2026-07-02",
          grade: 7,
          source_key: "renewal-order-123",
        },
        id: "issue-1111-1111-1111-111111111111",
        issueCode: "missing_grade_assignment",
        payrollPeriodId: "22222222-2222-4222-8222-222222222222",
        periodMonth: "2026-07-01",
        revision: 1,
        severity: "blocking" as const,
        sourceFactId: "fact-1111-1111-1111-111111111111",
        staffId: null,
      },
      {
        details: {
          amount_vnd: 10000000,
          event_date: "2026-07-05",
          source_code: "teacher_vinh_zalo_direct_referral",
          source_key: "new-enroll-456",
        },
        id: "issue-2222-2222-2222-222222222222",
        issueCode: "missing_source_mapping",
        payrollPeriodId: "22222222-2222-4222-8222-222222222222",
        periodMonth: "2026-07-01",
        revision: 1,
        severity: "blocking" as const,
        sourceFactId: "fact-2222-2222-2222-222222222222",
        staffId: "staff-nv13-uuid",
      },
    ];

    render(
      <PayrollPage
        canApprove={false}
        canManage
        canReconcile={false}
        issues={testIssues}
        periods={[period()]}
      />,
    );

    expect(screen.getByText("Dữ liệu cần xử lý trước khi đối soát")).toBeInTheDocument();
    expect(screen.getByText(/Khối chưa có trợ lý vận hành phụ trách/)).toBeInTheDocument();
    expect(screen.getByText(/Khối 7 · Ngày 2026-07-02 · 50\.000\.000 VND · Mã đơn: renewal-order-123/)).toBeInTheDocument();
    expect(screen.getByText(/Nguồn tuyển sinh chưa được ánh xạ/)).toBeInTheDocument();
    expect(screen.getByText(/Ngày 2026-07-05 · Nguồn: teacher_vinh_zalo_direct_referral · 10\.000\.000 VND · Mã đơn: new-enroll-456/)).toBeInTheDocument();
  });
});
