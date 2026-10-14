// Value: protects=without an `actions` prop (every production call site) Đảo phân bổ calls the real reverseSepayAllocationAction with the reason and transaction id;
// fails_when=the override fallback is inverted or dropped, so production reversal calls nothing or a stub; why_new=only the /dev/sepay preview exercised this dialog, always with stubs;
// seam=none; no_claim=the reversal RPC and its permission check (server action module mocked; component only)
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SepayAllocationReversalDialog } from "@/features/finance/components/sepay-allocation-reversal-dialog";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import { reverseSepayAllocationAction } from "@/features/finance/sepay-allocation-reversal-actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/finance/sepay-allocation-reversal-actions", () => ({ reverseSepayAllocationAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const transaction: SepayTransactionReadModel = {
  accountNumber: "0399886886",
  accountPurpose: "renewal",
  amountVnd: 2_400_000,
  bankBrand: "MB Bank",
  bankTransactionId: "FT-201",
  createdAt: "2026-10-12T01:14:40Z",
  id: "c1000000-0000-4000-8000-000000000201",
  ingestionSource: "webhook",
  matchStatus: "auto_matched",
  matchedAt: "2026-10-12T01:15:00Z",
  matchedPaymentRequestCode: "YC-001",
  matchedStudentFullName: null,
  referenceNumber: null,
  sepayV2Id: null,
  transactionAt: "2026-10-12T01:14:37Z",
  transferContent: "CK HOC PHI",
  transferType: "in",
};

describe("SePay allocation reversal dialog", () => {
  it("calls the real reversal action when no override is passed", async () => {
    vi.mocked(reverseSepayAllocationAction).mockResolvedValue({ message: "Đã đảo phân bổ.", ok: true, payrollMonthsToRecalculate: [] });
    render(<SepayAllocationReversalDialog transaction={transaction} />);

    fireEvent.click(screen.getByRole("button", { name: "Đảo phân bổ giao dịch FT-201" }));
    fireEvent.change(screen.getByLabelText("Lý do đảo phân bổ"), { target: { value: "Chọn nhầm học sinh" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đảo" }));

    await waitFor(() => expect(reverseSepayAllocationAction).toHaveBeenCalledWith({ reason: "Chọn nhầm học sinh", transactionId: transaction.id }));
    expect(await screen.findByText("Đã đảo phân bổ.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
