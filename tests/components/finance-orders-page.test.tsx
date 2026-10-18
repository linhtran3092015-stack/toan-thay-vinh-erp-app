import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

// Step 14c (design 16a "Đơn hàng"): header counts, summary strip, settlement table above the
// orders, URL filter writes, local review chips, pagination, the review toggle and its captions.
const TABLE = "Danh sách đơn hàng tài chính";
const SETTLEMENT = "Quyết toán chi phí vận hành SB theo đợt";
const TODAY = "2026-10-16";
const allFilters = { month: "2026-08", orderType: "", period: "", source: "" } as const;
const baseOrder = dashboard.orders[0]!;

type Order = FinanceOrdersDashboardReadModel["orders"][number];

function order(index: number, overrides: Partial<Order> = {}): Order {
  return {
    ...baseOrder,
    bankTransactionId: `SEPAY-${100 + index}`,
    sourceCashflowRecordId: `cashflow-${index}`,
    studentFullName: `Học sinh ${index}`,
    studentId: `student-${index}`,
    ...overrides,
  };
}

const sbConfigured = {
  leadSourceCode: "sandbox_partner",
  leadSourceName: "Đối tác Sandbox",
  mechanismCode: "renewal_sb_20_percent",
  operatingCostStatus: "configured",
  operatingCostVnd: 560_000,
  sourceCode: "sb",
  sourceLabel: "SB",
} as const;

function board(orders: Order[], overrides: Partial<FinanceOrdersDashboardReadModel> = {}): FinanceOrdersDashboardReadModel {
  const checked = orders.filter((row) => row.isChecked).length;
  return {
    ...dashboard,
    orders,
    summary: {
      checkedCount: checked,
      operatingCostVnd: orders.reduce((sum, row) => sum + (row.operatingCostVnd ?? 0), 0),
      orderCount: orders.length,
      tuitionAmountVnd: orders.reduce((sum, row) => sum + row.tuitionAmountVnd, 0),
      uncheckedCount: orders.length - checked,
      unconfiguredCount: orders.filter((row) => row.operatingCostStatus === "unconfigured").length,
    },
    ...overrides,
  };
}

const tableRows = () => within(screen.getByRole("table", { name: TABLE })).getAllByRole("row").slice(1);
const figure = (label: string) =>
  within(screen.getByLabelText("Tóm tắt đơn hàng tháng 08/2026")).getByText(label).nextElementSibling;
const chips = () => screen.getByRole("group", { name: "Lọc nhanh đơn hàng" });

describe("Finance Orders list (step 14c)", () => {
  // A failed assertion must not leave a queued one-off result (e.g. a never-resolving promise) for the next test.
  afterEach(() => {
    action.setFinanceOrderReviewAction.mockReset();
  });

  it("states the month counts in the header and the server sums in a thin strip, with the unconfigured caveat", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={allFilters} today={TODAY} />);

    expect(screen.getByRole("heading", { level: 1, name: "Đơn hàng" })).toBeInTheDocument();
    expect(screen.getByText("Tháng 08/2026 · 1 đơn · 1 chưa xác nhận · 1 chưa cấu hình")).toBeInTheDocument();
    expect(figure("Số đơn")).toHaveTextContent("1");
    expect(figure("Học phí")).toHaveTextContent("2.800.000 ₫");
    // The only order has no cost policy: the server sum covers nothing, so no "0 ₫".
    expect(figure("Chi phí vận hành")).toHaveTextContent(/^—$/);
    expect(screen.getByText("chưa gồm 1 đơn chưa cấu hình")).toBeInTheDocument();
    expect(figure("Chưa xác nhận")).toHaveTextContent("1");
    expect(figure("Chưa cấu hình")).toHaveTextContent("1");
    // The old 4-card block and its separate warning paragraph are gone.
    expect(screen.queryByText("Tổng số đơn")).not.toBeInTheDocument();
  });

  it("renders a row with the transaction, student, guardian phone, source, cost badge and period", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={allFilters} today={TODAY} />);

    const row = tableRows()[0]!;
    expect(within(row).getByText("15/08 10:00")).toHaveAttribute("title", "10:00 15/08/2026");
    expect(within(row).getByText("SEPAY-100")).toBeInTheDocument();
    expect(within(row).getByText("TTVC SEPAY-100 Nguyễn Minh An")).toHaveAttribute("title", "TTVC SEPAY-100 Nguyễn Minh An");
    expect(within(row).getByText("HV001 · 7A Toán 7A")).toBeInTheDocument();
    expect(within(row).getByText("0900000000")).toBeInTheDocument();
    expect(within(row).getByText("Sale: Trần Hải")).toBeInTheDocument();
    expect(within(row).getByText("—")).toBeInTheDocument();
    expect(within(row).getByText("Chưa cấu hình")).toHaveAttribute("title", expect.stringContaining("không gán 0 VND"));
    expect(within(row).getByText("Đợt 2")).toHaveAttribute("title", "Đợt 2 (11–20)");
    expect(screen.getByRole("table", { name: TABLE })).toHaveClass("min-w-[1040px]", "table-fixed");
    // The card carries the source with the Sale in one string, never the bare label (pinned single).
    const card = within(screen.getByRole("list", { name: TABLE })).getByRole("listitem");
    expect(within(card).getByText("SB F1 · CTV F1 · Sale Trần Hải")).toBeInTheDocument();
    expect(within(card).getByText("0900000000")).toBeInTheDocument();
  });

  it("links the student only with students.view", () => {
    const { unmount } = render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={allFilters} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    unmount();

    render(<FinanceOrdersPage canReview={false} canViewStudents dashboard={dashboard} filters={allFilters} />);
    const links = screen.getAllByRole("link", { name: "Mở hồ sơ học viên Nguyễn Minh An" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/students/student-1");
  });

  it("draws the SB settlement above the orders: every period without a period filter, zeros where none", () => {
    const orders = [order(1, { ...sbConfigured, isChecked: false, settlementPeriod: 2 })];
    render(
      <FinanceOrdersPage
        canReview={false}
        dashboard={board(orders, {
          // Server counts may be stale after a tick: the split is recounted from the rows.
          settlement: [{ checkedCount: 5, newEnrollmentCount: 0, operatingCostVnd: 560_000, period: 2, renewalCount: 1, tuitionAmountVnd: 2_800_000, uncheckedCount: 0, unconfiguredCount: 0 }],
        })}
        filters={allFilters}
        today={TODAY}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Quyết toán chi phí vận hành SB" })).toBeInTheDocument();
    expect(screen.getByText("Chỉ tính đơn nguồn SB · Đợt 1: 01–10 · Đợt 2: 11–20 · Đợt 3: 21–cuối tháng.")).toBeInTheDocument();
    const settlement = screen.getByRole("table", { name: SETTLEMENT });
    const cells = within(settlement)
      .getAllByRole("row")
      .slice(1)
      // Intl puts a no-break space before ₫.
      .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent?.replace(/\s+/g, " ")));
    expect(cells).toEqual([
      ["Đợt 1 01–10", "0", "0", "0 ₫", "0 ₫", "0 đã · 0 chưa"],
      ["Đợt 2 11–20", "0", "1", "2.800.000 ₫", "560.000 ₫", "0 đã · 1 chưa"],
      ["Đợt 3 21–cuối tháng", "0", "0", "0 ₫", "0 ₫", "0 đã · 0 chưa"],
    ]);
    expect(screen.getByText("Xác nhận chỉ ghi dấu kế toán đã kiểm tra, chưa phải chốt quyết toán.")).toBeInTheDocument();
    expect(screen.queryByText(/đủ điều kiện quyết toán/i)).not.toBeInTheDocument();
    expect(settlement.compareDocumentPosition(screen.getByRole("table", { name: TABLE })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows only the selected period's settlement row with a period filter", () => {
    const orders = [order(1, { ...sbConfigured, settlementPeriod: 2 })];
    render(
      <FinanceOrdersPage
        canReview={false}
        dashboard={board(orders, {
          settlement: [{ checkedCount: 0, newEnrollmentCount: 0, operatingCostVnd: 560_000, period: 2, renewalCount: 1, tuitionAmountVnd: 2_800_000, uncheckedCount: 1, unconfiguredCount: 0 }],
        })}
        filters={{ ...allFilters, period: "2" }}
        today={TODAY}
      />,
    );

    const rows = within(screen.getByRole("table", { name: SETTLEMENT })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Đợt 2");
  });

  it("writes server filters with router.replace, merges quick successive changes and keeps the month on reset", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={allFilters} />);

    fireEvent.change(screen.getByLabelText("Nguồn"), { target: { value: "sb" } });
    expect(router.replace).toHaveBeenLastCalledWith("/finance/orders?month=2026-08&source=sb", { scroll: false });
    // The props are still the old filters (the server has not answered): the control shows the choice.
    expect(screen.getByLabelText("Nguồn")).toHaveValue("sb");

    fireEvent.change(screen.getByLabelText("Đợt quyết toán"), { target: { value: "2" } });
    expect(router.replace).toHaveBeenLastCalledWith("/finance/orders?month=2026-08&source=sb&period=2", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc (2)" }));
    expect(router.replace).toHaveBeenLastCalledWith("/finance/orders?month=2026-08", { scroll: false });

    fireEvent.change(screen.getByLabelText("Tháng giao dịch"), { target: { value: "2026-07" } });
    expect(router.replace).toHaveBeenLastCalledWith("/finance/orders?month=2026-07", { scroll: false });
    expect(router.replace).toHaveBeenCalledTimes(4);
  });

  it("does not write a cleared or partial month", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={allFilters} />);
    const month = screen.getByLabelText("Tháng giao dịch");

    fireEvent.change(month, { target: { value: "" } });
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.blur(month);
    expect(month).toHaveValue("2026-08");
  });

  it("writes filters under basePath so the /dev/lists preview never opens the real route", () => {
    render(<FinanceOrdersPage basePath="/dev/lists" canReview={false} dashboard={dashboard} filters={allFilters} />);

    fireEvent.change(screen.getByLabelText("Loại đơn"), { target: { value: "renewal" } });
    expect(router.replace).toHaveBeenCalledWith("/dev/lists?month=2026-08&orderType=renewal", { scroll: false });
  });

  it("counts Xóa lọc over type, source and period only", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={{ month: "2026-08", orderType: "renewal", period: "", source: "sb_f1" }} />);

    expect(screen.getByRole("button", { name: "Xóa lọc (2)" })).toBeInTheDocument();
  });

  it("filters the loaded month with local review chips, hides zero chips and resets the page", () => {
    const orders = [
      order(1),
      order(2, { ...sbConfigured, checkedAt: "2026-08-16T02:30:00.000Z", isChecked: true }),
      order(3, { ...sbConfigured }),
    ];
    render(<FinanceOrdersPage canReview={false} dashboard={board(orders)} filters={allFilters} today={TODAY} />);

    const group = chips();
    expect(within(group).getByRole("button", { name: "Tất cả3", pressed: true })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Chưa xác nhận2" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Đã xác nhận1" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Chưa cấu hình1" })).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("button", { name: "Đã xác nhận1" }));
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Học sinh 2");
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(within(group).getByRole("button", { name: "Chưa cấu hình1" }));
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Học sinh 1");
  });

  it("hides a zero chip unless it is active", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={allFilters} />);

    expect(within(chips()).queryByRole("button", { name: /^Đã xác nhận/ })).not.toBeInTheDocument();
    expect(within(chips()).getAllByRole("button")).toHaveLength(3);
  });

  it("keeps a row ticked under a review chip until the chip or the query changes", async () => {
    action.setFinanceOrderReviewAction.mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" });
    const { rerender } = render(<FinanceOrdersPage canReview dashboard={dashboard} filters={allFilters} />);

    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa xác nhận1" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-100" })[0]!);
    // The ticked row stays in place, so the control the viewer just used keeps focus.
    expect(await screen.findAllByRole("button", { name: "Bỏ xác nhận đơn SEPAY-100" })).toHaveLength(2);
    expect(within(chips()).getByRole("button", { name: "Chưa xác nhận0", pressed: true })).toBeInTheDocument();
    expect(tableRows()).toHaveLength(1);

    // A new query drops the kept row; the active chip stays and the frame says why it is empty.
    rerender(<FinanceOrdersPage canReview dashboard={dashboard} filters={{ ...allFilters, orderType: "renewal" }} />);
    expect(screen.getByText("Không có đơn chưa xác nhận")).toBeInTheDocument();
    expect(screen.getByText("Các đơn khác của tháng vẫn có trong “Tất cả”.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: TABLE })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả" }));
    expect(tableRows()).toHaveLength(1);
    expect(within(chips()).getByRole("button", { name: "Tất cả1", pressed: true })).toBeInTheDocument();
  });

  it("pages 20 orders at a time past 20 rows and resets to page 1 on a chip or query change", () => {
    const orders = Array.from({ length: 21 }, (_, index) => order(index + 1));
    const { rerender } = render(<FinanceOrdersPage canReview={false} dashboard={board(orders)} filters={allFilters} />);

    expect(screen.getAllByRole("navigation", { name: /^Phân trang đơn hàng/ })).toHaveLength(2);
    expect(tableRows()).toHaveLength(20);
    fireEvent.click(screen.getAllByRole("button", { name: "Sau" })[0]!);
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Học sinh 21");
    expect(screen.getAllByText("21–21 trong 21 đơn")).toHaveLength(2);

    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa xác nhận21" }));
    expect(screen.getAllByText("1–20 trong 21 đơn")).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Sau" })[0]!);
    rerender(<FinanceOrdersPage canReview={false} dashboard={board(orders)} filters={{ ...allFilters, orderType: "renewal" }} />);
    expect(screen.getAllByText("1–20 trong 21 đơn")).toHaveLength(2);
  });

  it("shows no pager buttons with 20 rows or fewer", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={allFilters} />);

    expect(screen.queryByRole("navigation", { name: /^Phân trang đơn hàng/ })).not.toBeInTheDocument();
    expect(screen.getByText("1–1 trong 1 đơn")).toBeInTheDocument();
  });

  it("renders the no-order state once inside the frame, without chips or a record list", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={board([])} filters={allFilters} />);

    expect(screen.getByRole("table", { name: TABLE })).toBeInTheDocument();
    expect(screen.getByText("Chưa có đơn hàng")).toBeInTheDocument();
    expect(screen.getByText("Chưa có khoản thu học phí nào trong tháng 08/2026.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: TABLE })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Lọc nhanh đơn hàng" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers Xóa lọc when the server filters match no order", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={board([])} filters={{ ...allFilters, source: "mma" }} />);

    expect(screen.getByText("Không có khoản thu học phí khớp với bộ lọc này.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(router.replace).toHaveBeenCalledWith("/finance/orders?month=2026-08", { scroll: false });
  });

  it("shows the stored review time to read-only viewers as a badge caption", () => {
    const orders = [order(1, { checkedAt: "2026-08-16T02:30:00.000Z", isChecked: true })];
    render(<FinanceOrdersPage canReview={false} dashboard={board(orders)} filters={allFilters} today={TODAY} />);

    const row = tableRows()[0]!;
    expect(within(row).getByText("Đã xác nhận")).toBeInTheDocument();
    expect(within(row).getByText("lúc 16/08 09:30")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác nhận đơn/i })).not.toBeInTheDocument();
  });

  it("toggles a review in place: flipped name, 'vừa xác nhận' and fresh counts, no refresh", async () => {
    action.setFinanceOrderReviewAction.mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" });
    render(<FinanceOrdersPage canReview dashboard={dashboard} filters={allFilters} />);

    const [tick] = screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-100" });
    expect(tick).toHaveTextContent("Xác nhận");
    expect(tick!.className).not.toMatch(/bg-action-primary\b/);
    // An action button named for what a click does: no toggle state on top of the flipping name.
    expect(tick).not.toHaveAttribute("aria-pressed");
    fireEvent.click(tick!);

    expect(await screen.findAllByRole("button", { name: "Bỏ xác nhận đơn SEPAY-100" })).toHaveLength(2);
    expect(screen.getAllByText("vừa xác nhận")).toHaveLength(2);
    expect(figure("Chưa xác nhận")).toHaveTextContent("0");
    expect(screen.getByText("Tháng 08/2026 · 1 đơn · 0 chưa xác nhận · 1 chưa cấu hình")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("keeps the pending state per row", async () => {
    let resolve: (value: { isChecked: boolean; message: string; status: "success" }) => void = () => {};
    action.setFinanceOrderReviewAction.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<FinanceOrdersPage canReview dashboard={board([order(1), order(2)])} filters={allFilters} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    // Busy but still focusable (aria-disabled), so keyboard focus is not dropped while saving.
    for (const button of screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("aria-busy", "true");
    }
    for (const button of screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-102" })) {
      expect(button).not.toHaveAttribute("aria-disabled");
    }

    resolve({ isChecked: true, message: "ok", status: "success" });
    expect(await screen.findAllByRole("button", { name: "Bỏ xác nhận đơn SEPAY-101" })).toHaveLength(2);
    expect(action.setFinanceOrderReviewAction).toHaveBeenCalledWith("cashflow-1", true);
  });

  it("reports a refused or failed review in one alert near the table", async () => {
    action.setFinanceOrderReviewAction.mockResolvedValueOnce({ message: "Tài khoản hiện tại không có quyền xác nhận đơn hàng tài chính.", status: "error" });
    render(<FinanceOrdersPage canReview dashboard={dashboard} filters={allFilters} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-100" })[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản hiện tại không có quyền xác nhận đơn hàng tài chính.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-100" })).toHaveLength(2);

    action.setFinanceOrderReviewAction.mockRejectedValueOnce(new Error("network"));
    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-100" })[0]!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể cập nhật xác nhận đơn hàng. Vui lòng thử lại sau."));
  });

  it("calls an injected review action with the same arguments instead of the server action", async () => {
    const setFinanceOrderReview = vi.fn().mockResolvedValue({ message: "Bản xem trước không ghi dữ liệu.", status: "error" });
    render(<FinanceOrdersPage actions={{ setFinanceOrderReview }} canReview dashboard={dashboard} filters={allFilters} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-100" })[0]!);
    await waitFor(() => expect(setFinanceOrderReview).toHaveBeenCalledWith("cashflow-1", true));
    expect(action.setFinanceOrderReviewAction).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Bản xem trước không ghi dữ liệu.");
  });

  it("says the review state in words beside a toggle whose text never changes", () => {
    const orders = [
      order(1, { checkedAt: "2026-08-16T02:30:00.000Z", isChecked: true }),
      order(2, { checkedAt: null, isChecked: true }),
      order(3),
    ];
    render(<FinanceOrdersPage canReview dashboard={board(orders)} filters={allFilters} today={TODAY} />);

    const [first, second, third] = tableRows();
    const pressed = within(first!).getByRole("button", { name: "Bỏ xác nhận đơn SEPAY-101" });
    const unpressed = within(third!).getByRole("button", { name: "Xác nhận đơn SEPAY-103" });
    expect(pressed).not.toHaveAttribute("aria-pressed");
    expect(unpressed).not.toHaveAttribute("aria-pressed");
    expect(pressed).toHaveTextContent(/^Xác nhận$/);
    expect(unpressed).toHaveTextContent(/^Xác nhận$/);
    // A real hover change on the pressed toggle.
    expect(pressed.className).toContain("hover:border-success!");
    expect(within(first!).getByText("Đã xác nhận")).toHaveClass("text-success");
    expect(within(first!).getByText("lúc 16/08 09:30")).toBeInTheDocument();
    expect(within(first!).getByText("lúc 16/08 09:30").parentElement).toHaveTextContent(/^Đã xác nhận · lúc 16\/08 09:30$/);
    // No stored time: the state word alone.
    expect(within(second!).getByText("Đã xác nhận").parentElement).toHaveTextContent(/^Đã xác nhận$/);
    expect(within(third!).queryByText("Đã xác nhận")).not.toBeInTheDocument();
  });

  it("reads 'Đã xác nhận · vừa xác nhận' after a client tick", async () => {
    action.setFinanceOrderReviewAction.mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" });
    render(<FinanceOrdersPage canReview dashboard={dashboard} filters={allFilters} today={TODAY} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-100" })[0]!);
    const just = await within(tableRows()[0]!).findByText("vừa xác nhận");
    expect(just.parentElement).toHaveTextContent(/^Đã xác nhận · vừa xác nhận$/);
  });

  it("unticks: calls the action with false, unpresses the toggle, drops the caption and counts the order again", async () => {
    action.setFinanceOrderReviewAction.mockResolvedValueOnce({ isChecked: false, message: "ok", status: "success" });
    const orders = [order(1, { checkedAt: "2026-08-16T02:30:00.000Z", isChecked: true })];
    render(<FinanceOrdersPage canReview dashboard={board(orders)} filters={allFilters} today={TODAY} />);
    expect(figure("Chưa xác nhận")).toHaveTextContent("0");

    fireEvent.click(screen.getAllByRole("button", { name: "Bỏ xác nhận đơn SEPAY-101" })[0]!);

    expect(await screen.findAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })).toHaveLength(2);
    expect(action.setFinanceOrderReviewAction).toHaveBeenCalledWith("cashflow-1", false);
    expect(screen.queryByText("lúc 16/08 09:30")).not.toBeInTheDocument();
    expect(within(tableRows()[0]!).queryByText("Đã xác nhận")).not.toBeInTheDocument();
    expect(figure("Chưa xác nhận")).toHaveTextContent("1");
  });

  it("shows a failed tick next to its row as well as in the single alert, and clears it on the next attempt", async () => {
    action.setFinanceOrderReviewAction.mockResolvedValueOnce({ message: "Đơn hàng không còn tồn tại.", status: "error" });
    render(<FinanceOrdersPage canReview dashboard={board([order(1), order(2)])} filters={allFilters} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-102" })[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Đơn hàng không còn tồn tại.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    const [first, second] = tableRows();
    expect(within(second!).getByText("Không lưu được")).toHaveClass("text-danger");
    expect(within(first!).queryByText("Không lưu được")).not.toBeInTheDocument();
    // Table row and card.
    expect(screen.getAllByText("Không lưu được")).toHaveLength(2);

    let resolve: (value: { isChecked: boolean; message: string; status: "success" }) => void = () => {};
    action.setFinanceOrderReviewAction.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    expect(screen.queryByText("Không lưu được")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    resolve({ isChecked: true, message: "ok", status: "success" });
    expect(await screen.findAllByRole("button", { name: "Bỏ xác nhận đơn SEPAY-101" })).toHaveLength(2);
  });

  it("clears a failed tick's notes on a chip change and on a filter write", async () => {
    action.setFinanceOrderReviewAction
      .mockResolvedValueOnce({ message: "Không có quyền.", status: "error" })
      .mockResolvedValueOnce({ message: "Không có quyền.", status: "error" });
    render(<FinanceOrdersPage canReview dashboard={board([order(1), order(2)])} filters={allFilters} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa xác nhận2" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Không lưu được")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nguồn"), { target: { value: "sb" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Không lưu được")).not.toBeInTheDocument();
  });

  it("lets a refreshed dashboard win over a local tick: stored time when it agrees, server state when it does not", async () => {
    action.setFinanceOrderReviewAction
      .mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" })
      .mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" });
    const { rerender } = render(<FinanceOrdersPage canReview dashboard={board([order(1)])} filters={allFilters} today={TODAY} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    expect(await within(tableRows()[0]!).findByText("vừa xác nhận")).toBeInTheDocument();

    // revalidatePath brings the stored review back with its time.
    rerender(
      <FinanceOrdersPage
        canReview
        dashboard={board([order(1, { checkedAt: "2026-10-16T02:40:00.000Z", isChecked: true })])}
        filters={allFilters}
        today={TODAY}
      />,
    );
    expect(within(tableRows()[0]!).getByText("lúc 16/10 09:40")).toBeInTheDocument();
    expect(screen.queryByText("vừa xác nhận")).not.toBeInTheDocument();

    // Tick again on a fresh unchecked load, then another accountant's untick arrives: the server wins.
    rerender(<FinanceOrdersPage canReview dashboard={board([order(1)])} filters={allFilters} today={TODAY} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    expect(await screen.findAllByRole("button", { name: "Bỏ xác nhận đơn SEPAY-101" })).toHaveLength(2);
    rerender(<FinanceOrdersPage canReview dashboard={board([order(1)])} filters={allFilters} today={TODAY} />);
    expect(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })).toHaveLength(2);
    expect(figure("Chưa xác nhận")).toHaveTextContent("1");
  });

  it("ignores a tick result that resolves after the refreshed dashboard already landed", async () => {
    let resolve: (value: { isChecked: boolean; message: string; status: "success" }) => void = () => {};
    action.setFinanceOrderReviewAction.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { rerender } = render(<FinanceOrdersPage canReview dashboard={board([order(1)])} filters={allFilters} today={TODAY} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    rerender(
      <FinanceOrdersPage
        canReview
        dashboard={board([order(1, { checkedAt: "2026-10-16T02:40:00.000Z", isChecked: true })])}
        filters={allFilters}
        today={TODAY}
      />,
    );
    resolve({ isChecked: true, message: "ok", status: "success" });

    // aria-busy is the pending signal (the toggle stays enabled while saving).
    await waitFor(() => expect(within(tableRows()[0]!).getByRole("button", { name: /đơn SEPAY-101$/ })).not.toHaveAttribute("aria-busy"));
    expect(within(tableRows()[0]!).getByText("lúc 16/10 09:40")).toBeInTheDocument();
    expect(screen.queryByText("vừa xác nhận")).not.toBeInTheDocument();
  });

  it("drops a row kept under a chip once the chip changes", async () => {
    action.setFinanceOrderReviewAction.mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" });
    render(<FinanceOrdersPage canReview dashboard={board([order(1), order(2)])} filters={allFilters} />);

    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa xác nhận2" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    expect(await screen.findAllByRole("button", { name: "Bỏ xác nhận đơn SEPAY-101" })).toHaveLength(2);
    expect(tableRows()).toHaveLength(2);

    fireEvent.click(within(chips()).getByRole("button", { name: "Đã xác nhận1" }));
    expect(tableRows().map((row) => within(row).getAllByRole("cell")[1]!.textContent)).toEqual([expect.stringContaining("Học sinh 1")]);
    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa xác nhận1" }));
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Học sinh 2");
  });

  it("wraps the student name on cards and truncates it (with title) only in the table", () => {
    const long = "Tôn Nữ Hoàng Bảo Ngọc Khánh Linh Nguyễn";
    const orders = [order(1, { studentFullName: long })];
    const { unmount } = render(<FinanceOrdersPage canReview={false} dashboard={board(orders)} filters={allFilters} />);

    const card = within(screen.getByRole("list", { name: TABLE })).getByRole("listitem");
    expect(within(card).getByText(long)).toHaveClass("break-words");
    expect(within(card).getByText(long)).not.toHaveClass("truncate");
    expect(within(tableRows()[0]!).getByText(long)).toHaveClass("truncate");
    expect(within(tableRows()[0]!).getByText(long)).toHaveAttribute("title", long);
    unmount();

    render(<FinanceOrdersPage canReview={false} canViewStudents dashboard={board(orders)} filters={allFilters} />);
    const linkedCard = within(screen.getByRole("list", { name: TABLE })).getByRole("listitem");
    expect(within(linkedCard).getByText(long)).toHaveClass("break-words");
    expect(within(linkedCard).getByText(long)).not.toHaveClass("truncate");
  });

  it("keeps the orders table inside the container that switches it on at 1042px (1040px floor + frame border)", () => {
    const { container } = render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={allFilters} />);

    const table = screen.getByRole("table", { name: TABLE });
    expect(table).toHaveClass("min-w-[1040px]");
    expect(table.closest(".finance-orders-operational-work-area")).not.toBeNull();
    expect(table.closest(".finance-orders-directory-table")).not.toBeNull();
    expect(container.querySelector(".finance-orders-directory-record-list")).not.toBeNull();
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.finance-orders-operational-work-area\s*\{\s*container-type: inline-size/);
    expect(css).toMatch(/@container \(min-width: 1042px\)\s*\{\s*\.finance-orders-directory-table/);
  });

  it("binds 'lúc' to a cross-year date with a no-break space instead of forbidding any wrap", () => {
    const orders = [order(1, { checkedAt: "2026-12-16T02:30:00.000Z", isChecked: true })];
    render(<FinanceOrdersPage canReview dashboard={board(orders)} filters={allFilters} today="2027-01-05" />);

    const detail = within(tableRows()[0]!).getByText("lúc 16/12/2026 09:30");
    expect(detail.textContent).toBe("lúc\u00a016/12/2026 09:30");
    expect(detail).not.toHaveClass("whitespace-nowrap");
    expect(detail.parentElement).not.toHaveClass("whitespace-nowrap");
  });

  it("keeps keyboard focus on the toggle while the tick is saved and ignores a second click meanwhile", async () => {
    let resolve: (value: { isChecked: boolean; message: string; status: "success" }) => void = () => {};
    action.setFinanceOrderReviewAction.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<FinanceOrdersPage canReview dashboard={board([order(1)])} filters={allFilters} />);

    const toggle = within(tableRows()[0]!).getByRole("button", { name: "Xác nhận đơn SEPAY-101" });
    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle).not.toBeDisabled();
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    expect(action.setFinanceOrderReviewAction).toHaveBeenCalledTimes(1);

    resolve({ isChecked: true, message: "ok", status: "success" });
    expect(await within(tableRows()[0]!).findByRole("button", { name: "Bỏ xác nhận đơn SEPAY-101" })).toBe(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(toggle).not.toHaveAttribute("aria-disabled");
  });

  it("scopes the header line and the strip to the filters when type, source or period narrow the month", () => {
    render(<FinanceOrdersPage canReview={false} dashboard={dashboard} filters={{ ...allFilters, source: "sb_f1" }} />);

    expect(screen.getByText("Tháng 08/2026 · theo bộ lọc · 1 đơn · 1 chưa xác nhận · 1 chưa cấu hình")).toBeInTheDocument();
    expect(screen.getByLabelText("Tóm tắt đơn hàng tháng 08/2026 · theo bộ lọc")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tóm tắt đơn hàng tháng 08/2026")).not.toBeInTheDocument();
  });

  it("announces a successful tick politely and clears it on the next tick, chip, page or query change", async () => {
    action.setFinanceOrderReviewAction
      .mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" })
      .mockResolvedValueOnce({ isChecked: false, message: "ok", status: "success" })
      .mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" })
      .mockResolvedValueOnce({ isChecked: true, message: "ok", status: "success" });
    const orders = Array.from({ length: 21 }, (_, index) => order(index + 1));
    const { rerender } = render(<FinanceOrdersPage canReview dashboard={board(orders)} filters={allFilters} />);
    const status = () => screen.getAllByRole("status").find((node) => node.classList.contains("sr-only"))!;
    expect(status()).toHaveTextContent(/^$/);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-101" })[0]!);
    await waitFor(() => expect(status()).toHaveTextContent("Đã xác nhận đơn SEPAY-101."));
    fireEvent.click(screen.getAllByRole("button", { name: "Bỏ xác nhận đơn SEPAY-101" })[0]!);
    await waitFor(() => expect(status()).toHaveTextContent("Đã bỏ xác nhận đơn SEPAY-101."));

    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa xác nhận21" }));
    expect(status()).toHaveTextContent(/^$/);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-102" })[0]!);
    await waitFor(() => expect(status()).toHaveTextContent("Đã xác nhận đơn SEPAY-102."));
    fireEvent.click(screen.getAllByRole("button", { name: "Sau" })[0]!);
    expect(status()).toHaveTextContent(/^$/);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn SEPAY-121" })[0]!);
    await waitFor(() => expect(status()).toHaveTextContent("Đã xác nhận đơn SEPAY-121."));
    rerender(<FinanceOrdersPage canReview dashboard={board(orders)} filters={{ ...allFilters, period: "2" }} />);
    expect(status()).toHaveTextContent(/^$/);
  });
});
