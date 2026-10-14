// Value: protects=the CRM dialogs keep their labelled, focus-safe, single-submit behaviour and the accountant-only checklist item; the conversion dialog offers only the registered modes the conversion RPC accepts (online/offline) and the client schema rejects "hybrid";
// fails_when=a dialog closes or resubmits while its action is pending, the transfer list offers the current sale, item 8 becomes tickable without sepay.accountant_confirm, or "Hybrid (Kết hợp)" comes back although convert_crm_case_to_official_student raises REGISTERED_MODE_INVALID for it;
// why_new=step 10 removes the hybrid option (pre-existing bug) and adds this card to the file it extends;
// seam=the CRM actions module and next/navigation are mocked; no_claim=does not call the RPC (the mode check was read from the 2026-10-13 migration)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CrmCaseNotesPanel } from "@/features/crm/components/crm-case-notes-panel";
import { CrmCaseStatusDialog } from "@/features/crm/components/crm-case-status-dialog";
import { CrmConversionChecklistDialog } from "@/features/crm/components/crm-conversion-checklist-dialog";
import { CrmLeadTransferDialog } from "@/features/crm/components/crm-lead-transfer-dialog";
import { CrmTrialBookingDialog } from "@/features/crm/components/crm-trial-booking-dialog";
import { CrmTrialResultDialog } from "@/features/crm/components/crm-trial-result-dialog";
import { convertStudentSchema } from "@/features/crm/forms/crm-schemas";

const actions = vi.hoisted(() => ({
  addCaseNoteAction: vi.fn(),
  bookTrialAction: vi.fn(),
  changeCaseStatusAction: vi.fn(),
  completeFollowUpAction: vi.fn(),
  convertStudentAction: vi.fn(),
  recordTrialResultAction: vi.fn(),
  transferLeadAction: vi.fn(),
}));
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
    // Same sentence as the checklist panel's item-8 hint; no raw permission code.
    expect(screen.getByText("Người xác nhận chuyển đổi cần thêm quyền xác nhận giao dịch (kế toán).")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).not.toHaveTextContent("sepay.accountant_confirm");
    expect(screen.getByLabelText(/Kế toán xác nhận giao dịch/)).toBeDisabled();
    expect(screen.getByLabelText(/Kế toán xác nhận giao dịch/)).toHaveAccessibleDescription("Người xác nhận chuyển đổi cần thêm quyền xác nhận giao dịch (kế toán).");
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

  it("offers only the registered modes the conversion RPC accepts", () => {
    render(<CrmConversionChecklistDialog checklist={checklist} classes={[{ code: "A01", id: "class-1", name: "Lớp A01" }]} crmCaseId="case-1" hasAccountantPermission />);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển đổi" }));
    const mode = screen.getByLabelText(/Hình thức đăng ký/);
    expect(within(mode).getAllByRole("option").map((option) => (option as HTMLOptionElement).value)).toEqual(["offline", "online"]);
    expect(within(mode).queryByRole("option", { name: /Hybrid/ })).not.toBeInTheDocument();

    const input = {
      checklistItems: { item10CommunicationGroupReady: true, item1PaymentReceived: true, item2SourceConfirmed: true, item3SaleConfirmed: true, item4ClassSelected: true, item5ModeConfirmed: true, item6FeeConfirmed: true, item7AssistantSessionsConfirmed: true, item8AccountantTransactionConfirmed: true, item9OfficialStartDateEntered: true },
      classId: "9f1c2a4e-0000-4000-8000-000000000001",
      crmCaseId: "9f1c2a4e-0000-4000-8000-000000000002",
      officialStartDate: "2026-10-20",
    };
    expect(convertStudentSchema.safeParse({ ...input, registeredMode: "offline" }).success).toBe(true);
    expect(convertStudentSchema.safeParse({ ...input, registeredMode: "hybrid" }).success).toBe(false);
  });

  // Value (extension, fix pass 1): protects=the real /crm/[caseId] page, which passes no action overrides, still submits the status, trial-result and notes controls through the real CRM server actions;
  // fails_when=a default `action = …Action` parameter or the `actions?.x ?? xAction` fallback is dropped, so the preview's override seam silently disables the live page;
  // why_new=step 10 added the override props and only the inert preview exercises them; seam=the CRM actions module is mocked (resolves success); no_claim=does not run the server actions
  it("falls back to the real actions when no override is passed", async () => {
    const ok = { id: "x", message: "Đã lưu.", status: "success" as const };
    actions.changeCaseStatusAction.mockResolvedValue(ok);
    actions.recordTrialResultAction.mockResolvedValue(ok);
    actions.addCaseNoteAction.mockResolvedValue(ok);
    actions.completeFollowUpAction.mockResolvedValue(ok);

    const { unmount: unmountStatus } = render(<CrmCaseStatusDialog crmCaseId="case-1" targetStatus="dropped" />);
    fireEvent.click(screen.getByRole("button", { name: "Dừng lead" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText(/Lý do/), { target: { value: "Phụ huynh chọn nơi khác" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận dừng" }));
    await waitFor(() => expect(actions.changeCaseStatusAction).toHaveBeenCalledOnce());
    expect(actions.changeCaseStatusAction).toHaveBeenCalledWith({ crmCaseId: "case-1", reason: "Phụ huynh chọn nơi khác", targetStatus: "dropped" });
    unmountStatus();

    const { unmount: unmountTrial } = render(<CrmTrialResultDialog bookingId="trial-1" crmCaseId="case-1" trialDateLabel="19/10/2026" />);
    fireEvent.click(screen.getByRole("button", { name: "Ghi kết quả" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Lưu kết quả" }));
    await waitFor(() => expect(actions.recordTrialResultAction).toHaveBeenCalledOnce());
    unmountTrial();

    render(
      <CrmCaseNotesPanel
        canUpdate
        crmCaseId="case-1"
        notes={[{ createdAt: "2026-10-10T03:00:00Z", createdBy: "sale-1", createdByName: "Hoàng Minh Khôi", followUpAt: "2026-10-16", followUpDoneAt: null, followUpDoneByName: null, id: "note-1", note: "Gọi lại." }]}
        todayIso="2026-10-14"
      />,
    );
    fireEvent.change(screen.getByLabelText("Ghi chú mới"), { target: { value: "Gọi lại sau giờ học." } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    await waitFor(() => expect(actions.addCaseNoteAction).toHaveBeenCalledOnce());
    const done = screen.getByRole("button", { name: "Đã xử lý" });
    await waitFor(() => expect(done).toBeEnabled());
    fireEvent.click(done);
    await waitFor(() => expect(actions.completeFollowUpAction).toHaveBeenCalledOnce());
    expect(actions.completeFollowUpAction).toHaveBeenCalledWith({ crmCaseId: "case-1", noteId: "note-1" });
  });
});
