import { describe, expect, it } from "vitest";

import {
  defaultFinanceOrdersFilters,
  parseFinanceOrdersFilters,
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
});
