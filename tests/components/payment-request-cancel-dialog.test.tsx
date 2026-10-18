// Value: protects=the "Hủy phiếu" dialog: an outline-danger trigger named "Hủy phiếu thu {code}", a solid-danger confirm inside the dialog, the reason rule (3+ characters) checked before any call, at most one alert (the action's message) with the field error as a plain described line, an injected action used instead of the real one, and success closing the dialog with a refresh and focus back on the trigger;
// fails_when=the dialog calls cancelPaymentRequestAction despite an override, submits an empty reason, renders the field error as a second alert, keeps the dialog open or skips the refresh on success, or the trigger turns into a solid danger button;
// why_new=step 14c adds the action override and restyles the dialog; no other suite opens it;
// also: the directory's page notice "Đã hủy phiếu thu {code}." after a success (focus moves to it; the next filter, page, chip or dialog clears it);
// seam=next/navigation offers useRouter and an empty useSearchParams (for the directory); the finance actions module is mocked so the default fallback is observable; no_claim=which rows show the trigger (payment-request-directory-presentation.test.tsx)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as financeActions from "@/features/finance/actions/finance-actions";
import { PaymentRequestCancelDialog } from "@/features/finance/components/payment-request-cancel-dialog";
import { PaymentRequestDirectory } from "@/features/finance/payment-request-directory";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/features/finance/actions/finance-actions", () => ({
  allocatePaymentAction: vi.fn(),
  cancelPaymentRequestAction: vi.fn(),
  createPaymentRequestAction: vi.fn(),
  setFinanceOrderReviewAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const item: PaymentRequestReadModel = { bonusSessions: 0, calculatedUnitPriceVnd: 140_000, createdAt: "2026-10-10T03:00:00Z", expectedAmountVnd: 1_400_000, guardianFullName: "Nguyễn Thị Mai", guardianPhone: "0900000000", id: "request-1", notes: null, paidAmountVnd: 0, paidAt: null, publicCode: "YC-001", purchasedSessions: 10, status: "pending", studentFullName: "Nguyễn Minh An", studentId: "student-1", studentPublicCode: "HV001", topupType: "new", transferCode: "TTVC YC001" };

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Hủy phiếu thu YC-001" }));
  return screen.getByRole("dialog", { name: "Hủy phiếu thu YC-001" });
}

describe("PaymentRequestCancelDialog", () => {
  it("uses an outline-danger trigger and a solid-danger confirm, and checks the reason before calling anything", () => {
    const cancel = vi.fn();
    render(<PaymentRequestCancelDialog actions={{ cancelPaymentRequest: cancel }} item={item} />);

    const trigger = screen.getByRole("button", { name: "Hủy phiếu thu YC-001" });
    expect(trigger).toHaveTextContent("Hủy phiếu");
    expect(trigger).toHaveClass("border-danger", "h-8");
    expect(trigger).not.toHaveClass("bg-danger");

    const dialog = openDialog();
    expect(within(dialog).getByText(/1\.400\.000 ₫/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Xác nhận hủy" });
    expect(confirm).toHaveClass("bg-danger");
    expect(within(dialog).getByRole("button", { name: "Giữ phiếu" })).toBeInTheDocument();

    const reason = within(dialog).getByLabelText("Lý do hủy");
    fireEvent.change(reason, { target: { value: "  a " } });
    fireEvent.click(confirm);

    expect(cancel).not.toHaveBeenCalled();
    const fieldError = within(dialog).getByText("Nhập lý do hủy ít nhất 3 ký tự.");
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveAttribute("aria-describedby", fieldError.id);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows one alert for a refusal, keeps the field error a described line, and never refreshes", async () => {
    const cancel = vi.fn().mockResolvedValue({
      fieldErrors: { reason: ["Lý do hủy không được vượt quá 1.000 ký tự."] },
      message: "Vui lòng kiểm tra lý do hủy phiếu.",
      status: "error",
    });
    render(<PaymentRequestCancelDialog actions={{ cancelPaymentRequest: cancel }} item={item} />);

    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), { target: { value: "Tạo nhầm số buổi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Vui lòng kiểm tra lý do hủy phiếu.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    const fieldError = within(dialog).getByText("Lý do hủy không được vượt quá 1.000 ký tự.");
    expect(fieldError).not.toHaveAttribute("role");
    expect(within(dialog).getByLabelText("Lý do hủy")).toHaveAttribute("aria-describedby", fieldError.id);
    expect(cancel).toHaveBeenCalledWith({ reason: "Tạo nhầm số buổi", requestId: "request-1" });
    expect(financeActions.cancelPaymentRequestAction).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("brings focus back into the dialog after a refusal, so Escape and the focus trap keep working", async () => {
    const cancel = vi.fn()
      .mockResolvedValueOnce({ message: "Phiếu này thuộc một kỳ thu học phí đã khóa.", status: "error" })
      .mockResolvedValueOnce({ fieldErrors: { reason: ["Lý do hủy không được vượt quá 1.000 ký tự."] }, message: "Vui lòng kiểm tra lý do hủy phiếu.", status: "error" });
    render(<PaymentRequestCancelDialog actions={{ cancelPaymentRequest: cancel }} item={item} />);

    let dialog = openDialog();
    // The dialog's own initial focus (next frame) lands first, as it would for a person.
    await waitFor(() => expect(within(dialog).getByLabelText("Lý do hủy")).toHaveFocus());
    fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), { target: { value: "Tạo nhầm số buổi" } });
    let confirm = within(dialog).getByRole("button", { name: "Xác nhận hủy" });
    confirm.focus();
    fireEvent.click(confirm);
    // No field error: the error banner takes focus.
    const alert = await within(dialog).findByRole("alert");
    await waitFor(() => expect(alert.closest("[tabindex='-1']")).toHaveFocus());
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    dialog = openDialog();
    const reason = within(dialog).getByLabelText("Lý do hủy");
    await waitFor(() => expect(reason).toHaveFocus());
    fireEvent.change(reason, { target: { value: "Tạo nhầm số buổi" } });
    confirm = within(dialog).getByRole("button", { name: "Xác nhận hủy" });
    confirm.focus();
    fireEvent.click(confirm);
    // A reason error: the field takes focus.
    await within(dialog).findByText("Lý do hủy không được vượt quá 1.000 ký tự.");
    await waitFor(() => expect(reason).toHaveFocus());
    fireEvent.keyDown(reason, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("closes, refreshes and returns focus to the trigger on success", async () => {
    const cancel = vi.fn().mockResolvedValue({ id: "request-1", message: "Đã hủy phiếu thu.", status: "success" });
    render(<PaymentRequestCancelDialog actions={{ cancelPaymentRequest: cancel }} item={item} triggerSize="lg" />);

    const trigger = screen.getByRole("button", { name: "Hủy phiếu thu YC-001" });
    expect(trigger).toHaveClass("h-11");
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), { target: { value: "Đã lập phiếu mới" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("falls back to the real action without an override, and Giữ phiếu closes without a call", async () => {
    vi.mocked(financeActions.cancelPaymentRequestAction).mockResolvedValue({ message: "Không thể kết nối hệ thống tài chính.", status: "error" });
    render(<PaymentRequestCancelDialog item={item} />);

    let dialog = openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Giữ phiếu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(financeActions.cancelPaymentRequestAction).not.toHaveBeenCalled();

    dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), { target: { value: "Tạo nhầm" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Không thể kết nối hệ thống tài chính.");
    expect(financeActions.cancelPaymentRequestAction).toHaveBeenCalledWith({ reason: "Tạo nhầm", requestId: "request-1" });
  });

  it("tells the page about a success: a focused status notice that the next dialog, chip or filter clears", async () => {
    const cancel = vi.fn().mockResolvedValue({ id: "request-9", message: "Đã hủy phiếu thu.", status: "success" });
    const onCancelled = vi.fn();
    const { unmount } = render(<PaymentRequestCancelDialog actions={{ cancelPaymentRequest: cancel }} item={item} onCancelled={onCancelled} />);
    let dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), { target: { value: "Tạo nhầm" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" }));
    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(item));
    unmount();

    const pending = { ...item, id: "request-9", publicCode: "YC-009" };
    const paid = { ...item, id: "request-8", paidAmountVnd: 1_400_000, paidAt: "2026-10-12T03:00:00Z", publicCode: "YC-008", status: "paid" as const };
    render(<PaymentRequestDirectory actions={{ cancelPaymentRequest: cancel }} canCancelPaymentRequests canCreatePaymentRequests={false} items={[pending, paid]} today="2026-10-16" />);
    const confirmCancel = async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Hủy phiếu thu YC-009" })[0]);
      dialog = screen.getByRole("dialog", { name: "Hủy phiếu thu YC-009" });
      fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), { target: { value: "Tạo nhầm số buổi" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" }));
      return screen.findByText("Đã hủy phiếu thu YC-009.");
    };

    const notice = await confirmCancel();
    expect(notice.closest("[role='status']")).not.toBeNull();
    await waitFor(() => expect(notice.closest("[tabindex='-1']")).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledTimes(2);

    // Opening the dialog again drops it.
    fireEvent.click(screen.getAllByRole("button", { name: "Hủy phiếu thu YC-009" })[0]);
    expect(screen.queryByText("Đã hủy phiếu thu YC-009.")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Giữ phiếu" }));

    // So does a chip (any filter or page write).
    await confirmCancel();
    fireEvent.click(within(screen.getByRole("group", { name: "Lọc nhanh yêu cầu thanh toán" })).getByRole("button", { name: /^Đã thanh toán/ }));
    expect(screen.queryByText("Đã hủy phiếu thu YC-009.")).not.toBeInTheDocument();
    expect(financeActions.cancelPaymentRequestAction).not.toHaveBeenCalled();
  });
});
