// Value: protects=the /sessions (design 16b) chips, readiness badges, x/y cells and row actions only claim what the data says: "Sẵn sàng khóa"/"Khóa" only from a lockable queue item, Điểm danh as the lock rule (roster − missing)/roster and never attendance_count, "Chưa điểm danh" by the dashboard rule in Vietnam time, a Tuần này range equal to the dashboard week, a reload notice when the requested range is outside the loaded window, a chip number only when that chip's range was loaded in full, "Chờ khóa" and "Chưa điểm danh" ending at today so the lock-queue panel and dashboard links press them (and their undated URLs, the digest notification's, too), and no "Chưa điểm danh" number while the lock queue is failed or misses a completed, unlocked row;
// fails_when=a completed row without a queue item reads "Sẵn sàng khóa", a walk-in-inflated count becomes the numerator, a scheduled session past its end offers "Điểm danh" (marking needs a started session), a chip combo is mislabelled, chip counts drift from what the chip shows, a range older than the 300-row window passes as complete, a chip that drops a bounded range keeps its partial number, a failed/partial queue still yields a "Chưa điểm danh" count, or a `…&to=<today>` or undated digest landing presses no chip;
// why_new=step 14a adds these pure helpers (session-directory-models.ts); seam=none; no_claim=does not prove the queue RPC or the loader return these rows
import { describe, expect, it } from "vitest";

import { getWeekRange } from "@/features/dashboard/home-models";
import type { SessionDirectoryItem } from "@/features/sessions/read-models";
import {
  applySessionDirectoryFilters,
  applySessionQuickFilter,
  countSessionQuickFilters,
  createSessionQueueMap,
  deriveSessionQuickFilter,
  formatSessionClassCaption,
  formatSessionCompactDate,
  formatSessionCountCell,
  formatSessionDateTime,
  formatSessionModeRoom,
  getSessionAttendanceCell,
  getSessionLockReadiness,
  getSessionLockReadinessLabel,
  getSessionOverdueCaption,
  getSessionResultCell,
  getSessionRowAction,
  getSessionWeekLabel,
  getSessionWeekRange,
  getSessionWindowNotice,
  hasUnknownSessionQueueFacts,
  isSessionAttendanceCountKnown,
  isSessionQuickFilterCountComplete,
  needsSessionAttendance,
  sessionQuickFilters,
  type SessionDirectoryClock,
  type SessionQuickFilter,
} from "@/features/sessions/session-directory-models";
import { defaultSessionFilters } from "@/features/sessions/session-filters";

const base: SessionDirectoryItem = { attendanceCount: 0, classCode: "7A", classId: "class-1", className: "Toán 7A", componentCode: null, endTime: "10:00:00", grade: 7, id: "s-base", learningMode: "offline", level: "A", lockedAt: null, resultCount: 0, roomName: "P.102", sessionDate: "2026-10-12", sessionKind: "regular", startTime: "08:00:00", status: "scheduled" };
const row = (patch: Partial<SessionDirectoryItem>): SessionDirectoryItem => ({ ...base, ...patch });

/** Friday 16/10/2026, 12:00 in Vietnam. */
const today = "2026-10-16";
const queue = createSessionQueueMap([
  { id: "ready", missingAttendanceCount: 0, rosterCount: 15 },
  { id: "missing", missingAttendanceCount: 3, rosterCount: 24 },
  { id: "empty", missingAttendanceCount: 0, rosterCount: 0 },
]);
const clock: SessionDirectoryClock = { nowTime: "12:00:00", queue, today };

describe("Sessions directory week range and labels", () => {
  it("returns the dashboard's Monday–Sunday week for every weekday and across month and year edges", () => {
    for (const date of ["2026-10-12", "2026-10-16", "2026-10-18", "2026-10-01", "2026-03-01", "2025-12-31", "2026-01-04", "2024-02-29"]) {
      const dashboard = getWeekRange(date);
      expect(getSessionWeekRange(date)).toEqual({ from: dashboard.weekStart, to: dashboard.weekEnd });
    }
    expect(getSessionWeekRange("2026-10-16")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
  });

  it("labels only an exact Monday–Sunday range, in the design 16b form", () => {
    expect(getSessionWeekLabel("2026-10-12", "2026-10-18")).toBe("Tuần 12–18/10/2026");
    expect(getSessionWeekLabel("2026-09-28", "2026-10-04")).toBe("Tuần 28/09–04/10/2026");
    expect(getSessionWeekLabel("2025-12-29", "2026-01-04")).toBe("Tuần 29/12/2025–04/01/2026");
    expect(getSessionWeekLabel("2026-10-13", "2026-10-19")).toBeNull();
    expect(getSessionWeekLabel("2026-10-12", "2026-10-17")).toBeNull();
    expect(getSessionWeekLabel("", "")).toBeNull();
  });

  it("formats the compact date-time and the mode · room cell", () => {
    expect(formatSessionCompactDate("2026-10-12")).toBe("T2 12/10");
    expect(formatSessionCompactDate("2026-10-18")).toBe("CN 18/10");
    expect(formatSessionDateTime(base)).toBe("T2 12/10 · 08:00–10:00");
    expect(formatSessionModeRoom(base)).toBe("Offline · P.102");
    expect(formatSessionModeRoom(row({ learningMode: "hybrid", roomName: "P.101" }))).toBe("Kết hợp · P.101");
    expect(formatSessionModeRoom(row({ hasMeetingUrl: true, learningMode: "online", roomName: null }))).toBe("Online · có link");
    expect(formatSessionModeRoom(row({ hasMeetingUrl: false, learningMode: "online", roomName: null }))).toBe("Online");
    expect(formatSessionModeRoom(row({ learningMode: "online", roomName: null }))).toBe("Online");
    expect(formatSessionModeRoom(row({ roomName: null }))).toBe("Offline");
    expect(formatSessionClassCaption(base)).toBe("K7 · A");
    expect(formatSessionClassCaption(row({ componentCode: "MATH-01", grade: 9, level: "CLC" }))).toBe("K9 · CLC · MATH-01");
  });
});

describe("Sessions directory readiness and attendance rule", () => {
  it("derives readiness from a queue item only, for completed unlocked rows", () => {
    expect(getSessionLockReadiness(row({ id: "ready", status: "completed" }), queue)).toEqual({ kind: "ready" });
    expect(getSessionLockReadiness(row({ id: "missing", status: "completed" }), queue)).toEqual({ kind: "missing", missing: 3 });
    expect(getSessionLockReadiness(row({ id: "empty", status: "completed" }), queue)).toEqual({ kind: "no_roster" });
    expect(getSessionLockReadiness(row({ id: "not-in-queue", status: "completed" }), queue)).toBeNull();
    expect(getSessionLockReadiness(row({ id: "ready", lockedAt: "2026-10-13T00:00:00Z", status: "completed" }), queue)).toBeNull();
    expect(getSessionLockReadiness(row({ id: "ready", status: "in_progress" }), queue)).toBeNull();
    // "Chờ khóa" is the chip for every completed, unlocked session; the lockable row says "Sẵn sàng khóa" (as the queue panel).
    expect(getSessionLockReadinessLabel({ kind: "ready" })).toEqual({ label: "Sẵn sàng khóa", tone: "info" });
    expect(getSessionLockReadinessLabel({ kind: "missing", missing: 3 })).toEqual({ label: "Thiếu 3 điểm danh", tone: "warning" });
    expect(getSessionLockReadinessLabel({ kind: "no_roster" })).toEqual({ label: "Không có học sinh", tone: "neutral" });
  });

  it("flags missing attendance by the dashboard rule in Vietnam time", () => {
    expect(needsSessionAttendance(row({ id: "missing", status: "completed" }), clock)).toBe(true);
    expect(needsSessionAttendance(row({ id: "ready", status: "completed" }), clock)).toBe(false);
    expect(needsSessionAttendance(row({ id: "not-in-queue", status: "completed" }), clock)).toBe(false);
    expect(needsSessionAttendance(row({ sessionDate: "2026-10-15", status: "scheduled" }), clock)).toBe(true);
    expect(needsSessionAttendance(row({ sessionDate: "2026-10-15", status: "in_progress" }), clock)).toBe(true);
    // Today: 08:00–10:00 has ended at 12:00; 13:30–16:30 has not.
    expect(needsSessionAttendance(row({ sessionDate: today, status: "scheduled" }), clock)).toBe(true);
    expect(needsSessionAttendance(row({ endTime: "16:30:00", sessionDate: today, startTime: "13:30:00", status: "in_progress" }), clock)).toBe(false);
    expect(needsSessionAttendance(row({ sessionDate: "2026-10-20", status: "scheduled" }), clock)).toBe(false);
    expect(needsSessionAttendance(row({ sessionDate: "2026-10-15", status: "cancelled" }), clock)).toBe(false);
    expect(getSessionOverdueCaption(row({ sessionDate: "2026-10-15", status: "scheduled" }), today, "12:00:00")).toBe("Chưa bắt đầu");
    expect(getSessionOverdueCaption(row({ sessionDate: "2026-10-15", status: "in_progress" }), today, "12:00:00")).toBe("Chưa hoàn thành");
    expect(getSessionOverdueCaption(row({ sessionDate: "2026-10-20", status: "scheduled" }), today, "12:00:00")).toBeNull();
  });
});

describe("Sessions directory count cells (D4)", () => {
  it("shows y/y for locked rows, the lock rule for queued rows and x only otherwise", () => {
    expect(getSessionAttendanceCell(row({ status: "scheduled" }), queue)).toEqual({ kind: "dash" });
    expect(getSessionAttendanceCell(row({ status: "cancelled" }), queue)).toEqual({ kind: "dash" });
    expect(getSessionAttendanceCell({ ...row({ lockedAt: "2026-10-13T00:00:00Z", status: "completed" }), markedRosterCount: 16 }, queue)).toEqual({ incomplete: false, kind: "ratio", total: 16, value: 16 });
    // attendanceCount (walk-ins included) is never the numerator.
    expect(getSessionAttendanceCell({ ...row({ attendanceCount: 30, id: "missing", status: "completed" }), markedRosterCount: 21 }, queue)).toEqual({ incomplete: true, kind: "ratio", total: 24, value: 21 });
    expect(getSessionAttendanceCell({ ...row({ id: "empty", status: "completed" }), markedRosterCount: 0 }, queue)).toEqual({ kind: "dash", reason: "Không có học sinh trong danh sách" });
    expect(getSessionAttendanceCell({ ...row({ id: "not-in-queue", status: "completed" }), markedRosterCount: 12 }, queue)).toEqual({ kind: "recorded", value: 12 });
    expect(getSessionAttendanceCell({ ...row({ status: "in_progress" }), markedRosterCount: 13 }, queue)).toEqual({ kind: "recorded", value: 13 });
    expect(getSessionAttendanceCell(row({ lockedAt: "2026-10-13T00:00:00Z", status: "completed" }), queue)).toEqual({ kind: "dash", reason: "Chưa tải được điểm danh" });
    expect(formatSessionCountCell({ kind: "recorded", value: 13 })).toBe("13 đã ghi");
    expect(formatSessionCountCell({ incomplete: true, kind: "ratio", total: 24, value: 21 })).toBe("21/24");
  });

  it("divides results by present plus additional study only when attendance is visible", () => {
    const completed = { ...row({ resultCount: 4, status: "completed" }), resultEligibleCount: 13 };
    expect(getSessionResultCell(completed, true)).toEqual({ incomplete: false, kind: "ratio", total: 13, value: 4 });
    expect(getSessionResultCell(completed, false)).toEqual({ kind: "count", value: 4 });
    expect(getSessionResultCell(row({ resultCount: 4, status: "completed" }), true)).toEqual({ kind: "count", value: 4 });
    expect(getSessionResultCell(row({ status: "scheduled" }), true)).toEqual({ kind: "dash" });
    expect(getSessionResultCell(row({ status: "cancelled" }), true)).toEqual({ kind: "dash" });
  });
});

describe("Sessions directory row action (D8)", () => {
  const can = { canLock: true, canMarkAttendance: true };

  it("offers Khóa only for a lockable queue item and Điểm danh only on a started session", () => {
    expect(getSessionRowAction(row({ id: "ready", status: "completed" }), clock, can)).toBe("lock");
    expect(getSessionRowAction(row({ id: "ready", status: "completed" }), clock, { ...can, canLock: false })).toBe("open");
    expect(getSessionRowAction(row({ id: "missing", status: "completed" }), clock, can)).toBe("attendance");
    expect(getSessionRowAction(row({ id: "missing", status: "completed" }), clock, { ...can, canMarkAttendance: false })).toBe("open");
    expect(getSessionRowAction(row({ id: "empty", status: "completed" }), clock, can)).toBe("open");
    expect(getSessionRowAction(row({ id: "not-in-queue", status: "completed" }), clock, can)).toBe("open");
    expect(getSessionRowAction(row({ sessionDate: "2026-10-15", status: "in_progress" }), clock, can)).toBe("attendance");
    // Past its end but never started: the session page has to start it first.
    expect(getSessionRowAction(row({ sessionDate: "2026-10-15", status: "scheduled" }), clock, can)).toBe("open");
  });
});

describe("Sessions directory quick filters (D2)", () => {
  const rows: SessionDirectoryItem[] = [
    row({ id: "today-scheduled", sessionDate: today, startTime: "18:00:00", endTime: "20:00:00" }),
    row({ id: "today-overdue", sessionDate: today }),
    row({ id: "missing", sessionDate: "2026-10-14", status: "completed" }),
    row({ id: "ready", sessionDate: "2026-10-13", status: "completed" }),
    row({ id: "locked", lockedAt: "2026-10-12T12:00:00Z", sessionDate: "2026-10-12", status: "completed" }),
    row({ id: "cancelled", sessionDate: "2026-10-12", status: "cancelled" }),
    row({ id: "older", lockedAt: "2026-10-06T12:00:00Z", sessionDate: "2026-10-05", status: "completed" }),
    row({ classCode: "8B", classId: "class-2", id: "other-class", sessionDate: "2026-10-20" }),
  ];

  it("writes each chip's state and maps it back to the same chip", () => {
    for (const chip of sessionQuickFilters) {
      const next = applySessionQuickFilter({ ...defaultSessionFilters, kind: "regular", search: "Toán" }, chip, today);
      expect(next.filters).toMatchObject({ kind: "regular", search: "Toán" });
      expect(deriveSessionQuickFilter(next.filters, next.attendance, today)).toBe(chip);
    }
    expect(applySessionQuickFilter(defaultSessionFilters, "week", today).filters).toMatchObject({ dateFrom: "2026-10-12", dateTo: "2026-10-18" });
    // Both sets are on or before today by definition, so both chips end their range at today.
    expect(applySessionQuickFilter(defaultSessionFilters, "pending_lock", today).filters).toMatchObject({ dateFrom: "", dateTo: today, lock: "unlocked", status: "completed" });
    expect(applySessionQuickFilter(defaultSessionFilters, "missing", today)).toEqual({ attendance: "missing", filters: { ...defaultSessionFilters, dateTo: today } });
    expect(applySessionQuickFilter({ ...defaultSessionFilters, dateFrom: "2026-10-12", dateTo: "2026-10-18", status: "scheduled" }, "all", today).filters).toEqual(defaultSessionFilters);
  });

  it("presses no chip for combinations outside the chip set", () => {
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, lock: "unlocked", dateTo: today }, "all", today)).toBeNull();
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, status: "completed" }, "all", today)).toBeNull();
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, status: "cancelled" }, "missing", today)).toBeNull();
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, dateFrom: "2026-10-05", dateTo: "2026-10-11" }, "all", today)).toBeNull();
  });

  it("presses Chờ khóa and Chưa điểm danh on the lock-queue panel and dashboard links (one URL per chip)", () => {
    // `/sessions?status=completed&lock=unlocked&to=<today>`: the panel's "Lọc danh sách" and the dashboard's awaiting-lock item.
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, dateTo: today, lock: "unlocked", status: "completed" }, "all", today)).toBe("pending_lock");
    // `/sessions?attendance=missing&to=<today>`: the dashboard's unmarked item.
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, dateTo: today }, "missing", today)).toBe("missing");
    // A link from an earlier day is a plain date filter, not the chip.
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, dateTo: "2026-10-15" }, "missing", today)).toBeNull();
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, dateTo: "2026-10-15", lock: "unlocked", status: "completed" }, "all", today)).toBeNull();
  });

  it("presses Chờ khóa and Chưa điểm danh on their undated URLs too (both sets end at today)", () => {
    // `/sessions?status=completed&lock=unlocked`: the stored lock-queue digest notifications (no `to`).
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, lock: "unlocked", status: "completed" }, "all", today)).toBe("pending_lock");
    // `/sessions?attendance=missing`.
    expect(deriveSessionQuickFilter(defaultSessionFilters, "missing", today)).toBe("missing");
    // Only the undated variant: a start date is still a plain date filter.
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, dateFrom: "2026-10-01", lock: "unlocked", status: "completed" }, "all", today)).toBeNull();
    expect(deriveSessionQuickFilter({ ...defaultSessionFilters, dateFrom: "2026-10-01" }, "missing", today)).toBeNull();
    // Pressing the chip still writes the bounded state.
    expect(applySessionQuickFilter({ ...defaultSessionFilters, lock: "unlocked", status: "completed" }, "pending_lock", today).filters).toMatchObject({ dateTo: today });
  });

  it("counts what each chip would show over the loaded rows, keeping search, class and kind", () => {
    expect(countSessionQuickFilters(rows, defaultSessionFilters, clock)).toEqual({ all: 8, cancelled: 1, locked: 2, missing: 2, pending_lock: 2, today: 2, week: 6 });
    expect(countSessionQuickFilters(rows, { ...defaultSessionFilters, classId: "class-2", status: "cancelled" }, clock)).toEqual({ all: 1, cancelled: 0, locked: 0, missing: 0, pending_lock: 0, today: 0, week: 0 });
    expect(applySessionDirectoryFilters(rows, defaultSessionFilters, "missing", clock).map((item) => item.id)).toEqual(["today-overdue", "missing"]);
  });
});

describe("Sessions directory loaded window (D3)", () => {
  const window300 = Array.from({ length: 300 }, (_, index) => ({ sessionDate: index < 150 ? "2026-11-02" : "2026-10-20" }));

  it("says when the newest-300 window was cut and when a range needs a reload", () => {
    const unbounded = { limit: 300, loadedFrom: null, loadedTo: null };
    expect(getSessionWindowNotice({ ...unbounded, requestedFrom: "", requestedTo: "", sessions: window300 })).toBe("truncated");
    expect(getSessionWindowNotice({ ...unbounded, requestedFrom: "", requestedTo: "", sessions: window300.slice(0, 12) })).toBe("complete");
    // Dates after the oldest loaded date are complete; the oldest date itself may be cut.
    expect(getSessionWindowNotice({ ...unbounded, requestedFrom: "2026-10-21", requestedTo: "2026-11-08", sessions: window300 })).toBe("complete");
    expect(getSessionWindowNotice({ ...unbounded, requestedFrom: "2026-10-20", requestedTo: "2026-11-08", sessions: window300 })).toBe("reload");
    expect(getSessionWindowNotice({ ...unbounded, requestedFrom: "2026-10-12", requestedTo: "2026-10-18", sessions: window300 })).toBe("reload");
    expect(getSessionWindowNotice({ ...unbounded, requestedFrom: "2026-10-12", requestedTo: "2026-10-18", sessions: window300.slice(0, 12) })).toBe("complete");
  });

  it("treats a server-bounded week as complete and anything wider as a reload", () => {
    const week = { limit: 300, loadedFrom: "2026-10-12", loadedTo: "2026-10-18", sessions: [{ sessionDate: "2026-10-12" }] };
    expect(getSessionWindowNotice({ ...week, requestedFrom: "2026-10-12", requestedTo: "2026-10-18" })).toBe("complete");
    expect(getSessionWindowNotice({ ...week, requestedFrom: "2026-10-16", requestedTo: "2026-10-16" })).toBe("complete");
    expect(getSessionWindowNotice({ ...week, requestedFrom: "", requestedTo: "" })).toBe("reload");
    expect(getSessionWindowNotice({ ...week, requestedFrom: "2026-10-05", requestedTo: "2026-10-18" })).toBe("reload");
    expect(getSessionWindowNotice({ ...week, requestedFrom: "2026-10-12", requestedTo: "2026-10-18", sessions: window300 })).toBe("truncated");
  });
});

describe("Sessions directory chip completeness and queue status (review fixes)", () => {
  const rows: SessionDirectoryItem[] = [
    row({ id: "today", sessionDate: today }),
    row({ id: "ready", sessionDate: "2026-10-14", status: "completed" }),
    row({ id: "missing", sessionDate: "2026-10-13", status: "completed" }),
    row({ id: "unqueued", sessionDate: "2026-10-12", status: "completed" }),
    row({ id: "locked", lockedAt: "2026-10-12T12:00:00Z", sessionDate: "2026-10-12", status: "completed" }),
  ];
  const complete = (chip: SessionQuickFilter, options: { clock?: SessionDirectoryClock; loadedFrom?: string | null; loadedTo?: string | null; sessions?: SessionDirectoryItem[] } = {}) =>
    isSessionQuickFilterCountComplete(chip, {
      clock: options.clock ?? clock,
      filters: defaultSessionFilters,
      loaded: { limit: 300, loadedFrom: options.loadedFrom ?? null, loadedTo: options.loadedTo ?? null },
      sessions: options.sessions ?? rows,
    });
  const completeChips = (options?: Parameters<typeof complete>[1]) => sessionQuickFilters.filter((chip) => complete(chip, options));

  it("counts every chip when the unbounded window was not cut", () => {
    expect(completeChips()).toEqual([...sessionQuickFilters]);
  });

  it("counts only the chips inside a server-bounded range", () => {
    expect(completeChips({ loadedFrom: "2026-10-12", loadedTo: "2026-10-18" })).toEqual(["today", "week"]);
    // A `to=<today>` landing (panel or dashboard link): Chờ khóa and Chưa điểm danh cover (…, today], as does Hôm nay.
    expect(completeChips({ loadedFrom: null, loadedTo: today })).toEqual(["today", "missing", "pending_lock"]);
    // Today is outside the loaded range: nothing is a full count.
    expect(completeChips({ loadedFrom: "2026-10-05", loadedTo: "2026-10-11" })).toEqual([]);
  });

  it("counts only the chips after the oldest loaded date when the newest-300 window was cut", () => {
    const cut = Array.from({ length: 300 }, (_, index) => row({ id: `cut-${index}`, sessionDate: index < 150 ? "2026-10-20" : "2026-10-13" }));
    // Oldest loaded date 13/10: today (16/10) is complete, the week from 12/10 is not.
    expect(completeChips({ sessions: cut })).toEqual(["today"]);
    const older = Array.from({ length: 300 }, (_, index) => row({ id: `older-${index}`, sessionDate: index < 150 ? "2026-10-20" : "2026-10-08" }));
    expect(completeChips({ sessions: older })).toEqual(["today", "week"]);
  });

  it("drops the Chưa điểm danh count while the queue failed, or when a full queue misses a completed, unlocked row", () => {
    const failed: SessionDirectoryClock = { ...clock, queue: createSessionQueueMap(undefined), queueStatus: "failed" };
    expect(completeChips({ clock: failed })).toEqual(sessionQuickFilters.filter((chip) => chip !== "missing"));
    expect(isSessionAttendanceCountKnown([], failed)).toBe(false);

    const partial: SessionDirectoryClock = { ...clock, queueStatus: "partial" };
    // "unqueued" is completed, unlocked and has no item in the full page.
    expect(hasUnknownSessionQueueFacts(rows[3], partial)).toBe(true);
    expect(hasUnknownSessionQueueFacts(rows[4], partial)).toBe(false);
    expect(hasUnknownSessionQueueFacts(rows[3], clock)).toBe(false);
    expect(complete("missing", { clock: partial })).toBe(false);
    expect(complete("missing", { clock: partial, sessions: rows.filter((item) => item.id !== "unqueued") })).toBe(true);
    // With the queue ok, a row outside it is simply not waiting: the count stands.
    expect(complete("missing")).toBe(true);
    expect(isSessionAttendanceCountKnown(rows, clock)).toBe(true);
  });
});
