// Value: protects=the grading-credit list rules that decide which month a credit belongs to (Vietnam month of credited_at, same as payroll) and whether a total is the whole truth or "ít nhất N" over the newest rows; fails_when=a server-timezone month sneaks back in, a month that starts exactly at the oldest loaded credit is called exact, or the default month stops falling back to "Tất cả" when the current month has no row; why_new=the page had no tests and its old month count used the server-local month over at most 200 rows; seam=none; no_claim=the RPC ordering/limit itself (database) and the rendered markup (see grading-credits-page.test.tsx)
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ALL_OPTION,
  allGradingCreditFilters,
  buildCreditOptions,
  countActiveCreditFilters,
  describeCreditTotalScope,
  filterCredits,
  getCreditMonth,
  getDefaultMonth,
  getVietnamMonthStart,
  paginateCredits,
  resolveCreditFilters,
  summarizeCreditTotal,
} from "@/features/grading-credits/grading-credit-models";
import type { GradingCreditDashboardEntry } from "@/features/grading-credits/read-models";

function entry(
  id: string,
  creditedAt: string,
  overrides: Partial<GradingCreditDashboardEntry> = {},
): GradingCreditDashboardEntry {
  return {
    classCode: "6A",
    className: "Toán 6A",
    classSessionId: `session-${id}`,
    creditUnits: 1,
    creditedAt,
    graderDisplayName: "Trần Thu Hà",
    graderId: "grader-1",
    id,
    sessionDate: "2026-10-05",
    sessionResultId: `result-${id}`,
    studentFullName: "Nguyễn Minh An",
    studentId: `student-${id}`,
    studentPublicCode: "HS0001",
    ...overrides,
  };
}

describe("getCreditMonth", () => {
  // A host far from Vietnam proves the month never follows the server timezone.
  // (Worker threads ignore a runtime TZ change; the assertions still hold there.)
  const originalTimeZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });
  afterAll(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it("buckets by the Vietnam month, not the server or UTC month", () => {
    // 2026-09-30T17:30:00Z is 2026-10-01 00:30 in Vietnam.
    expect(getCreditMonth("2026-09-30T17:30:00Z")).toBe("2026-10");
    expect(getCreditMonth("2026-09-30T17:00:00Z")).toBe("2026-10");
    expect(getCreditMonth("2026-09-30T16:59:59Z")).toBe("2026-09");
    // Supabase style offset timestamps resolve to the same instant.
    expect(getCreditMonth("2026-10-31T23:30:00+07:00")).toBe("2026-10");
    expect(getCreditMonth("2026-10-31T17:00:00+00:00")).toBe("2026-11");
  });

  it("returns null for an unparseable timestamp instead of throwing", () => {
    expect(getCreditMonth("not-a-date")).toBeNull();
  });
});

describe("getVietnamMonthStart", () => {
  it("is midnight Vietnam time of the first day", () => {
    expect(new Date(getVietnamMonthStart("2026-10") ?? 0).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(getVietnamMonthStart("2026-13")).toBeNull();
    expect(getVietnamMonthStart("all")).toBeNull();
  });
});

describe("buildCreditOptions / getDefaultMonth", () => {
  const entries = [
    entry("a", "2026-10-12T03:00:00Z", { classCode: "7B", className: "Toán 7B", graderDisplayName: "Phạm Lan", graderId: "grader-2" }),
    entry("b", "2026-09-30T17:30:00Z"),
    entry("c", "2026-08-02T03:00:00Z", { classCode: "10A", className: "Toán 10A" }),
  ];

  it("lists Vietnam months newest first and distinct graders and classes", () => {
    const options = buildCreditOptions(entries);

    expect(options.months).toEqual([
      { label: "Tháng 10/2026", value: "2026-10" },
      { label: "Tháng 08/2026", value: "2026-08" },
    ]);
    expect(options.graders.map((option) => option.label)).toEqual(["Phạm Lan", "Trần Thu Hà"]);
    expect(options.classes.map((option) => option.value)).toEqual(["6A", "7B", "10A"]);
  });

  it("defaults to the current Vietnam month only when a row falls in it", () => {
    expect(getDefaultMonth(entries, "2026-10")).toBe("2026-10");
    expect(getDefaultMonth(entries, "2026-11")).toBe(ALL_OPTION);
    expect(getDefaultMonth([], "2026-10")).toBe(ALL_OPTION);
  });
});

describe("filterCredits / resolveCreditFilters / countActiveCreditFilters", () => {
  const entries = [
    entry("a", "2026-10-12T03:00:00Z", { graderId: "grader-2" }),
    entry("b", "2026-09-30T17:30:00Z", { classCode: "7B" }),
    entry("c", "2026-09-30T16:59:00Z"),
  ];

  it("filters by month, grader and class together", () => {
    expect(
      filterCredits(entries, { ...allGradingCreditFilters, month: "2026-10" }, { canViewAll: true }).map((row) => row.id),
    ).toEqual(["a", "b"]);
    expect(
      filterCredits(entries, { ...allGradingCreditFilters, graderId: "grader-2" }, { canViewAll: true }).map((row) => row.id),
    ).toEqual(["a"]);
    expect(
      filterCredits(entries, { classCode: "7B", graderId: ALL_OPTION, month: "2026-10" }, { canViewAll: true }).map((row) => row.id),
    ).toEqual(["b"]);
  });

  it("ignores the grader filter without view_all", () => {
    const filters = { ...allGradingCreditFilters, graderId: "grader-2" };

    expect(filterCredits(entries, filters, { canViewAll: false })).toHaveLength(3);
    expect(countActiveCreditFilters(filters, { canViewAll: false })).toBe(0);
    expect(countActiveCreditFilters(filters, { canViewAll: true })).toBe(1);
  });

  it("falls back to all for a value no loaded row offers any more", () => {
    const options = buildCreditOptions(entries);

    expect(
      resolveCreditFilters({ classCode: "9Z", graderId: "gone", month: "2025-01" }, options),
    ).toEqual(allGradingCreditFilters);
    expect(
      resolveCreditFilters({ classCode: "7B", graderId: "grader-2", month: "2026-10" }, options),
    ).toEqual({ classCode: "7B", graderId: "grader-2", month: "2026-10" });
  });
});

describe("summarizeCreditTotal", () => {
  const limit = 3;
  const newest = entry("a", "2026-10-12T03:00:00Z");
  const middle = entry("b", "2026-10-01T03:00:00Z");
  const oldestInSeptember = entry("c", "2026-09-20T03:00:00Z");
  const loaded = [newest, middle, oldestInSeptember];

  it("is exact for any selection when fewer rows than the limit came back", () => {
    expect(
      summarizeCreditTotal({ entries: [newest, middle], filtered: [newest, middle], limit, month: ALL_OPTION }),
    ).toEqual({ exact: true, limit, total: 2 });
  });

  it("is exact for a month that starts after the oldest loaded credit", () => {
    expect(
      summarizeCreditTotal({ entries: loaded, filtered: [newest, middle], limit, month: "2026-10" }),
    ).toEqual({ exact: true, limit, total: 2 });
  });

  it("is a lower bound for the month holding the oldest loaded credit and for every month", () => {
    expect(
      summarizeCreditTotal({ entries: loaded, filtered: [oldestInSeptember], limit, month: "2026-09" }),
    ).toEqual({ exact: false, limit, total: 1 });
    expect(
      summarizeCreditTotal({ entries: loaded, filtered: loaded, limit, month: ALL_OPTION }),
    ).toEqual({ exact: false, limit, total: 3 });
  });

  it("does not call a month exact when the oldest credit sits exactly on its start (ties may be cut)", () => {
    const onTheBoundary = entry("d", "2026-09-30T17:00:00Z"); // 2026-10-01 00:00 in Vietnam

    expect(
      summarizeCreditTotal({
        entries: [newest, middle, onTheBoundary],
        filtered: [newest, middle, onTheBoundary],
        limit,
        month: "2026-10",
      }).exact,
    ).toBe(false);
  });

  it("sums credit units of the filtered rows", () => {
    expect(
      summarizeCreditTotal({
        entries: [newest],
        filtered: [{ ...newest, creditUnits: 2 }, middle],
        limit,
        month: ALL_OPTION,
      }).total,
    ).toBe(3);
  });
});

describe("describeCreditTotalScope", () => {
  it("names the month and any narrowing filter", () => {
    expect(describeCreditTotalScope(allGradingCreditFilters, { canViewAll: true })).toBe("Tổng tín chỉ");
    expect(describeCreditTotalScope({ ...allGradingCreditFilters, month: "2026-10" }, { canViewAll: true })).toBe(
      "Tổng tín chỉ (tháng 10/2026)",
    );
    expect(describeCreditTotalScope({ classCode: "6A", graderId: ALL_OPTION, month: "2026-10" }, { canViewAll: false })).toBe(
      "Tổng tín chỉ (tháng 10/2026, theo bộ lọc)",
    );
    expect(describeCreditTotalScope({ ...allGradingCreditFilters, graderId: "grader-1" }, { canViewAll: false })).toBe(
      "Tổng tín chỉ",
    );
  });
});

describe("paginateCredits", () => {
  it("clamps the page and reports the visible range", () => {
    const rows = Array.from({ length: 45 }, (_, index) => index);

    expect(paginateCredits(rows, 3)).toMatchObject({ end: 45, page: 3, pageCount: 3, start: 41 });
    expect(paginateCredits(rows, 99)).toMatchObject({ page: 3 });
    expect(paginateCredits([], 5)).toMatchObject({ end: 0, page: 1, pageCount: 1, start: 0 });
  });
});
