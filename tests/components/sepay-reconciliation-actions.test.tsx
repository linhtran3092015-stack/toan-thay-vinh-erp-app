import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SepayReconciliationActions } from "@/features/finance/components/sepay-reconciliation-actions";
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
  transferContent: "TTV PAY",
  transferType: "in",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("SePay history reconciliation actions", () => {
  it("matches only a same-purpose, same-amount pending request after a reason is entered", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(matchSepayHistoricalTransactionAction).mockResolvedValue({ message: "Đã khớp", ok: true });
    render(<SepayReconciliationActions
      candidates={[
        { expectedAmountVnd: 1_000_000, id: "93000000-0000-4000-8000-000000000001", publicCode: "PAY-NEW", studentFullName: "Học viên A", topupType: "new" },
        { expectedAmountVnd: 1_000_000, id: "93000000-0000-4000-8000-000000000002", publicCode: "PAY-RENEW", studentFullName: "Học viên B", topupType: "renewal" },
      ]}
      transaction={transaction}
    />);

    expect(screen.getByRole("option", { name: /PAY-NEW/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /PAY-RENEW/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Nêu căn cứ đối soát"), { target: { value: "Đã kiểm tra sao kê" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "93000000-0000-4000-8000-000000000001" } });
    fireEvent.click(screen.getByRole("button", { name: "Khớp và ghi nhận học phí" }));

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
    render(<SepayReconciliationActions candidates={[]} transaction={transaction} />);

    fireEvent.change(screen.getByPlaceholderText("Nêu căn cứ đối soát"), { target: { value: "Đã nhập sổ trước đây" } });
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
    render(<SepayReconciliationActions candidates={[]} transaction={transaction} />);

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
      transaction={transaction}
    />);

    fireEvent.change(screen.getByPlaceholderText("Nêu căn cứ đối soát"), { target: { value: "Đã kiểm tra sao kê" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "93000000-0000-4000-8000-000000000001" } });
    fireEvent.click(screen.getByRole("button", { name: "Khớp và ghi nhận học phí" }));

    expect(matchSepayHistoricalTransactionAction).not.toHaveBeenCalled();
  });

  it("lets an owner close an identity conflict without offering a new tuition match", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(resolveSepayHistoricalTransactionAction).mockResolvedValue({ message: "Đã bỏ qua", ok: true });
    render(<SepayReconciliationActions
      candidates={[]}
      transaction={{ ...transaction, matchStatus: "identity_conflict" }}
    />);

    expect(screen.getByText(/Giao dịch trùng nhận diện/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Khớp và ghi nhận học phí" })).toBeDisabled();
    expect(screen.queryByLabelText("Tìm yêu cầu thanh toán")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Nêu căn cứ đối soát"), { target: { value: "Bản ghi trùng giao dịch cũ" } });
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));

    await waitFor(() => expect(resolveSepayHistoricalTransactionAction).toHaveBeenCalledWith({
      reason: "Bản ghi trùng giao dịch cũ",
      resolution: "ignored",
      transactionId: transaction.id,
    }));
  });
});
