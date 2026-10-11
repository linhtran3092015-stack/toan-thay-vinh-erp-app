import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

import {
  getSepayAccountPurposePresentation,
  getSepayMatchPresentation,
  SepayTransactionHistory,
} from "@/features/finance/components/sepay-transaction-history";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";

afterEach(cleanup);

const transaction: SepayTransactionReadModel = {
  accountNumber: "0123456789",
  accountPurpose: "new_enrollment",
  amountVnd: 1_250_000,
  bankBrand: "MB Bank",
  bankTransactionId: "SEPAY-001",
  createdAt: "2026-08-10T03:00:00.000Z",
  id: "sepay-1",
  ingestionSource: "webhook",
  matchStatus: "auto_matched",
  matchedAt: "2026-08-10T03:05:00.000Z",
  matchedPaymentRequestCode: "YC-001",
  matchedStudentFullName: "Nguyễn Minh An",
  referenceNumber: "REF-001",
  sepayV2Id: null,
  transactionAt: "2026-08-10T03:00:00.000Z",
  transferType: "in",
  transferContent: "TTVC YC001 Nguyen Minh An nap hoc phi",
};

describe("SePay transaction history presentation", () => {
  it("keeps the mounted history read-only while allowing a server-driven account-purpose filter", () => {
    render(<SepayTransactionHistory transactions={[transaction]} />);

    expect(screen.getByText("Hiển thị 1 trong tổng số 1 giao dịch.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tất cả tài khoản" })).toHaveAttribute("href", "/finance/sepay");
    expect(screen.getByRole("link", { name: "Tuyển mới" })).toHaveAttribute("href", "/finance/sepay?accountPurpose=new_enrollment");
    expect(screen.queryByText(/phân bổ|đối soát thủ công|hoàn phí|hoàn tiền|xác nhận kế toán/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trang \d|phân trang/i)).not.toBeInTheDocument();
  });

  it("maps reconciliation and receiving-account states with SePay-local meaning", () => {
    expect(getSepayMatchPresentation("unmatched")).toEqual({ label: "Chưa khớp – cần đối soát", tone: "warning" });
    expect(getSepayMatchPresentation("auto_matched")).toEqual({ label: "Khớp tự động", tone: "success" });
    expect(getSepayMatchPresentation("manual_matched")).toEqual({ label: "Khớp thủ công", tone: "success" });
    expect(getSepayMatchPresentation("split_allocated")).toEqual({ label: "Đã phân bổ học phí", tone: "info" });
    expect(getSepayMatchPresentation("amount_mismatch")).toEqual({ label: "Sai số tiền – cần đối soát", tone: "warning" });
    expect(getSepayMatchPresentation("account_purpose_mismatch")).toEqual({ label: "Sai tài khoản nhận – cần đối soát", tone: "warning" });
    expect(getSepayMatchPresentation("identity_conflict")).toEqual({ label: "Trùng nhận diện – cần đối soát", tone: "warning" });
    expect(getSepayAccountPurposePresentation("new_enrollment")).toEqual({ label: "Tuyển mới", tone: "success" });
    expect(getSepayAccountPurposePresentation("renewal")).toEqual({ label: "Tái phí", tone: "info" });
    expect(getSepayAccountPurposePresentation("unknown")).toEqual({ label: "Chưa xác định", tone: "warning" });
  });

  it("keeps the bank amount neutral and transfer content fully available as plain text", () => {
    render(<SepayTransactionHistory transactions={[transaction]} />);

    expect(screen.getAllByText("1.250.000 ₫")).toHaveLength(2);
    expect(screen.queryByText("+1.250.000 ₫")).not.toBeInTheDocument();
    expect(screen.queryByText("-1.250.000 ₫")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Thu$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Chi$/i)).not.toBeInTheDocument();

    const transferContent = screen.getAllByText(transaction.transferContent);
    expect(transferContent).toHaveLength(2);
    for (const content of transferContent) {
      expect(content).not.toHaveAttribute("title");
      expect(content).not.toHaveClass("truncate");
    }
  });

  it("renders existing linked context when supplied and avoids fabricated references when absent", () => {
    const { rerender } = render(<SepayTransactionHistory transactions={[transaction]} />);

    expect(screen.getAllByText(/YC-001 · Nguyễn Minh An/)).toHaveLength(2);

    rerender(
      <SepayTransactionHistory
        transactions={[{ ...transaction, matchedPaymentRequestCode: null, matchedStudentFullName: null }]}
      />,
    );
    expect(screen.getAllByText("Chưa có tham chiếu")).toHaveLength(2);
  });

  it("uses the zero-padding work area and the approved 1120px container threshold", () => {
    const { container } = render(<SepayTransactionHistory transactions={[transaction]} />);
    const table = screen.getByRole("table", { name: "Danh sách giao dịch SePay mới nhất" });
    const list = screen.getByRole("list", { name: "Danh sách giao dịch SePay mới nhất" });
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(table.closest(".sepay-transaction-operational-work-area")).not.toBeNull();
    expect(list.closest(".sepay-transaction-operational-work-area")).not.toBeNull();
    expect(table).toHaveClass("min-w-[1340px]");
    expect(container.querySelector(".sepay-transaction-directory-table")).not.toBeNull();
    expect(container.querySelector(".sepay-transaction-directory-record-list")).not.toBeNull();
    expect(globals).toMatch(/\.sepay-transaction-operational-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1120px\)[\s\S]*\.sepay-transaction-directory-table/);
  });

  it("keeps the feature-owned empty state without creating controls", () => {
    render(<SepayTransactionHistory transactions={[]} />);

    expect(screen.getByText("Chưa có giao dịch SePay")).toBeInTheDocument();
    expect(screen.getByText("Chưa có giao dịch SePay nào được ghi nhận.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("surfaces candidate-loading failures and locks reconciliation controls", () => {
    render(<SepayTransactionHistory
      canReconcile={false}
      reconciliationError
      transactions={[{ ...transaction, ingestionSource: "api_v2", matchStatus: "unmatched", sepayV2Id: "95000000-0000-0000-0000-000000000001" }]}
    />);

    expect(screen.getByRole("alert")).toHaveTextContent(/Không tải được danh sách yêu cầu thanh toán/);
    expect(screen.queryByText("Đối soát")).not.toBeInTheDocument();
  });

  it("renders trigger buttons in table and card list without expanding in-row forms", () => {
    const reconcilableTransaction: SepayTransactionReadModel = {
      ...transaction,
      ingestionSource: "api_v2",
      matchStatus: "unmatched",
      sepayV2Id: "95000000-0000-0000-0000-000000000001",
    };

    render(<SepayTransactionHistory
      canReconcile
      transactions={[reconcilableTransaction]}
    />);

    // Should have 2 "Đối soát" buttons: one in table row, one in mobile card
    const buttons = screen.getAllByRole("button", { name: "Đối soát" });
    expect(buttons).toHaveLength(2);

    // No dialog or forms should be inside table
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Nêu căn cứ đối soát/)).not.toBeInTheDocument();

    // Clicking the table trigger opens dialog
    fireEvent.click(buttons[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nêu căn cứ đối soát/)).toBeInTheDocument();
    expect(within(dialog).getByText("SEPAY-001")).toBeInTheDocument();
  });
});
