import { describe, expect, it } from "vitest";

import {
  countActiveFinanceOrdersFilters,
  defaultFinanceOrdersFilters,
  getFinanceOrdersHref,
  isFinanceOrdersMonth,
  mergePendingFinanceOrdersFilter,
  parseFinanceOrdersFilters,
  resetFinanceOrdersFilters,
  serializeFinanceOrdersFilters,
} from "@/features/finance/finance-orders-url-state";

describe("Finance Orders URL state", () => {
  const now = new Date("2026-08-13T04:00:00.000Z");

  it("accepts only the approved month, type, source, and settlement filters", () => {
    expect(parseFinanceOrdersFilters(new URLSearchParams("month=2026-08&orderType=renewal&source=sb&period=2"), now)).toEqual({
      month: "2026-08",
      orderType: "renewal",
      period: "2",
      source: "sb",
    });

    expect(parseFinanceOrdersFilters(new URLSearchParams("month=2026-08&source=sb_f1"), now)).toMatchObject({
      month: "2026-08",
      source: "sb_f1",
    });

    expect(parseFinanceOrdersFilters(new URLSearchParams("month=invalid&orderType=guess&source=legacy&period=0"), now)).toEqual(defaultFinanceOrdersFilters(now));
  });

  it("owns only its filters and preserves unrelated query parameters", () => {
    const params = serializeFinanceOrdersFilters(
      new URLSearchParams("tab=overview&source=mma"),
      { month: "2026-07", orderType: "new_enrollment", period: "3", source: "sb_f1" },
    );

    expect(params.toString()).toBe("tab=overview&month=2026-07&orderType=new_enrollment&source=sb_f1&period=3");
  });

  it("uses the Asia/Ho_Chi_Minh business month at a UTC month boundary", () => {
    expect(defaultFinanceOrdersFilters(new Date("2026-07-31T18:00:00.000Z")).month).toBe("2026-08");
  });

  it("builds the href on the real route by default and on a preview base path, keeping unrelated params", () => {
    const filters = { month: "2026-10", orderType: "", period: "1", source: "sb" } as const;

    expect(getFinanceOrdersHref(new URLSearchParams("month=2026-09"), filters)).toBe("/finance/orders?month=2026-10&source=sb&period=1");
    expect(getFinanceOrdersHref(new URLSearchParams("view=finance-orders&role=accountant"), filters, "/dev/lists"))
      .toBe("/dev/lists?view=finance-orders&role=accountant&month=2026-10&source=sb&period=1");
  });

  it("counts type, source and period as active filters, never the month, and resets them keeping the month", () => {
    expect(countActiveFinanceOrdersFilters({ month: "2026-08", orderType: "", period: "", source: "" })).toBe(0);
    expect(countActiveFinanceOrdersFilters({ month: "2026-08", orderType: "renewal", period: "3", source: "sb_f1" })).toBe(3);
    expect(resetFinanceOrdersFilters({ month: "2026-08", orderType: "renewal", period: "3", source: "sb_f1" }))
      .toEqual({ month: "2026-08", orderType: "", period: "", source: "" });
  });

  it("composes quick successive changes on the pending filters, else on the rendered ones", () => {
    const rendered = { month: "2026-08", orderType: "", period: "", source: "" } as const;
    const first = mergePendingFinanceOrdersFilter(null, rendered, "source", "sb");

    expect(first).toEqual({ ...rendered, source: "sb" });
    expect(mergePendingFinanceOrdersFilter(first, rendered, "period", "2")).toEqual({ ...rendered, period: "2", source: "sb" });
  });

  it("accepts only a real YYYY-MM month for a write", () => {
    expect(isFinanceOrdersMonth("2026-10")).toBe(true);
    expect(isFinanceOrdersMonth("")).toBe(false);
    expect(isFinanceOrdersMonth("2026-1")).toBe(false);
    expect(isFinanceOrdersMonth("2026-13")).toBe(false);
  });
});
