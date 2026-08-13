import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinanceOrdersPage } from "@/features/finance/components/finance-orders-page";
import type { FinanceOrdersDashboardReadModel } from "@/features/finance/read-models";

const action = vi.hoisted(() => ({ setFinanceOrderReviewAction: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams("month=2026-08"),
}));
vi.mock("@/features/finance/actions/finance-actions", () => action);

const dashboard: FinanceOrdersDashboardReadModel = {
  month: "2026-08-01",
  orders: [{
    bankTransactionId: "SEPAY-100",
    checkedAt: null,
    checkedBy: null,
    classCode: "7A",
    className: "Toán 7A",
    guardianFullName: "Nguyễn Thị Mai",
    guardianPhone: "0900000000",
    isChecked: false,
    leadSourceCode: "sb_f1",
    leadSourceName: "CTV F1",
    mechanismCode: "unconfigured",
    operatingCostStatus: "unconfigured",
    operatingCostVnd: null,
    orderType: "renewal",
    referenceCode: "SPLIT-100",
    saleOwnerFullName: "Trần Hải",
    saleOwnerId: "sale-1",
    sepayTransactionId: "transaction-1",
    settlementPeriod: 2,
    sourceCashflowRecordId: "cashflow-1",
    sourceCode: "sb_f1",
    sourceLabel: "SB F1",
    studentFullName: "Nguyễn Minh An",
    studentId: "student-1",
    studentPublicCode: "HV001",
    transactionAt: "2026-08-15T03:00:00.000Z",
    transferContent: "TTVC SEPAY-100 Nguyễn Minh An",
    tuitionAmountVnd: 2_800_000,
  }],
  settlement: [],
  settlementEligible: true,
  summary: {
    checkedCount: 0,
    operatingCostVnd: 0,
    orderCount: 1,
    tuitionAmountVnd: 2_800_000,
    uncheckedCount: 1,
    unconfiguredCount: 1,
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Finance Orders presentation", () => {
  it("shows an SB F1 row as unconfigured rather than zero and retains the SB settlement empty state", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={{ month: "2026-08", orderType: "", period: "", source: "" }} />);

    expect(screen.getAllByText("Chưa cấu hình")).not.toHaveLength(0);
    expect(screen.getByText("SB F1 · CTV F1")).toBeInTheDocument();
    expect(screen.getAllByText("0900000000")).not.toHaveLength(0);
    expect(screen.getAllByText("TTVC SEPAY-100 Nguyễn Minh An")).not.toHaveLength(0);
    expect(screen.getByRole("option", { name: "SB F1" })).toBeInTheDocument();
    expect(screen.getByText("Chưa có dữ liệu quyết toán SB")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác nhận đơn/i })).not.toBeInTheDocument();
  });

  it("explains that both MMA and SB F1 are excluded from SB settlement", () => {
    render(
      <FinanceOrdersPage
        canReview={false}
        dashboard={{ ...dashboard, settlementEligible: false }}
        filters={{ month: "2026-08", orderType: "", period: "", source: "sb_f1" }}
      />,
    );

    expect(screen.getByText("Không có dữ liệu quyết toán SB khi lọc nguồn MMA hoặc SB F1.")).toBeInTheDocument();
  });

  it("uses the auditable server action only for a payments.manage-enabled review control", async () => {
    action.setFinanceOrderReviewAction.mockResolvedValueOnce({
      isChecked: true,
      message: "Đã xác nhận đơn hàng.",
      status: "success",
    });
    render(<FinanceOrdersPage canReview dashboard={dashboard} filters={{ month: "2026-08", orderType: "", period: "", source: "" }} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-100" })[0]!);

    await waitFor(() => {
      expect(action.setFinanceOrderReviewAction).toHaveBeenCalledWith("cashflow-1", true);
    });
  });
});
