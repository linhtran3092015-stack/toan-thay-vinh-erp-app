import { describe, expect, it } from "vitest";

import { defaultSessionFilters, filterSessions, paginateSessions } from "@/features/sessions/session-filters";
import { getSessionDirectoryHref, getSessionDirectoryQuery, mergePendingSessionDirectoryFilter, parseSessionAttendanceFilter, parseSessionDirectoryViewState, resetSessionDirectoryViewState, serializeSessionAttendanceFilter, serializeSessionDirectoryViewState } from "@/features/sessions/session-directory-url-state";
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

// Value: protects=the /dev/lists preview writes its own path (keeping its view param) instead of the production-backed /sessions, while the default stays /sessions;
// fails_when=the path argument is ignored, drops the unrelated params, or the default changes; why_new=review fix (basePath); seam=none; no_claim=does not render the page
describe("Sessions directory href path", () => {
  it("builds the href on the given path and defaults to /sessions", () => {
    const state = { filters: { ...defaultSessionFilters, dateFrom: "2026-10-12", dateTo: "2026-10-18" }, page: 1 };
    expect(getSessionDirectoryHref(new URLSearchParams("view=sessions"), state, "all", "/dev/lists")).toBe("/dev/lists?view=sessions&from=2026-10-12&to=2026-10-18");
    expect(getSessionDirectoryHref(new URLSearchParams(), resetSessionDirectoryViewState(), "all", "/dev/lists")).toBe("/dev/lists");
    expect(getSessionDirectoryHref(new URLSearchParams("view=sessions"), state)).toBe("/sessions?view=sessions&from=2026-10-12&to=2026-10-18");
  });
});

// Value: protects=the design 16b "Chưa điểm danh" chip survives reloads, Back and the detail/new/batch back links through the owned `attendance=missing` param, while the seven-key filters object and every pinned string above stay as they were;
// fails_when=attendance leaks into SessionDirectoryFiltersState, an unknown value is kept, the default state writes the param, or getSessionDirectoryQuery drops it from the return context;
// why_new=step 14a adds the param; seam=none; no_claim=does not render the page
describe("Sessions directory attendance param (design 16b)", () => {
  it("parses only attendance=missing and keeps it out of the seven filter keys", () => {
    expect(parseSessionAttendanceFilter(new URLSearchParams("attendance=missing"))).toBe("missing");
    expect(parseSessionAttendanceFilter(new URLSearchParams("attendance=all"))).toBe("all");
    expect(parseSessionAttendanceFilter(new URLSearchParams("attendance=bogus"))).toBe("all");
    expect(parseSessionAttendanceFilter(new URLSearchParams(""))).toBe("all");
    expect(parseSessionDirectoryViewState(new URLSearchParams("attendance=missing&status=scheduled"), [])).toEqual({ filters: { ...defaultSessionFilters, status: "scheduled" }, page: 1 });
  });

  it("serializes it as an owned param in place of the old value", () => {
    const params = new URLSearchParams("notice=created&attendance=missing&page=2");
    expect(serializeSessionDirectoryViewState(params, resetSessionDirectoryViewState()).toString()).toBe("notice=created");
    expect(serializeSessionDirectoryViewState(params, { filters: { ...defaultSessionFilters, dateFrom: "2026-10-12", dateTo: "2026-10-18" }, page: 3 }, "missing").toString()).toBe("notice=created&from=2026-10-12&to=2026-10-18&attendance=missing&page=3");
    expect(getSessionDirectoryHref(new URLSearchParams(), resetSessionDirectoryViewState(), "missing")).toBe("/sessions?attendance=missing");
    expect(serializeSessionAttendanceFilter(new URLSearchParams("attendance=missing&kind=regular"), "all").toString()).toBe("kind=regular");
  });

  it("round-trips it through the safe return context, dropping unknown values", () => {
    expect(getSessionDirectoryQuery(new URLSearchParams("notice=created&attendance=missing&status=scheduled"))).toBe("status=scheduled&attendance=missing");
    expect(getSessionDirectoryQuery(new URLSearchParams("attendance=everything&lock=unlocked"))).toBe("lock=unlocked");
    const query = getSessionDirectoryQuery(serializeSessionDirectoryViewState(new URLSearchParams(), { filters: { ...defaultSessionFilters, lock: "unlocked" }, page: 1 }, "missing"));
    expect(parseSessionAttendanceFilter(new URLSearchParams(query))).toBe("missing");
    expect(parseSessionDirectoryViewState(new URLSearchParams(query), []).filters.lock).toBe("unlocked");
  });
});
