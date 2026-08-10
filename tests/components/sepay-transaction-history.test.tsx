import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getSepayMatchPresentation,
  SepayTransactionHistory,
} from "@/features/finance/components/sepay-transaction-history";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";

afterEach(cleanup);

const transaction: SepayTransactionReadModel = {
  accountNumber: "0123456789",
  amountVnd: 1_250_000,
  bankBrand: "MB Bank",
  bankTransactionId: "SEPAY-001",
  createdAt: "2026-08-10T03:00:00.000Z",
  id: "sepay-1",
  matchStatus: "auto_matched",
  matchedAt: "2026-08-10T03:05:00.000Z",
  matchedPaymentRequestCode: "YC-001",
  matchedStudentFullName: "Nguyễn Minh An",
  transactionAt: "2026-08-10T03:00:00.000Z",
  transferContent: "TTVC YC001 Nguyen Minh An nap hoc phi",
};

describe("SePay transaction history presentation", () => {
  it("keeps the mounted history strictly read-only without filters, pagination, or Finance actions", () => {
    render(<SepayTransactionHistory transactions={[transaction]} />);

    expect(screen.getByText("Hiển thị 1 giao dịch SePay mới nhất (tối đa 100).")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/phân bổ|đối soát thủ công|hoàn phí|hoàn tiền|xác nhận kế toán/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trang \d|phân trang/i)).not.toBeInTheDocument();
  });

  it("maps only the five existing match states with textual SePay-local meaning", () => {
    expect(getSepayMatchPresentation("unmatched")).toEqual({ label: "Chưa khớp", tone: "neutral" });
    expect(getSepayMatchPresentation("auto_matched")).toEqual({ label: "Khớp tự động", tone: "success" });
    expect(getSepayMatchPresentation("manual_matched")).toEqual({ label: "Khớp thủ công", tone: "success" });
    expect(getSepayMatchPresentation("split_allocated")).toEqual({ label: "Đã phân bổ nhiều học viên", tone: "info" });
    expect(getSepayMatchPresentation("amount_mismatch")).toEqual({ label: "Sai số tiền – cần đối soát", tone: "warning" });
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

  it("uses the zero-padding work area and the approved 1202px container threshold", () => {
    const { container } = render(<SepayTransactionHistory transactions={[transaction]} />);
    const table = screen.getByRole("table", { name: "Danh sách giao dịch SePay mới nhất" });
    const list = screen.getByRole("list", { name: "Danh sách giao dịch SePay mới nhất" });
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(table.closest(".sepay-transaction-operational-work-area")).not.toBeNull();
    expect(list.closest(".sepay-transaction-operational-work-area")).not.toBeNull();
    expect(table).toHaveClass("min-w-[1200px]");
    expect(container.querySelector(".sepay-transaction-directory-table")).not.toBeNull();
    expect(container.querySelector(".sepay-transaction-directory-record-list")).not.toBeNull();
    expect(globals).toMatch(/\.sepay-transaction-operational-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1202px\)[\s\S]*\.sepay-transaction-directory-table/);
  });

  it("keeps the feature-owned empty state without creating controls", () => {
    render(<SepayTransactionHistory transactions={[]} />);

    expect(screen.getByText("Chưa có giao dịch SePay")).toBeInTheDocument();
    expect(screen.getByText("Chưa có giao dịch SePay nào được ghi nhận.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
