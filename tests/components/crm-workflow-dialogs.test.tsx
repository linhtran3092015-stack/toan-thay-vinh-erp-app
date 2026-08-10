import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CrmConversionChecklistDialog } from "@/features/crm/components/crm-conversion-checklist-dialog";
import { CrmLeadTransferDialog } from "@/features/crm/components/crm-lead-transfer-dialog";
import { CrmTrialBookingDialog } from "@/features/crm/components/crm-trial-booking-dialog";

const actions = vi.hoisted(() => ({ bookTrialAction: vi.fn(), convertStudentAction: vi.fn(), transferLeadAction: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/crm/actions/crm-actions", () => actions);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const checklist = { completedAt: null, completedByName: null, id: "checklist-1", isFullyCompleted: false, item1PaymentReceived: false, item2SourceConfirmed: false, item3SaleConfirmed: false, item4ClassSelected: false, item5ModeConfirmed: false, item6FeeConfirmed: false, item7AssistantSessionsConfirmed: false, item8AccountantTransactionConfirmed: false, item9OfficialStartDateEntered: false, item10CommunicationGroupReady: false };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("CRM high-trust workflow presentation", () => {
  it("keeps existing trial inputs in a labelled focus-safe dialog", () => {
    render(<CrmTrialBookingDialog crmCaseId="case-1" />);
    const trigger = screen.getByRole("button", { name: "Đặt lịch học thử" });
    trigger.focus(); fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Đặt lịch học thử" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ngày học thử dự kiến/)).toHaveAttribute("type", "date");
    expect(screen.getByLabelText(/Hình thức học thử/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(trigger).toHaveFocus();
  });

  it("keeps the existing trial dialog open and submission singular while its action is pending", async () => {
    const pending = deferred<{ id: string; message: string; status: "success" }>();
    actions.bookTrialAction.mockReturnValueOnce(pending.promise);
    render(<CrmTrialBookingDialog crmCaseId="case-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Đặt lịch học thử" }));
    fireEvent.change(screen.getByLabelText(/Ngày học thử dự kiến/), { target: { value: "2026-08-10" } });
    const dialog = screen.getByRole("dialog", { name: "Đặt lịch học thử" });
    const submit = within(dialog).getByRole("button", { name: "Xác nhận đặt lịch" });
    fireEvent.click(submit);
    await waitFor(() => expect(actions.bookTrialAction).toHaveBeenCalledOnce());
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(submit);
    expect(screen.getByRole("dialog", { name: "Đặt lịch học thử" })).toBeInTheDocument();
    expect(actions.bookTrialAction).toHaveBeenCalledOnce();
    pending.resolve({ id: "trial-1", message: "ok", status: "success" });
  });

  it("retains transfer reason and explicit confirmation presentation", () => {
    render(<CrmLeadTransferDialog crmCaseId="case-1" currentSaleOwnerId="sale-1" saleOwners={[{ fullName: "Sale hiện tại", id: "sale-1" }, { fullName: "Sale mới", id: "sale-2" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Chuyển giao Lead" }));
    expect(screen.getByRole("dialog", { name: "Xác nhận chuyển giao Lead" })).toBeInTheDocument();
    const reason = screen.getByLabelText(/Lý do chuyển giao/);
    expect(reason).toHaveAttribute("id", "crm-transfer-reason");
    expect(screen.queryByRole("option", { name: "Sale hiện tại" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sale mới" })).toBeInTheDocument();
  });

  it("keeps the existing transfer confirmation open and submission singular while pending", async () => {
    const pending = deferred<{ id: string; message: string; status: "success" }>();
    actions.transferLeadAction.mockReturnValueOnce(pending.promise);
    render(<CrmLeadTransferDialog crmCaseId="case-1" currentSaleOwnerId="sale-1" saleOwners={[{ fullName: "Sale hiện tại", id: "sale-1" }, { fullName: "Sale mới", id: "sale-2" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Chuyển giao Lead" }));
    fireEvent.change(screen.getByLabelText(/Chọn Sale nhận Lead/), { target: { value: "sale-2" } });
    fireEvent.change(screen.getByLabelText(/Lý do chuyển giao/), { target: { value: "Bàn giao theo khu vực." } });
    const dialog = screen.getByRole("dialog", { name: "Xác nhận chuyển giao Lead" });
    const submit = within(dialog).getByRole("button", { name: "Xác nhận chuyển giao" });
    fireEvent.click(submit);
    await waitFor(() => expect(actions.transferLeadAction).toHaveBeenCalledOnce());
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(submit);
    expect(screen.getByRole("dialog", { name: "Xác nhận chuyển giao Lead" })).toBeInTheDocument();
    expect(actions.transferLeadAction).toHaveBeenCalledOnce();
    pending.resolve({ id: "case-1", message: "ok", status: "success" });
  });

  it("keeps accountant-only checklist item presentation", () => {
    render(<CrmConversionChecklistDialog checklist={checklist} classes={[{ code: "A01", id: "class-1", name: "Lớp A01" }]} crmCaseId="case-1" hasAccountantPermission={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển đổi" }));
    expect(screen.getByRole("dialog", { name: "Xác nhận chuyển thành học viên chính thức" })).toBeInTheDocument();
    expect(screen.getByText(/Yêu cầu quyền kế toán sepay.accountant_confirm/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Kế toán xác nhận giao dịch/)).toBeDisabled();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận chuyển đổi" })).toBeDisabled();
  });

  it("prevents duplicate conversion submission while the existing action is pending", async () => {
    let resolve!: (result: { id: string; message: string; status: "success" }) => void;
    actions.convertStudentAction.mockReturnValueOnce(new Promise((next) => { resolve = next; }));
    render(<CrmConversionChecklistDialog checklist={checklist} classes={[{ code: "A01", id: "class-1", name: "Lớp A01" }]} crmCaseId="case-1" hasAccountantPermission />);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển đổi" }));
    fireEvent.change(screen.getByLabelText(/Chọn lớp chính thức/), { target: { value: "class-1" } });
    fireEvent.change(screen.getByLabelText(/Ngày bắt đầu học chính/), { target: { value: "2026-08-10" } });
    for (const control of screen.getAllByRole("checkbox")) {
      if (!(control as HTMLInputElement).checked) fireEvent.click(control);
    }
    const submit = within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận chuyển đổi" });
    fireEvent.click(submit);
    await waitFor(() => expect(actions.convertStudentAction).toHaveBeenCalledOnce());
    fireEvent.click(submit);
    expect(actions.convertStudentAction).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    resolve({ id: "student-1", message: "ok", status: "success" });
  });
});
