import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SepayReconciliationActions,
  isSepayTransactionReconcilable,
} from "@/features/finance/components/sepay-reconciliation-actions";
import { SepayReconciliationDialog } from "@/features/finance/components/sepay-reconciliation-dialog";
import {
  matchSepayHistoricalTransactionAction,
  resolveSepayHistoricalTransactionAction,
  searchSepayReconciliationCandidatesAction,
} from "@/features/finance/sepay-reconciliation-actions";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/finance/sepay-reconciliation-actions", () => ({
  matchSepayHistoricalTransactionAction: vi.fn(),
  resolveSepayHistoricalTransactionAction: vi.fn(),
  searchSepayReconciliationCandidatesAction: vi.fn(),
}));

const transaction: SepayTransactionReadModel = {
  accountNumber: "1001",
  accountPurpose: "new_enrollment",
  amountVnd: 1_000_000,
  bankBrand: "VCB",
  bankTransactionId: "api-transaction",
  createdAt: "2026-08-15T02:00:00.000Z",
  id: "91000000-0000-4000-8000-000000000001",
  ingestionSource: "api_v2",
  matchStatus: "unmatched",
  matchedAt: null,
  matchedPaymentRequestCode: null,
  matchedStudentFullName: null,
  referenceNumber: "REF-1",
  sepayV2Id: "92000000-0000-4000-8000-000000000001",
  transactionAt: "2026-08-15T02:00:00.000Z",
  transferContent: "TTV PAY DANG KY MOI",
  transferType: "in",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("SePay reconciliation UI and dialog interactions", () => {
  it("determines reconcilable eligibility correctly", () => {
    expect(isSepayTransactionReconcilable(transaction)).toBe(true);
    expect(isSepayTransactionReconcilable({ ...transaction, sepayV2Id: null })).toBe(false);
    expect(isSepayTransactionReconcilable({ ...transaction, transferType: "out" })).toBe(false);
    expect(isSepayTransactionReconcilable({ ...transaction, matchStatus: "auto_matched" })).toBe(false);
    expect(isSepayTransactionReconcilable({ ...transaction, matchStatus: "identity_conflict" })).toBe(true);
  });

  it("renders non-reconcilable indicator for ineligible transactions", () => {
    render(<SepayReconciliationActions
      candidates={[]}
      transaction={{ ...transaction, matchStatus: "auto_matched" }}
    />);
    expect(screen.getByText("Không cần thao tác")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
  });

  it("opens dialog on button click and displays complete transaction details without truncation", () => {
    render(<SepayReconciliationActions
      candidates={[]}
      transaction={transaction}
    />);

    const triggerButton = screen.getByRole("button", { name: "Đối soát" });
    expect(triggerButton).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(triggerButton);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("api-transaction")).toBeInTheDocument();
    expect(screen.getByText("TTV PAY DANG KY MOI")).toBeInTheDocument();
    expect(screen.getByText("92000000-0000-4000-8000-000000000001")).toBeInTheDocument();
    expect(screen.getByText(/VCB ·/)).toBeInTheDocument();
    expect(screen.getByText("1001")).toBeInTheDocument();
    expect(screen.getByText(/Lịch sử API/)).toBeInTheDocument();
  });

  it("matches only a same-purpose, same-amount pending request after a valid reason is entered", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(matchSepayHistoricalTransactionAction).mockResolvedValue({ message: "Đã khớp", ok: true });

    render(<SepayReconciliationActions
      candidates={[
        { expectedAmountVnd: 1_000_000, id: "93000000-0000-4000-8000-000000000001", publicCode: "PAY-NEW", studentFullName: "Học viên A", topupType: "new" },
        { expectedAmountVnd: 1_000_000, id: "93000000-0000-4000-8000-000000000002", publicCode: "PAY-RENEW", studentFullName: "Học viên B", topupType: "renewal" },
      ]}
      defaultOpen
      transaction={transaction}
    />);

    expect(screen.getByRole("option", { name: /PAY-NEW/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /PAY-RENEW/ })).not.toBeInTheDocument();

    const matchButton = screen.getByRole("button", { name: "Khớp và ghi nhận học phí" });
    expect(matchButton).toBeDisabled();

    // Invalid reason (< 3 chars)
    fireEvent.change(screen.getByPlaceholderText(/Nêu căn cứ đối soát/), { target: { value: "ok" } });
    expect(screen.getByText("Lý do phải có ít nhất 3 ký tự.")).toBeInTheDocument();
    expect(matchButton).toBeDisabled();

    // Valid reason and select candidate
    fireEvent.change(screen.getByPlaceholderText(/Nêu căn cứ đối soát/), { target: { value: "Đã kiểm tra sao kê" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "93000000-0000-4000-8000-000000000001" } });

    expect(matchButton).toBeEnabled();
    fireEvent.click(matchButton);

    await waitFor(() => expect(matchSepayHistoricalTransactionAction).toHaveBeenCalledWith({
      paymentRequestId: "93000000-0000-4000-8000-000000000001",
      reason: "Đã kiểm tra sao kê",
      transactionId: transaction.id,
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it("can mark an imported transaction as already accounted without choosing a payment request", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(resolveSepayHistoricalTransactionAction).mockResolvedValue({ message: "Đã đánh dấu", ok: true });

    render(<SepayReconciliationActions
      candidates={[]}
      defaultOpen
      transaction={transaction}
    />);

    fireEvent.change(screen.getByPlaceholderText(/Nêu căn cứ đối soát/), { target: { value: "Đã nhập sổ trước đây" } });
    fireEvent.click(screen.getByRole("button", { name: "Đã hạch toán trước đây" }));

    await waitFor(() => expect(resolveSepayHistoricalTransactionAction).toHaveBeenCalledWith({
      reason: "Đã nhập sổ trước đây",
      resolution: "already_accounted",
      transactionId: transaction.id,
    }));
  });

  it("finds an older compatible payment request by code without exposing broad payment data", async () => {
    vi.mocked(searchSepayReconciliationCandidatesAction).mockResolvedValue({
      candidates: [{ expectedAmountVnd: 1_000_000, id: "93000000-0000-4000-8000-000000000009", publicCode: "PAY-OLD", studentFullName: "Học viên C", topupType: "new" }],
      ok: true,
    });

    render(<SepayReconciliationActions
      candidates={[]}
      defaultOpen
      transaction={transaction}
    />);

    fireEvent.change(screen.getByLabelText("Tìm yêu cầu thanh toán"), { target: { value: "PAY-OLD" } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm" }));

    await waitFor(() => expect(searchSepayReconciliationCandidatesAction).toHaveBeenCalledWith({
      query: "PAY-OLD",
      transactionId: transaction.id,
    }));
    expect(await screen.findByRole("option", { name: /PAY-OLD/ })).toBeInTheDocument();
  });

  it("does not post a payment match when the operator cancels confirmation", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));

    render(<SepayReconciliationActions
      candidates={[{ expectedAmountVnd: 1_000_000, id: "93000000-0000-4000-8000-000000000001", publicCode: "PAY-NEW", studentFullName: "Học viên A", topupType: "new" }]}
      defaultOpen
      transaction={transaction}
    />);

    fireEvent.change(screen.getByPlaceholderText(/Nêu căn cứ đối soát/), { target: { value: "Đã kiểm tra sao kê" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "93000000-0000-4000-8000-000000000001" } });
    fireEvent.click(screen.getByRole("button", { name: "Khớp và ghi nhận học phí" }));

    expect(matchSepayHistoricalTransactionAction).not.toHaveBeenCalled();
  });

  it("lets an owner close an identity conflict without offering a new tuition match", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(resolveSepayHistoricalTransactionAction).mockResolvedValue({ message: "Đã bỏ qua", ok: true });

    render(<SepayReconciliationActions
      candidates={[]}
      defaultOpen
      transaction={{ ...transaction, matchStatus: "identity_conflict" }}
    />);

    expect(screen.getByText(/Giao dịch trùng nhận diện/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Khớp và ghi nhận học phí" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tìm yêu cầu thanh toán")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Nêu căn cứ đối soát/), { target: { value: "Bản ghi trùng giao dịch cũ" } });
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));

    await waitFor(() => expect(resolveSepayHistoricalTransactionAction).toHaveBeenCalledWith({
      reason: "Bản ghi trùng giao dịch cũ",
      resolution: "ignored",
      transactionId: transaction.id,
    }));
  });

  it("preserves form inputs when server returns an error to allow safe retry", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(resolveSepayHistoricalTransactionAction).mockResolvedValue({
      message: "Lỗi kết nối CSDL, vui lòng thử lại.",
      ok: false,
    });

    render(<SepayReconciliationActions
      candidates={[]}
      defaultOpen
      transaction={transaction}
    />);

    const reasonInput = screen.getByPlaceholderText(/Nêu căn cứ đối soát/);
    fireEvent.change(reasonInput, { target: { value: "Đã đối chiếu sổ phụ chi tiết" } });
    fireEvent.click(screen.getByRole("button", { name: "Đã hạch toán trước đây" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Lỗi kết nối CSDL, vui lòng thử lại.");
    expect(reasonInput).toHaveValue("Đã đối chiếu sổ phụ chi tiết");
  });

  it("resets state when switching to a different transaction", () => {
    const transaction2: SepayTransactionReadModel = {
      ...transaction,
      amountVnd: 2_000_000,
      bankTransactionId: "api-transaction-2",
      id: "91000000-0000-4000-8000-000000000002",
      transferContent: "NOI DUNG GIAO DICH 2",
    };

    const onClose = vi.fn();
    const { rerender } = render(<SepayReconciliationDialog
      candidates={[]}
      isOpen
      onClose={onClose}
      transaction={transaction}
    />);

    const reasonInput = screen.getByPlaceholderText(/Nêu căn cứ đối soát/);
    fireEvent.change(reasonInput, { target: { value: "Ghi chú cho giao dịch 1" } });
    expect(reasonInput).toHaveValue("Ghi chú cho giao dịch 1");

    // Rerender with transaction 2
    rerender(<SepayReconciliationDialog
      candidates={[]}
      isOpen
      onClose={onClose}
      transaction={transaction2}
    />);

    expect(screen.getByText("api-transaction-2")).toBeInTheDocument();
    expect(screen.getByText("NOI DUNG GIAO DICH 2")).toBeInTheDocument();
    const newReasonInput = screen.getByPlaceholderText(/Nêu căn cứ đối soát/);
    expect(newReasonInput).toHaveValue("");
  });

  it("closes dialog on Escape key and close button", () => {
    const onClose = vi.fn();
    render(<SepayReconciliationDialog
      candidates={[]}
      isOpen
      onClose={onClose}
      transaction={transaction}
    />);

    fireEvent.click(screen.getByLabelText("Đóng cửa sổ đối soát"));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
