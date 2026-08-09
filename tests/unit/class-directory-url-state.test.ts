import { describe, expect, it } from "vitest";

import { defaultClassFilters, filterClasses, paginateClasses } from "@/features/classes/class-filters";
import {
  getClassDirectoryHref,
  mergePendingClassDirectoryFilter,
  parseClassDirectoryViewState,
  resetClassDirectoryViewState,
  serializeClassDirectoryViewState,
} from "@/features/classes/class-directory-url-state";
import type { ClassDirectoryItem } from "@/features/classes/read-models";

const years = ["2025-2026", "2024-2025"];
const classItem: ClassDirectoryItem = { academicYear: { code: "2025-2026", endsOn: "2026-05-31", id: "year", isCurrent: true, name: "Năm học", startsOn: "2025-08-01", status: "active" }, activeScheduleCount: 1, activeStudentCount: 8, code: "7A", defaultLearningMode: "offline", grade: 7, id: "class-1", level: "A", name: "Toán 7A", notes: null, status: "active", weeklySessionCount: 2 };

describe("Classes directory URL view state", () => {
  it("parses valid values and falls back to the existing defaults for invalid values", () => {
    expect(parseClassDirectoryViewState(new URLSearchParams("search=Toán&year=2025-2026&grade=7&level=A&mode=offline&status=active&page=3"), years)).toEqual({ filters: { search: "Toán", year: "2025-2026", grade: "7", level: "A", mode: "offline", status: "active" }, page: 3 });
    expect(parseClassDirectoryViewState(new URLSearchParams("year=missing&grade=13&level=X&mode=x&status=x&page=0"), years)).toEqual({ filters: defaultClassFilters, page: 1 });
  });

  it("preserves unrelated params and removes only Classes-owned view state on reset", () => {
    const params = new URLSearchParams("notice=created&status=active&page=4");
    expect(serializeClassDirectoryViewState(params, { filters: { ...defaultClassFilters, search: "Toán" }, page: 1 }).toString()).toBe("notice=created&search=To%C3%A1n");
    expect(getClassDirectoryHref(params, resetClassDirectoryViewState())).toBe("/classes?notice=created");
  });

  it("composes rapid filter updates in either order before navigation settles", () => {
    const statusThenGrade = mergePendingClassDirectoryFilter(mergePendingClassDirectoryFilter(null, defaultClassFilters, "status", "active"), defaultClassFilters, "grade", "7");
    const gradeThenStatus = mergePendingClassDirectoryFilter(mergePendingClassDirectoryFilter(null, defaultClassFilters, "grade", "7"), defaultClassFilters, "status", "active");
    expect(statusThenGrade).toMatchObject({ status: "active", grade: "7" });
    expect(gradeThenStatus).toMatchObject({ status: "active", grade: "7" });
  });

  it("retains the pre-existing Vietnamese-insensitive matching and clamps pages", () => {
    expect(filterClasses([classItem], { ...defaultClassFilters, search: "toan" })).toEqual([classItem]);
    expect(paginateClasses([classItem], 100)).toMatchObject({ page: 1, pageCount: 1, start: 1, end: 1 });
  });
});
