// Value: protects=the /dev/lists finance orders preview is inert and truthful per role: the review toggle runs the preview's stub and never setFinanceOrderReviewAction (the preview runs on localhost where .env.local may point at production); filters are read from and written to /dev/lists (never the real route) and the fixture "RPC" filters and aggregates like get_finance_orders_dashboard; the owner gets student links, the accountant reviews without them, a teaching assistant gets the route's real denial; "capped" equals "normal" and "empty" stays inside the frame;
// fails_when=the page stops accepting an injected review action, the preview stops passing previewFinanceOrderActions or basePath, the page imports another finance action without a stub, the fixture RPC drifts from the migration rules (Vietnam month and period, SB-only settlement, eligibility), or a role leaks another role's controls;
// why_new=step 14c adds a finance-orders view to /dev/lists whose review toggle writes finance_order_reviews;
// seam=the finance actions module is mocked so any real call is observable; next/navigation provides useRouter and a settable useSearchParams; the body has no AppShell (the controller wraps it); no_claim=the /dev/lists page wiring, AppShell navigation and the production 404 (dev-lists-preview.test.tsx)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  financeOrderPreviewNow,
  financeOrderPreviewOrders,
  getFinanceOrderPreviewPeriod,
  runFinanceOrdersPreviewRpc,
} from "@/app/dev/lists/finance-order-fixtures";
import { FinanceOrdersPreviewBody, previewFinanceOrderActions } from "@/app/dev/lists/finance-orders-preview";
import * as financeActions from "@/features/finance/actions/finance-actions";
import { toVietnamDate } from "@/lib/datetime";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const search = vi.hoisted(() => ({ value: "view=finance-orders" }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/features/finance/actions/finance-actions", () => ({
  allocatePaymentAction: vi.fn(),
  cancelPaymentRequestAction: vi.fn(),
  createPaymentRequestAction: vi.fn(),
  setFinanceOrderReviewAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const TABLE = "Danh sách đơn hàng tài chính";
const month = (value: string) => ({ month: value, orderType: "", period: "", source: "" }) as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  search.value = "view=finance-orders";
});

function expectNothingReal() {
  for (const action of Object.values(financeActions)) {
    if (typeof action === "function") expect(action).not.toHaveBeenCalled();
  }
  expect(router.refresh).not.toHaveBeenCalled();
}

const tableRows = () => within(screen.getByRole("table", { name: TABLE })).getAllByRole("row").slice(1);

describe("/dev/lists finance orders preview", () => {
  it("stubs every finance action the orders page imports", () => {
    // The page's real imports, so a new action used by the page fails here until it gets a stub.
    const source = readFileSync(join(process.cwd(), "src/features/finance/components/finance-orders-page.tsx"), "utf8");
    const block = /import \{([^}]*)\} from "@\/features\/finance\/actions\/finance-actions";/.exec(source)?.[1] ?? "";
    const imported = Array.from(block.matchAll(/(\w+)Action\b/g), (match) => match[1]);
    expect(imported).toEqual(["setFinanceOrderReview"]);
    expect(Object.keys(previewFinanceOrderActions).sort()).toEqual(imported.sort());
  });

  it("fixtures cover every source, type, cost status, review state and period, newest first", () => {
    const orders = financeOrderPreviewOrders;
    expect(new Set(orders.map((order) => order.sourceLabel))).toEqual(new Set(["MMA", "SB", "SB F1", null]));
    expect(orders.some((order) => order.sourceLabel === null && order.leadSourceName)).toBe(true);
    expect(orders.some((order) => order.sourceLabel === null && !order.leadSourceName)).toBe(true);
    expect(new Set(orders.map((order) => order.orderType))).toEqual(new Set(["new_enrollment", "renewal", "unknown"]));
    expect(new Set(orders.map((order) => order.operatingCostStatus))).toEqual(new Set(["configured", "unconfigured"]));
    expect(orders.filter((order) => order.isChecked).every((order) => order.checkedAt && order.checkedBy)).toBe(true);
    expect(orders.filter((order) => !order.isChecked).every((order) => !order.checkedAt && !order.checkedBy)).toBe(true);
    expect(new Set(orders.map((order) => order.settlementPeriod))).toEqual(new Set([1, 2, 3]));
    expect(new Set(orders.map((order) => toVietnamDate(order.transactionAt).slice(0, 7)))).toEqual(new Set(["2026-09", "2026-10"]));
    expect(orders.some((order) => order.guardianFullName && !order.guardianPhone)).toBe(true);
    expect(orders.some((order) => !order.guardianFullName && !order.className && !order.saleOwnerFullName)).toBe(true);
    const times = orders.map((order) => order.transactionAt);
    expect(times).toEqual([...times].sort((a, b) => b.localeCompare(a)));
    // Nothing after the fixture clock.
    expect(times.every((time) => new Date(time) <= financeOrderPreviewNow)).toBe(true);
    // Cost rules of get_finance_order_operating_cost.
    const cost = (predicate: (order: (typeof orders)[number]) => boolean) => orders.find(predicate)?.operatingCostVnd;
    expect(cost((order) => order.sourceCode === "sb" && order.orderType === "renewal" && order.tuitionAmountVnd === 2_800_000)).toBe(560_000);
    expect(cost((order) => order.sourceCode === "sb" && order.orderType === "new_enrollment" && order.tuitionAmountVnd === 3_600_000)).toBe(1_600_000);
    expect(cost((order) => order.sourceCode === "mma" && order.orderType === "renewal")).toBe(0);
    expect(orders.filter((order) => order.sourceCode === "sb_f1").every((order) => order.operatingCostVnd === null)).toBe(true);
  });

  it("buckets month and period on the Vietnam bank date", () => {
    expect(getFinanceOrderPreviewPeriod("2026-10-10T17:30:00.000Z")).toBe(2);
    const october = runFinanceOrdersPreviewRpc(financeOrderPreviewOrders, month("2026-10"));
    expect(october.orders.some((order) => order.transactionAt === "2026-09-30T18:00:00.000Z")).toBe(true);
  });

  it("fixture RPC: filtered rows newest first, summary over them, SB-only settlement for periods with rows, eligibility", () => {
    const october = runFinanceOrdersPreviewRpc(financeOrderPreviewOrders, month("2026-10"));
    expect(october.month).toBe("2026-10-01");
    expect(october.orders).toHaveLength(24);
    expect(october.summary).toEqual({
      checkedCount: 11,
      operatingCostVnd: october.orders.reduce((sum, order) => sum + (order.operatingCostVnd ?? 0), 0),
      orderCount: 24,
      tuitionAmountVnd: october.orders.reduce((sum, order) => sum + order.tuitionAmountVnd, 0),
      uncheckedCount: 13,
      unconfiguredCount: 7,
    });
    expect(october.settlement.map((row) => row.period)).toEqual([1, 2]);
    const sbOctober = october.orders.filter((order) => order.sourceCode === "sb");
    expect(october.settlement.reduce((sum, row) => sum + row.tuitionAmountVnd, 0)).toBe(
      sbOctober.reduce((sum, order) => sum + order.tuitionAmountVnd, 0),
    );
    expect(october.settlementEligible).toBe(true);

    const septemberLate = runFinanceOrdersPreviewRpc(financeOrderPreviewOrders, { ...month("2026-09"), period: "3" });
    expect(septemberLate.orders).toHaveLength(2);
    expect(septemberLate.settlement).toEqual([
      { checkedCount: 1, newEnrollmentCount: 0, operatingCostVnd: 560_000, period: 3, renewalCount: 1, tuitionAmountVnd: 2_800_000, uncheckedCount: 0, unconfiguredCount: 0 },
    ]);

    for (const source of ["mma", "sb_f1"] as const) {
      const result = runFinanceOrdersPreviewRpc(financeOrderPreviewOrders, { ...month("2026-10"), source });
      expect(result.settlementEligible).toBe(false);
      expect(result.settlement).toEqual([]);
      expect(result.orders.every((order) => order.sourceCode === source)).toBe(true);
    }
  });

  it("owner: default month from the fixture clock, pages, student links, and a review that only reaches the stub", async () => {
    const review = vi.spyOn(previewFinanceOrderActions, "setFinanceOrderReview");
    render(<FinanceOrdersPreviewBody role="owner" state="normal" />);

    expect(screen.getByText("Tháng 10/2026 · 24 đơn · 13 chưa xác nhận · 7 chưa cấu hình")).toBeInTheDocument();
    expect(screen.getAllByText("1–20 trong 24 đơn")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Mở hồ sơ học viên Nguyễn Minh An" })[0]).toHaveAttribute(
      "href",
      `/students/${financeOrderPreviewOrders[0]!.studentId}`,
    );
    // The fixture clock is 16/10: Đợt 2 is still running and Đợt 3 has not started ("—", not a zero).
    const settlement = within(screen.getByRole("table", { name: "Quyết toán chi phí vận hành SB theo đợt" })).getAllByRole("row");
    expect(settlement.slice(1).map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      expect.arrayContaining(["Đợt 1 01–10"]),
      expect.arrayContaining(["Đợt 2 11–20đang diễn ra (đến hôm nay)"]),
      ["Đợt 3 21–cuối thángchưa tới", "—", "—", "—", "—", "—"],
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn FT26289104211" })[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expect(review).toHaveBeenCalledWith(financeOrderPreviewOrders[0]!.sourceCashflowRecordId, true);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Xác nhận đơn FT26289104211" })[0]).not.toHaveAttribute("aria-busy"));
    expect(screen.getAllByRole("button", { name: "Xác nhận đơn FT26289104211" })).toHaveLength(2);
    expect(router.replace).not.toHaveBeenCalled();
    expectNothingReal();
  });

  it("accountant: reviews without student profile links (no students.view)", async () => {
    render(<FinanceOrdersPreviewBody role="accountant" state="normal" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByText("Nguyễn Minh An").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận đơn FT26289091577" })[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("SB F1 only: the cost sum shows — (no configured order in view) and SB settlement does not apply", () => {
    search.value = "view=finance-orders&source=sb_f1";
    render(<FinanceOrdersPreviewBody role="owner" state="normal" />);

    const strip = screen.getByLabelText("Tóm tắt đơn hàng tháng 10/2026 · theo bộ lọc");
    expect(within(strip).getByText("Chi phí vận hành").nextElementSibling).toHaveTextContent(/^—$/);
    expect(within(strip).getByText("chưa gồm 2 đơn chưa cấu hình")).toBeInTheDocument();
    expect(screen.getByText("Không có dữ liệu quyết toán SB khi lọc nguồn MMA hoặc SB F1.")).toBeInTheDocument();

    cleanup();
    // MMA Tái phí has a configured policy of 0: a real "0 ₫".
    search.value = "view=finance-orders&source=mma&orderType=renewal";
    render(<FinanceOrdersPreviewBody role="owner" state="normal" />);
    expect(within(screen.getByLabelText("Tóm tắt đơn hàng tháng 10/2026 · theo bộ lọc")).getByText("Chi phí vận hành").nextElementSibling)
      .toHaveTextContent(/^0\s₫$/);
  });

  it("teaching assistant: the route's real denial, no data", () => {
    render(<FinanceOrdersPreviewBody role="ta" state="normal" />);

    expect(screen.getByText("Không có quyền xem Đơn hàng")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("reads filters from the URL and writes them back to /dev/lists, keeping view and role", () => {
    search.value = "view=finance-orders&role=accountant&month=2026-09&source=sb";
    render(<FinanceOrdersPreviewBody role="accountant" state="normal" />);

    expect(screen.getByText("Tháng 09/2026 · theo bộ lọc · 2 đơn · 0 chưa xác nhận · 0 chưa cấu hình")).toBeInTheDocument();
    for (const row of tableRows()) expect(row).toHaveTextContent("SB · Đối tác Sandbox");
    expect(screen.getByLabelText("Nguồn")).toHaveValue("sb");

    fireEvent.change(screen.getByLabelText("Nguồn"), { target: { value: "mma" } });
    expect(router.replace).toHaveBeenCalledWith("/dev/lists?view=finance-orders&role=accountant&month=2026-09&source=mma", {
      scroll: false,
    });
  });

  it("capped renders the same rows as normal (the orders RPC has no row cap)", () => {
    const { unmount } = render(<FinanceOrdersPreviewBody role="owner" state="normal" />);
    const normal = tableRows().map((row) => row.textContent);
    unmount();

    render(<FinanceOrdersPreviewBody role="owner" state="capped" />);
    expect(tableRows().map((row) => row.textContent)).toEqual(normal);
  });

  it.each(["owner", "accountant"] as const)("empty (%s) keeps both empty states inside their frames", (role) => {
    render(<FinanceOrdersPreviewBody role={role} state="empty" />);

    expect(screen.getByRole("table", { name: TABLE })).toBeInTheDocument();
    expect(screen.getByText("Chưa có đơn hàng")).toBeInTheDocument();
    expect(screen.getByText("Chưa có dữ liệu quyết toán SB")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Lọc nhanh đơn hàng" })).not.toBeInTheDocument();
  });

  it("empty (ta) is still the denial", () => {
    render(<FinanceOrdersPreviewBody role="ta" state="empty" />);

    expect(screen.getByText("Không có quyền xem Đơn hàng")).toBeInTheDocument();
  });
});
