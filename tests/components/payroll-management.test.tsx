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
    const renderedPeriod = period({ statements: [{ ...period().statements[0], lines: allLineTypes }] });

    render(<PayrollPage canApprove={false} canManage canReconcile={false} periods={[renderedPeriod]} />);

    expect(screen.getByRole("table", { name: "Danh sách bảng lương nhân sự" })).toHaveTextContent("777 VND");
    expect(screen.getAllByText("888 VND")).not.toHaveLength(0);
    expect(screen.getAllByText("111 VND")).not.toHaveLength(0);
    expect(screen.getAllByText("2 công")).not.toHaveLength(0);
    expect(screen.getAllByText("18 giờ")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /gửi đối soát|duyệt/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("Gross");
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("Gross − Khấu trừ = Thực nhận");
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("Công & giờ làm");
    expect(screen.getByRole("dialog", { name: /Phiếu lương/ })).toHaveTextContent("Chấm bài");
    expect(screen.getAllByText("Lương theo giờ")).not.toHaveLength(0);
    expect(screen.getAllByText("Thưởng doanh thu")).not.toHaveLength(0);
    expect(screen.getAllByText("Thưởng KPI")).not.toHaveLength(0);
    expect(screen.getAllByText("Thưởng chấm bài")).not.toHaveLength(0);
    expect(screen.getAllByText("Hoa hồng")).not.toHaveLength(0);
    expect(screen.getAllByText("Thưởng thủ công")).not.toHaveLength(0);
    expect(screen.getAllByText("Khấu trừ thủ công")).not.toHaveLength(0);
    expect(screen.getAllByText("Khấu trừ tạm ứng")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã ghi nhận")).not.toHaveLength(0);
    expect(screen.queryByText("Số lượng: 0")).not.toBeInTheDocument();
    expect(screen.queryByText("Đơn giá: 0 VND")).not.toBeInTheDocument();
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
      message: "Không thể tự thêm thưởng hoặc khấu trừ cho bảng lương của chính mình.",
      status: "error",
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không thể tự thêm thưởng hoặc khấu trừ cho bảng lương của chính mình.");
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
