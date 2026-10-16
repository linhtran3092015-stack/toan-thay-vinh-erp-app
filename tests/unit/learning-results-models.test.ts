import { describe, expect, it } from "vitest";

import {
  applyLearningResultQuickChip,
  countActiveLearningResultFilters,
  countLearningResultQuickChips,
  defaultLearningResultFilters,
  formatLearningResultScore,
  getLearningResultClassOptions,
  getLearningResultGradeOptions,
  getLearningResultQuickChip,
  getOldestLearningResultDate,
  isBelowFive,
  matchesLearningResultFilters,
  needsAttention,
  normalizeSearch,
  paginateLearningResults,
  reachesBeforeLoadedWindow,
  type LearningResultFiltersState,
} from "@/features/learning-results/learning-result-models";
import type { LearningResultDirectoryItem } from "@/features/learning-results/read-models";

function item(
  overrides: Partial<LearningResultDirectoryItem> = {},
): LearningResultDirectoryItem {
  return {
    classCode: "9A",
    classGrade: 9,
    classId: "class-9a",
    classLevel: "A",
    className: "Toán 9A",
    classSessionId: "session-1",
    currentGrade: 9,
    gradedAt: null,
    lockedAt: null,
    notebookScore: 8,
    notebookStatus: "submitted",
    resultComment: null,
    resultId: "result-1",
    sessionDate: "2026-10-14",
    sessionStatus: "completed",
    studentCode: "HS0001",
    studentId: "student-1",
    studentName: "Nguyễn Minh An",
    testScore: 7,
    ...overrides,
  };
}

const withFilters = (
  overrides: Partial<LearningResultFiltersState>,
): LearningResultFiltersState => ({
  ...defaultLearningResultFilters,
  ...overrides,
});

describe("learning result rules", () => {
  it("treats a missing test score as not below 5", () => {
    expect(isBelowFive(item({ testScore: null }))).toBe(false);
    expect(isBelowFive(item({ testScore: 4.99 }))).toBe(true);
    expect(isBelowFive(item({ testScore: 5 }))).toBe(false);
    expect(isBelowFive(item({ testScore: 0 }))).toBe(true);
  });

  it("flags attention for an unsubmitted notebook or a test/notebook score under 5", () => {
    expect(needsAttention(item())).toBe(false);
    expect(needsAttention(item({ testScore: null }))).toBe(false);
    expect(needsAttention(item({ notebookScore: null, notebookStatus: "not_submitted" }))).toBe(true);
    expect(needsAttention(item({ testScore: 3 }))).toBe(true);
    expect(needsAttention(item({ notebookScore: 4 }))).toBe(true);
    expect(needsAttention(item({ notebookScore: null, notebookStatus: "not_required" }))).toBe(false);
  });

  it("folds accents and đ in search", () => {
    expect(normalizeSearch("  Đỗ Gia HUY ")).toBe("do gia huy");
    expect(normalizeSearch("Toán")).toBe("toan");
    expect(normalizeSearch("Đỗ Thị Ánh Nguyệt")).toBe("do thi anh nguyet");
    // Precomposed and decomposed input fold the same way.
    expect(normalizeSearch("Nguyệt".normalize("NFD"))).toBe("nguyet");
  });

  it("formats scores with up to two Vietnamese decimals", () => {
    expect(formatLearningResultScore(7.5)).toBe("7,5");
    expect(formatLearningResultScore(10)).toBe("10");
    expect(formatLearningResultScore(8.256)).toBe("8,26");
    expect(formatLearningResultScore(0)).toBe("0");
  });
});

describe("capped load window", () => {
  it("finds the oldest loaded session date, or null for no rows", () => {
    expect(getOldestLearningResultDate([])).toBeNull();
    expect(
      getOldestLearningResultDate([
        item({ sessionDate: "2026-10-14" }),
        item({ sessionDate: "2026-09-30" }),
        item({ sessionDate: "2026-10-02" }),
      ]),
    ).toBe("2026-09-30");
  });

  it("flags a date range that may reach rows the cap cut: from on or before the oldest day, or no from at all", () => {
    const oldest = "2026-09-30";

    // No bounds: the default view is exactly the newest rows.
    expect(reachesBeforeLoadedWindow(withFilters({}), oldest)).toBe(false);
    // dateFrom before, or on, the oldest loaded day: that day may be cut partway.
    expect(reachesBeforeLoadedWindow(withFilters({ dateFrom: "2026-09-01" }), oldest)).toBe(true);
    expect(reachesBeforeLoadedWindow(withFilters({ dateFrom: oldest }), oldest)).toBe(true);
    // dateFrom after the oldest loaded day is fully inside the window.
    expect(reachesBeforeLoadedWindow(withFilters({ dateFrom: "2026-10-01" }), oldest)).toBe(false);
    // dateTo alone reaches back without limit, whether older than, on, or newer than the oldest day.
    expect(reachesBeforeLoadedWindow(withFilters({ dateTo: "2026-09-29" }), oldest)).toBe(true);
    expect(reachesBeforeLoadedWindow(withFilters({ dateTo: oldest }), oldest)).toBe(true);
    expect(reachesBeforeLoadedWindow(withFilters({ dateTo: "2026-10-12" }), oldest)).toBe(true);
    // A dateFrom after the oldest day bounds the range from below whatever dateTo says.
    expect(
      reachesBeforeLoadedWindow(withFilters({ dateFrom: "2026-10-01", dateTo: "2026-10-05" }), oldest),
    ).toBe(false);
    expect(
      reachesBeforeLoadedWindow(withFilters({ dateFrom: oldest, dateTo: "2026-10-05" }), oldest),
    ).toBe(true);
  });
});

describe("matchesLearningResultFilters", () => {
  it("applies every filter, with the grade being the class grade", () => {
    const row = item({ classGrade: 8, currentGrade: 9, sessionDate: "2026-10-10" });

    expect(matchesLearningResultFilters(row, withFilters({ grade: "8" }))).toBe(true);
    expect(matchesLearningResultFilters(row, withFilters({ grade: "9" }))).toBe(false);
    expect(matchesLearningResultFilters(row, withFilters({ classId: "class-9a" }))).toBe(true);
    expect(matchesLearningResultFilters(row, withFilters({ classId: "other" }))).toBe(false);
    expect(matchesLearningResultFilters(row, withFilters({ dateFrom: "2026-10-10" }))).toBe(true);
    expect(matchesLearningResultFilters(row, withFilters({ dateFrom: "2026-10-11" }))).toBe(false);
    expect(matchesLearningResultFilters(row, withFilters({ dateTo: "2026-10-10" }))).toBe(true);
    expect(matchesLearningResultFilters(row, withFilters({ dateTo: "2026-10-09" }))).toBe(false);
    expect(matchesLearningResultFilters(row, withFilters({ notebookStatus: "submitted" }))).toBe(true);
    expect(matchesLearningResultFilters(row, withFilters({ notebookStatus: "not_required" }))).toBe(false);
    expect(matchesLearningResultFilters(row, withFilters({ search: "toan 9a" }))).toBe(true);
    expect(matchesLearningResultFilters(row, withFilters({ search: "hs0001" }))).toBe(true);
    expect(matchesLearningResultFilters(row, withFilters({ search: "zzz" }))).toBe(false);
  });

  it("matches the score states and lets chip counts ignore only the chip-driven filters", () => {
    const unscored = item({ testScore: null });
    expect(matchesLearningResultFilters(unscored, withFilters({ scoreStatus: "scored" }))).toBe(false);
    expect(matchesLearningResultFilters(unscored, withFilters({ scoreStatus: "unscored" }))).toBe(true);
    expect(matchesLearningResultFilters(unscored, withFilters({ scoreStatus: "below_five" }))).toBe(false);

    const filters = withFilters({ classId: "class-9a", scoreStatus: "below_five" });
    expect(matchesLearningResultFilters(unscored, filters, { ignoreQuick: true })).toBe(true);
    expect(
      matchesLearningResultFilters(item({ classId: "other" }), filters, { ignoreQuick: true }),
    ).toBe(false);
  });
});

describe("quick chips", () => {
  const rows = [
    item({ resultId: "a" }),
    item({ resultId: "b", testScore: null }),
    item({ notebookScore: null, notebookStatus: "not_submitted", resultId: "c", testScore: 4 }),
    item({ classId: "class-8b", resultId: "d", testScore: 3 }),
  ];

  it("counts the loaded rows per chip and respects the non-chip filters", () => {
    expect(countLearningResultQuickChips(rows, defaultLearningResultFilters)).toEqual({
      all: 4,
      attention: 2,
      below_five: 2,
      not_submitted: 1,
      unscored: 1,
    });
    expect(
      countLearningResultQuickChips(rows, withFilters({ classId: "class-9a", scoreStatus: "unscored" })),
    ).toEqual({ all: 3, attention: 1, below_five: 1, not_submitted: 1, unscored: 1 });
  });

  it("derives the pressed chip from the filter state", () => {
    expect(getLearningResultQuickChip(defaultLearningResultFilters)).toBe("all");
    expect(getLearningResultQuickChip(withFilters({ classId: "x", search: "y" }))).toBe("all");
    expect(getLearningResultQuickChip(withFilters({ scoreStatus: "unscored" }))).toBe("unscored");
    expect(getLearningResultQuickChip(withFilters({ scoreStatus: "below_five" }))).toBe("below_five");
    expect(getLearningResultQuickChip(withFilters({ scoreStatus: "attention" }))).toBe("attention");
    expect(getLearningResultQuickChip(withFilters({ notebookStatus: "not_submitted" }))).toBe("not_submitted");
    // No single chip: the select-only values and combinations.
    expect(getLearningResultQuickChip(withFilters({ scoreStatus: "scored" }))).toBeNull();
    expect(getLearningResultQuickChip(withFilters({ notebookStatus: "submitted" }))).toBeNull();
    expect(
      getLearningResultQuickChip(withFilters({ notebookStatus: "not_submitted", scoreStatus: "unscored" })),
    ).toBeNull();
  });

  it("sets the chip exclusively and keeps the other filters", () => {
    const base = withFilters({ classId: "class-9a", notebookStatus: "submitted", scoreStatus: "below_five", search: "an" });

    expect(applyLearningResultQuickChip(base, "all")).toEqual({ ...base, notebookStatus: "", scoreStatus: "" });
    expect(applyLearningResultQuickChip(base, "not_submitted")).toEqual({
      ...base,
      notebookStatus: "not_submitted",
      scoreStatus: "",
    });
    expect(applyLearningResultQuickChip(base, "attention")).toEqual({
      ...base,
      notebookStatus: "",
      scoreStatus: "attention",
    });
  });
});

describe("filter helpers", () => {
  it("counts non-empty filters and ignores a blank search", () => {
    expect(countActiveLearningResultFilters(defaultLearningResultFilters)).toBe(0);
    expect(countActiveLearningResultFilters(withFilters({ search: "   " }))).toBe(0);
    expect(
      countActiveLearningResultFilters(
        withFilters({ classId: "c", dateFrom: "2026-10-01", grade: "9", scoreStatus: "scored", search: "a" }),
      ),
    ).toBe(5);
  });

  it("lists classes by name and disambiguates a shared name with its code", () => {
    const options = getLearningResultClassOptions([
      item({ classCode: "9A", classId: "c1", className: "Toán 9A" }),
      item({ classCode: "9A", classId: "c1", className: "Toán 9A", resultId: "dup" }),
      item({ classCode: "8B", classId: "c2", className: "Toán 8B" }),
      item({ classCode: "X1", classId: "c3", className: "Toán 9A" }),
    ]);

    expect(options).toEqual([
      { id: "c2", label: "Toán 8B" },
      { id: "c1", label: "Toán 9A · 9A" },
      { id: "c3", label: "Toán 9A · X1" },
    ]);
    expect(
      getLearningResultGradeOptions([item({ classGrade: 9 }), item({ classGrade: 7 }), item({ classGrade: 9 })]),
    ).toEqual([7, 9]);
  });

  it("paginates 1-based, clamps the page and reports 0–0 for an empty list", () => {
    const rows = Array.from({ length: 45 }, (_, index) => index);

    expect(paginateLearningResults(rows, 1)).toMatchObject({ page: 1, pageCount: 3, rangeEnd: 20, rangeStart: 1, total: 45 });
    expect(paginateLearningResults(rows, 3)).toMatchObject({ page: 3, rangeEnd: 45, rangeStart: 41 });
    expect(paginateLearningResults(rows, 3).rows).toHaveLength(5);
    expect(paginateLearningResults(rows, 99).page).toBe(3);
    expect(paginateLearningResults(rows, 0).page).toBe(1);
    expect(paginateLearningResults([], 4)).toMatchObject({ page: 1, pageCount: 1, rangeEnd: 0, rangeStart: 0, rows: [], total: 0 });
  });
});
