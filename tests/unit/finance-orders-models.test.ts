import { describe, expect, it } from "vitest";

import {
  applyFinanceOrderReviewOverrides,
  buildFinanceOrderChips,
  buildFinanceOrderSettlement,
  countFinanceOrders,
  describeFinanceOrderReviewCaption,
  describeFinanceOrdersContext,
  describeFinanceOrderPeriodStatus,
  describeFinanceOrdersEmpty,
  describeFinanceOrdersSummaryLabel,
  describeFinanceOrderSourceAndSale,
  describeFinanceOrderStudentCaption,
  describeOperatingCostCaption,
  describeOperatingCostFigure,
  describeSettlementIntro,
  filterFinanceOrdersByChip,
  getFinanceOrderGuardianLabel,
  getFinanceOrderPeriodStatus,
  isFinanceOrderUnconfigured,
  paginateFinanceOrders,
} from "@/features/finance/finance-orders-models";
import type { FinanceOrderReadModel, FinanceOrderSettlementReadModel } from "@/features/finance/read-models";

const base: FinanceOrderReadModel = {
  bankTransactionId: "SEPAY-1",
  checkedAt: null,
  checkedBy: null,
  classCode: "7A",
  className: "Toán 7A",
  guardianFullName: "Nguyễn Thị Mai",
  guardianPhone: "0900000000",
  isChecked: false,
  leadSourceCode: "sandbox_partner",
  leadSourceName: "Đối tác Sandbox",
  mechanismCode: "renewal_sb_20_percent",
  operatingCostStatus: "configured",
  operatingCostVnd: 560_000,
  orderType: "renewal",
  referenceCode: "PAY-1",
  saleOwnerFullName: "Trần Hải",
  saleOwnerId: "sale-1",
  sepayTransactionId: "tx-1",
  settlementPeriod: 1,
  sourceCashflowRecordId: "cashflow-1",
  sourceCode: "sb",
  sourceLabel: "SB",
  studentFullName: "Nguyễn Minh An",
  studentId: "student-1",
  studentPublicCode: "HV001",
  transactionAt: "2026-08-05T03:00:00.000Z",
  transferContent: "TTVC PAY-1",
  tuitionAmountVnd: 2_800_000,
};

const order = (id: string, overrides: Partial<FinanceOrderReadModel> = {}): FinanceOrderReadModel => ({
  ...base,
  sourceCashflowRecordId: id,
  ...overrides,
});

const unconfigured = { mechanismCode: "unconfigured", operatingCostStatus: "unconfigured", operatingCostVnd: null } as const;

const settlementRow = (overrides: Partial<FinanceOrderSettlementReadModel>): FinanceOrderSettlementReadModel => ({
  checkedCount: 0,
  newEnrollmentCount: 0,
  operatingCostVnd: 0,
  period: 1,
  renewalCount: 0,
  tuitionAmountVnd: 0,
  uncheckedCount: 0,
  unconfiguredCount: 0,
  ...overrides,
});

describe("finance orders models: review overrides and counts", () => {
  it("applies successful client ticks by id and never reads the object prototype", () => {
    const rows = [order("a"), order("b", { isChecked: true }), order("constructor")];
    const applied = applyFinanceOrderReviewOverrides(rows, { a: true, b: false });

    expect(applied.map((row) => row.isChecked)).toEqual([true, false, false]);
    // Untouched rows keep their identity.
    expect(applyFinanceOrderReviewOverrides(rows, {})[0]).toBe(rows[0]);
  });

  it("counts checked, unchecked and unconfigured rows (a null cost is unconfigured, never 0)", () => {
    const rows = [
      order("a", { isChecked: true }),
      order("b", unconfigured),
      order("c", { operatingCostStatus: "configured", operatingCostVnd: null }),
    ];

    expect(isFinanceOrderUnconfigured(rows[2]!)).toBe(true);
    expect(countFinanceOrders(rows)).toEqual({ checked: 1, total: 3, unchecked: 2, unconfigured: 2 });
  });
});

describe("finance orders models: chips, filtering, paging", () => {
  it("always offers Tất cả and hides a zero chip unless it is active", () => {
    const counts = { checked: 0, total: 2, unchecked: 2, unconfigured: 1 };

    expect(buildFinanceOrderChips(counts, "all")).toEqual([
      { count: 2, label: "Tất cả", value: "all" },
      { count: 2, label: "Chưa xác nhận", value: "unchecked" },
      { count: 1, label: "Chưa cấu hình", value: "unconfigured" },
    ]);
    expect(buildFinanceOrderChips(counts, "checked").map((chip) => chip.value)).toEqual(["all", "unchecked", "checked", "unconfigured"]);
    expect(buildFinanceOrderChips({ checked: 0, total: 0, unchecked: 0, unconfigured: 0 }, "all")).toEqual([
      { count: 0, label: "Tất cả", value: "all" },
    ]);
  });

  it("filters by chip in server order and keeps rows ticked under the chip", () => {
    const rows = [order("a"), order("b", { isChecked: true }), order("c", unconfigured)];

    expect(filterFinanceOrdersByChip(rows, "all")).toEqual(rows);
    expect(filterFinanceOrdersByChip(rows, "unchecked").map((row) => row.sourceCashflowRecordId)).toEqual(["a", "c"]);
    expect(filterFinanceOrdersByChip(rows, "checked").map((row) => row.sourceCashflowRecordId)).toEqual(["b"]);
    expect(filterFinanceOrdersByChip(rows, "unconfigured").map((row) => row.sourceCashflowRecordId)).toEqual(["c"]);
    expect(filterFinanceOrdersByChip(rows, "unchecked", ["b"]).map((row) => row.sourceCashflowRecordId)).toEqual(["a", "b", "c"]);
  });

  it("pages 20 rows with 1-based ranges and clamps a page past the end", () => {
    const rows = Array.from({ length: 21 }, (_, index) => index);

    expect(paginateFinanceOrders(rows, 1)).toMatchObject({ end: 20, page: 1, pageCount: 2, start: 1 });
    expect(paginateFinanceOrders(rows, 99)).toMatchObject({ end: 21, page: 2, rows: [20], start: 21 });
    expect(paginateFinanceOrders([], 3)).toMatchObject({ end: 0, page: 1, pageCount: 1, start: 0 });
  });
});

describe("finance orders models: SB settlement view", () => {
  const sbRows = [
    order("a", { isChecked: true, settlementPeriod: 2 }),
    order("b", { settlementPeriod: 2 }),
    order("c", { settlementPeriod: 2, sourceCode: "mma", sourceLabel: "MMA" }),
  ];
  const server = [settlementRow({ checkedCount: 0, operatingCostVnd: 1_120_000, period: 2, renewalCount: 2, tuitionAmountVnd: 5_600_000, uncheckedCount: 2 })];
  // A finished month (August, seen on 18/10).
  const past = { month: "2026-08", today: "2026-10-18" };

  it("says SB settlement does not apply for an MMA or SB F1 filter, and that there is no SB row", () => {
    expect(buildFinanceOrderSettlement({ ...past, eligible: false, period: "", rows: sbRows, settlement: server })).toEqual({ kind: "ineligible" });
    expect(buildFinanceOrderSettlement({ ...past, eligible: true, period: "", rows: [], settlement: [] })).toEqual({ kind: "empty" });
  });

  it("draws every period of a finished month (zeros where no SB order) and recounts the review split from SB rows", () => {
    const view = buildFinanceOrderSettlement({ ...past, eligible: true, period: "", rows: sbRows, settlement: server });

    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") return;
    expect(view.rows.map((row) => [row.period, row.status])).toEqual([[1, "closed"], [2, "closed"], [3, "closed"]]);
    expect(view.rows[0]!.values).toEqual(settlementRow({ period: 1 }));
    // Money and type counts are the server's; the checked split comes from the SB rows only (MMA row c ignored).
    expect(view.rows[1]!.values).toMatchObject({ checkedCount: 1, operatingCostVnd: 1_120_000, renewalCount: 2, tuitionAmountVnd: 5_600_000, uncheckedCount: 1 });
  });

  it("shows only the selected period with a period filter (others were filtered out, not zero)", () => {
    const view = buildFinanceOrderSettlement({ ...past, eligible: true, period: "2", rows: sbRows, settlement: server });

    expect(view.kind === "rows" && view.rows.map((row) => row.period)).toEqual([2]);
  });

  it("marks the running period of the current month and draws later periods as not started, not as zeros", () => {
    const current = { month: "2026-08", today: "2026-08-15" };
    const view = buildFinanceOrderSettlement({ ...current, eligible: true, period: "", rows: sbRows, settlement: server });

    expect(view.kind === "rows" && view.rows.map((row) => [row.period, row.status, row.values === null])).toEqual([
      [1, "closed", false],
      [2, "current", false],
      [3, "upcoming", true],
    ]);
    expect(describeFinanceOrderPeriodStatus("current")).toBe("đang diễn ra (đến hôm nay)");
    expect(describeFinanceOrderPeriodStatus("upcoming")).toBe("chưa tới");
    expect(describeFinanceOrderPeriodStatus("closed")).toBeNull();
    // The period filter keeps its behaviour: the selected (running) period alone.
    const filtered = buildFinanceOrderSettlement({ ...current, eligible: true, period: "2", rows: sbRows, settlement: server });
    expect(filtered.kind === "rows" && filtered.rows.map((row) => [row.period, row.status])).toEqual([[2, "current"]]);
  });

  it("dates periods on the Vietnam business clock: day 10/11 and 20/21 boundaries, past and future months", () => {
    expect(getFinanceOrderPeriodStatus("2026-10", 1, "2026-10-10")).toBe("current");
    expect(getFinanceOrderPeriodStatus("2026-10", 2, "2026-10-10")).toBe("upcoming");
    expect(getFinanceOrderPeriodStatus("2026-10", 1, "2026-10-11")).toBe("closed");
    expect(getFinanceOrderPeriodStatus("2026-10", 2, "2026-10-20")).toBe("current");
    expect(getFinanceOrderPeriodStatus("2026-10", 3, "2026-10-21")).toBe("current");
    expect(getFinanceOrderPeriodStatus("2026-09", 3, "2026-10-01")).toBe("closed");
    expect(getFinanceOrderPeriodStatus("2026-11", 1, "2026-10-31")).toBe("upcoming");
  });

  it("marks every period of a future month as not started", () => {
    const view = buildFinanceOrderSettlement({ eligible: true, month: "2026-11", period: "", rows: sbRows, settlement: server, today: "2026-10-18" });

    expect(view.kind === "rows" && view.rows.map((row) => [row.status, row.values === null])).toEqual([
      ["upcoming", true],
      // A server row (clock skew) is still shown, marked as not started.
      ["upcoming", false],
      ["upcoming", true],
    ]);
  });

  it("builds the settlement intro from the periods list, scoped under a Loại đơn filter", () => {
    expect(describeSettlementIntro()).toBe("Chỉ tính đơn nguồn SB · Đợt 1: 01–10 · Đợt 2: 11–20 · Đợt 3: 21–cuối tháng.");
    expect(describeSettlementIntro({ filtered: true })).toBe("Chỉ tính đơn nguồn SB · theo bộ lọc · Đợt 1: 01–10 · Đợt 2: 11–20 · Đợt 3: 21–cuối tháng.");
  });

  it("leaves the type a Loại đơn filter excluded as null (filtered out), never 0", () => {
    const base = { eligible: true, month: "2026-08", period: "" as const, rows: sbRows, settlement: server, today: "2026-10-18" };
    const counts = (orderType: "" | "new_enrollment" | "renewal") => {
      const view = buildFinanceOrderSettlement({ ...base, orderType });
      return view.kind === "rows" ? view.rows.map((row) => [row.newEnrollmentCount, row.renewalCount]) : [];
    };

    expect(counts("")).toEqual([[0, 0], [0, 2], [0, 0]]);
    expect(counts("renewal")).toEqual([[null, 0], [null, 2], [null, 0]]);
    expect(counts("new_enrollment")).toEqual([[0, null], [0, null], [0, null]]);
  });
});

describe("finance orders models: copy", () => {
  it("shows the cost sum as — when no order in view has a configured cost, and a real 0 otherwise", () => {
    expect(describeOperatingCostFigure(0, { checked: 0, total: 2, unchecked: 2, unconfigured: 2 })).toBe("—");
    expect(describeOperatingCostFigure(0, { checked: 0, total: 2, unchecked: 2, unconfigured: 1 })).toMatch(/^0\s₫$/);
    expect(describeOperatingCostFigure(0, { checked: 0, total: 0, unchecked: 0, unconfigured: 0 })).toMatch(/^0\s₫$/);
  });

  it("scopes the header line and the strip label to the filters when they narrow the month", () => {
    const counts = { checked: 0, total: 2, unchecked: 2, unconfigured: 0 };
    expect(describeFinanceOrdersContext("2026-10", counts, { filtered: true }))
      .toBe("Tháng 10/2026 · theo bộ lọc · 2 đơn · 2 chưa xác nhận · 0 chưa cấu hình");
    expect(describeFinanceOrdersSummaryLabel("2026-10")).toBe("Tóm tắt đơn hàng tháng 10/2026");
    expect(describeFinanceOrdersSummaryLabel("2026-10", { filtered: true })).toBe("Tóm tắt đơn hàng tháng 10/2026 · theo bộ lọc");
  });

  it("gives each settlement period the strip's cost rule: — when all its SB orders lack a policy", () => {
    const unknownOnly = [order("u", { ...unconfigured, orderType: "unknown", settlementPeriod: 1 })];
    const view = buildFinanceOrderSettlement({
      eligible: true,
      month: "2026-08",
      period: "",
      rows: unknownOnly,
      settlement: [settlementRow({ operatingCostVnd: 0, period: 1, tuitionAmountVnd: 2_800_000, uncheckedCount: 1, unconfiguredCount: 1 })],
      today: "2026-10-18",
    });

    expect(view.kind === "rows" && view.rows.map((row) => row.operatingCostLabel)).toEqual(["—", expect.stringMatching(/^0\s₫$/), expect.stringMatching(/^0\s₫$/)]);
    const current = buildFinanceOrderSettlement({
      eligible: true,
      month: "2026-08",
      period: "",
      rows: unknownOnly,
      settlement: [settlementRow({ period: 1, unconfiguredCount: 1 })],
      today: "2026-08-05",
    });
    expect(current.kind === "rows" && current.rows.map((row) => row.operatingCostLabel)).toEqual(["—", null, null]);
  });

  it("writes the header counts and the cost caveat", () => {
    expect(describeFinanceOrdersContext("2026-08", { checked: 3, total: 5, unchecked: 2, unconfigured: 1 }))
      .toBe("Tháng 08/2026 · 5 đơn · 2 chưa xác nhận · 1 chưa cấu hình");
    expect(describeOperatingCostCaption(0)).toBeNull();
    expect(describeOperatingCostCaption(2)).toBe("chưa gồm 2 đơn chưa cấu hình");
  });

  it("captions a checked order with its Vietnam time, 'vừa xác nhận' after a tick, nothing when unchecked", () => {
    const checked = { checkedAt: "2026-08-16T02:30:00.000Z", isChecked: true };

    expect(describeFinanceOrderReviewCaption(checked, { justChecked: false, today: "2026-10-16" })).toBe("lúc\u00a016/08 09:30");
    expect(describeFinanceOrderReviewCaption(checked, { justChecked: false, today: "2027-01-02" })).toBe("lúc\u00a016/08/2026 09:30");
    expect(describeFinanceOrderReviewCaption({ checkedAt: null, isChecked: true }, { justChecked: true, today: "2026-10-16" })).toBe("vừa xác nhận");
    expect(describeFinanceOrderReviewCaption({ checkedAt: null, isChecked: true }, { justChecked: false, today: "2026-10-16" })).toBeNull();
    expect(describeFinanceOrderReviewCaption({ ...checked, isChecked: false }, { justChecked: false, today: "2026-10-16" })).toBeNull();
  });

  it("names the student's class, guardian and the source with the Sale in one string", () => {
    expect(describeFinanceOrderStudentCaption(base)).toBe("HV001 · 7A Toán 7A");
    expect(describeFinanceOrderStudentCaption({ ...base, classCode: null, className: null })).toBe("HV001 · Chưa xác định");
    expect(getFinanceOrderGuardianLabel({ guardianFullName: null })).toBe("Phụ huynh chưa xác định");
    expect(describeFinanceOrderSourceAndSale({ leadSourceName: "CTV F1", saleOwnerFullName: null, sourceLabel: "SB F1" }))
      .toBe("SB F1 · CTV F1 · Sale Chưa xác định");
  });

  it("explains an empty table by cause: chip, server filters, or an empty month", () => {
    expect(describeFinanceOrdersEmpty({ activeFilterCount: 1, chip: "unchecked", hasRows: true, month: "2026-08" }))
      .toMatchObject({ action: "all", title: "Không có đơn chưa xác nhận" });
    expect(describeFinanceOrdersEmpty({ activeFilterCount: 2, chip: "all", hasRows: false, month: "2026-08" }))
      .toMatchObject({ action: "reset", description: "Không có khoản thu học phí khớp với bộ lọc này.", title: "Chưa có đơn hàng" });
    expect(describeFinanceOrdersEmpty({ activeFilterCount: 0, chip: "checked", hasRows: false, month: "2026-08" })).toEqual({
      action: null,
      description: "Chưa có khoản thu học phí nào trong tháng 08/2026.",
      title: "Chưa có đơn hàng",
    });
    // The receipt copy never borrows the review word.
    for (const copy of [
      describeFinanceOrdersEmpty({ activeFilterCount: 1, chip: "all", hasRows: false, month: "2026-08" }),
      describeFinanceOrdersEmpty({ activeFilterCount: 0, chip: "all", hasRows: false, month: "2026-08" }),
    ]) expect(copy.description).not.toMatch(/xác nhận/);
  });
});
