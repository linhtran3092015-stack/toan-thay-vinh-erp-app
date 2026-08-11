import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentRequestCreateForm } from "@/features/finance/components/payment-request-create-form";
import { createPaymentRequestAction } from "@/features/finance/actions/finance-actions";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("status=pending&notice=ignored") }));
vi.mock("@/features/finance/actions/finance-actions", () => ({ createPaymentRequestAction: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const students = [{ guardianName: "Nguyễn Thị Mai", guardianPhone: "0900000000", id: "student-1", name: "Nguyễn Minh An", publicCode: "HV001" }];

describe("Payment request create presentation", () => {
  it("submits only approved request inputs; the unit-price preview is not authority", async () => {
    vi.mocked(createPaymentRequestAction).mockResolvedValue({ id: "request-1", message: "ok", status: "success" });
    render(<PaymentRequestCreateForm isPaymentConfigured students={students} />);
    expect(screen.getByLabelText("Học viên")).toBeInTheDocument();
    expect(screen.getByLabelText("Số tiền dự kiến (VND)")).toBeInTheDocument();
    expect(screen.getByLabelText("Số buổi mua")).toBeInTheDocument();
    expect(screen.queryByText(/Xác nhận tạo/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Học viên"), { target: { value: "student-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu và VietQR" }));
    await waitFor(() => expect(createPaymentRequestAction).toHaveBeenCalledWith({
      bonusSessions: 0,
      expectedAmountVnd: 1_400_000,
      notes: "",
      purchasedSessions: 10,
      studentId: "student-1",
      topupType: "new",
    }));
  });

  it("keeps error text associated with its explicitly labelled control", async () => {
    vi.mocked(createPaymentRequestAction).mockResolvedValue({ fieldErrors: { expectedAmountVnd: ["Số tiền không hợp lệ"] }, message: "invalid", status: "error" });
    render(<PaymentRequestCreateForm isPaymentConfigured students={students} />);
    fireEvent.change(screen.getByLabelText("Học viên"), { target: { value: "student-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu và VietQR" }));
    const control = screen.getByLabelText("Số tiền dự kiến (VND)");
    await waitFor(() => expect(control).toHaveAttribute("aria-describedby", "payment-request-expected-amount-error"));
    expect(screen.getByText("Số tiền không hợp lệ")).toHaveAttribute("id", "payment-request-expected-amount-error");
  });

  it("presents the existing VietQR success details without claiming payment or reconciliation", async () => {
    vi.mocked(createPaymentRequestAction).mockResolvedValue({
      id: "request-1",
      message: "Đã tạo yêu cầu thanh toán và mã VietQR.",
      paymentRequest: {
        accountHolder: "TRUNG TÂM TOÁN THẦY VINH",
        accountNumber: "0123456789",
        bankCode: "MB",
        expectedAmountVnd: 1_400_000,
        publicCode: "YC-001",
        qrImageUrl: "https://example.test/qr.png",
        transferCode: "TTVC YC001",
        transferDescription: "TTVC YC001",
      },
      status: "success",
    });

    render(<PaymentRequestCreateForm isPaymentConfigured students={students} />);
    fireEvent.change(screen.getByLabelText("Học viên"), { target: { value: "student-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu và VietQR" }));

    await waitFor(() => expect(screen.getByText("Đã khởi tạo yêu cầu thanh toán")).toBeInTheDocument());
    expect(screen.getByAltText("Mã VietQR cho yêu cầu YC-001")).toBeInTheDocument();
    expect(screen.getByText((content) => content.replace(/\s/g, " ") === "1.400.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("TTVC YC001")).toBeInTheDocument();
    expect(screen.getByText("0123456789")).toBeInTheDocument();
    expect(screen.queryByText(/Đã thanh toán|SePay đã khớp|Đã phân bổ|Đã đối soát/i)).not.toBeInTheDocument();
  });
});
