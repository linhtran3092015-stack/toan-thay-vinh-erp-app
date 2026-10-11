import { describe, expect, it } from "vitest";

import { defaultSessionFilters, filterSessions, paginateSessions } from "@/features/sessions/session-filters";
import { getSessionDirectoryHref, getSessionDirectoryQuery, mergePendingSessionDirectoryFilter, parseSessionDirectoryViewState, resetSessionDirectoryViewState, serializeSessionDirectoryViewState } from "@/features/sessions/session-directory-url-state";
import type { SessionDirectoryItem } from "@/features/sessions/read-models";

const session: SessionDirectoryItem = { attendanceCount: 1, classCode: "7A", classId: "class-1", className: "Toán 7A", componentCode: "MATH-01", endTime: "18:30:00", grade: 7, id: "session-1", learningMode: "offline", level: "A", lockedAt: null, resultCount: 1, roomName: "P3", sessionDate: "2026-08-10", sessionKind: "regular", startTime: "17:00:00", status: "scheduled" };

describe("Sessions directory URL view state", () => {
  it("parses valid values and uses existing defaults for invalid values", () => {
    expect(parseSessionDirectoryViewState(new URLSearchParams("search=Toán&class=class-1&status=scheduled&kind=regular&lock=unlocked&from=2026-08-01&to=2026-08-31&page=3"), ["class-1"])).toEqual({ filters: { search: "Toán", classId: "class-1", status: "scheduled", kind: "regular", lock: "unlocked", dateFrom: "2026-08-01", dateTo: "2026-08-31" }, page: 3 });
    expect(parseSessionDirectoryViewState(new URLSearchParams("class=other&status=invalid&kind=invalid&from=bad&to=bad&page=0"), ["class-1"])).toEqual({ filters: defaultSessionFilters, page: 1 });
  });

  it("accepts real calendar dates, including leap days, and rejects impossible dates", () => {
    expect(parseSessionDirectoryViewState(new URLSearchParams("from=2026-02-28&to=2024-02-29"), [])).toMatchObject({ filters: { dateFrom: "2026-02-28", dateTo: "2024-02-29" } });

    for (const value of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-2-8", "not-a-date"]) {
      expect(parseSessionDirectoryViewState(new URLSearchParams(`from=${value}&to=${value}`), [])).toMatchObject({ filters: { dateFrom: "", dateTo: "" } });
    }
  });

  it("preserves unrelated params and removes only Sessions-owned state on reset", () => {
    const params = new URLSearchParams("notice=created&status=scheduled&page=4");
    expect(serializeSessionDirectoryViewState(params, { filters: { ...defaultSessionFilters, search: "Toán" }, page: 1 }).toString()).toBe("notice=created&search=To%C3%A1n");
    expect(getSessionDirectoryHref(params, resetSessionDirectoryViewState())).toBe("/sessions?notice=created");
  });

  it("does not serialize impossible dates into directory or safe return context", () => {
    const invalidState = { filters: { ...defaultSessionFilters, dateFrom: "2026-02-30", dateTo: "2026-13-01" }, page: 1 };
    expect(serializeSessionDirectoryViewState(new URLSearchParams("notice=created"), invalidState).toString()).toBe("notice=created");
    expect(getSessionDirectoryQuery(new URLSearchParams("notice=created&from=2026-02-30&to=2026-13-01&status=scheduled"))).toBe("status=scheduled");
  });

  it("composes rapid filter changes in either order", () => {
    const statusThenClass = mergePendingSessionDirectoryFilter(mergePendingSessionDirectoryFilter(null, defaultSessionFilters, "status", "scheduled"), defaultSessionFilters, "classId", "class-1");
    const classThenStatus = mergePendingSessionDirectoryFilter(mergePendingSessionDirectoryFilter(null, defaultSessionFilters, "classId", "class-1"), defaultSessionFilters, "status", "scheduled");
    expect(statusThenClass).toMatchObject({ classId: "class-1", status: "scheduled" });
    expect(classThenStatus).toMatchObject({ classId: "class-1", status: "scheduled" });
  });

  it("retains Vietnamese-insensitive matching, date behavior, and page clamping", () => {
    expect(filterSessions([session], { ...defaultSessionFilters, search: "toan", dateFrom: "2026-08-11" })).toEqual([]);
    expect(filterSessions([session], { ...defaultSessionFilters, dateFrom: "2026-09-01", dateTo: "2026-08-01" })).toEqual([]);
    expect(paginateSessions([session], 99)).toMatchObject({ page: 1, pageCount: 1, start: 1, end: 1 });
  });
});
