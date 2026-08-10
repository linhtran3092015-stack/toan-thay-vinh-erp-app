import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import { PaymentRequestTable } from "@/features/finance/components/payment-request-table";
import { PaymentRequestDirectory, countActivePaymentRequestFilters } from "@/features/finance/payment-request-directory";
import { defaultPaymentRequestFilters } from "@/features/finance/payment-request-url-state";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

const item: PaymentRequestReadModel = { bonusSessions: 2, calculatedUnitPriceVnd: 140000, createdAt: "2026-08-10T00:00:00Z", expectedAmountVnd: 1_400_000, guardianFullName: "Nguyễn Thị Mai", guardianPhone: "0900000000", id: "request-1", notes: null, paidAmountVnd: 400_000, paidAt: null, publicCode: "YC-001", purchasedSessions: 10, status: "partially_paid", studentFullName: "Nguyễn Minh An", studentId: "student-1", studentPublicCode: "HV001", topupType: "new", transferCode: "TTVC YC001" };

describe("Payment request directory presentation", () => {
  it("uses the shared table frame and labelled responsive records while keeping money and sessions distinct", () => {
    render(<PaymentRequestTable items={[item]} />);
    expect(screen.getByRole("table", { name: "Danh sách yêu cầu thanh toán" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Danh sách yêu cầu thanh toán" })).toBeInTheDocument();
    expect(screen.getAllByText("Thanh toán một phần")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Mở hồ sơ học viên Nguyễn Minh An" })).toHaveLength(2);
    expect(screen.getAllByText(/buổi mua/i)).not.toHaveLength(0);
  });

  it("maps only the existing payment-request lifecycle status semantically", () => {
    render(<PaymentRequestStatusBadge status="expired" />);
    expect(screen.getByText("Hết hạn")).toBeInTheDocument();
  });

  it("counts only active Finance-owned filters and never treats pagination as a filter", () => {
    expect(countActivePaymentRequestFilters(defaultPaymentRequestFilters)).toBe(0);
    expect(countActivePaymentRequestFilters({ ...defaultPaymentRequestFilters, search: "An", status: "pending" })).toBe(2);
  });

  it("scopes the outstanding summary to the loaded directory data and keeps unbound finance workflows absent", () => {
    render(<PaymentRequestDirectory canCreatePaymentRequests items={[item]} />);

    expect(screen.getByText("Còn chờ nhận")).toBeInTheDocument();
    expect(screen.getByText("Trong danh sách yêu cầu đang tải")).toBeInTheDocument();
    expect(screen.queryByText(/Tổng công nợ|Công nợ toàn trung tâm|tổng phải thu toàn trung tâm/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /phân bổ|đối soát|hoàn phí|hoàn tiền/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /phân bổ|đối soát|hoàn phí|hoàn tiền/i })).not.toBeInTheDocument();
  });
});
