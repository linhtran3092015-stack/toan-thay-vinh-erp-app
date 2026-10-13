// Value: protects=the class workspace numbers (session ordinals, stage counts, next session, lock-mirroring attendance tallies, attendance rate, chart flags, absence streaks, debt totals, header schedule summary);
// fails_when=cancelled sessions take an ordinal, a past scheduled session counts as upcoming, a walk-in or an additional_study roster student counts as recorded, a present mark stops ending a streak, the low bar is flagged when several bars tie, or a mixed-time schedule collapses into one time;
// why_new=design 03 introduced these pure helpers with no prior coverage;
// seam=pure functions only; no_claim=does not prove the Supabase queries return these shapes
import { describe, expect, it } from "vitest";

import { formatScheduleSummary } from "@/features/classes/class-detail-page";
import {
  countClassSessionFilters,
  findAbsenceStreaks,
  findNextClassSession,
  getAttendanceChart,
  getClassAttendanceRate,
  getClassSessionStage,
  orderClassSessions,
  summarizeClassDebt,
  summarizeClassSessions,
  tallyClassSessionAttendance,
  type ClassSessionRow,
} from "@/features/classes/detail/class-detail-models";
import type { ClassScheduleReadModel } from "@/features/classes/read-models";

const TODAY = "2026-10-13";

function session(overrides: Partial<ClassSessionRow> & Pick<ClassSessionRow, "id" | "sessionDate">): ClassSessionRow {
  return {
    attendance: null,
    classCode: "L-9A26",
    classId: "class-1",
    componentCode: null,
    endTime: "21:30:00",
    learningMode: "offline",
    lockedAt: null,
    ordinal: null,
    resultCount: null,
    roomName: "P.101",
    rosterCount: null,
    sessionKind: "regular",
    startTime: "19:30:00",
    status: "scheduled",
    ...overrides,
  };
}

describe("orderClassSessions", () => {
  it("sorts by date and time and numbers only non-cancelled sessions", () => {
    const rows = orderClassSessions([
      session({ id: "c", sessionDate: "2026-10-05" }),
      session({ id: "a", sessionDate: "2026-10-01", startTime: "19:30:00" }),
      session({ id: "x", sessionDate: "2026-10-03", status: "cancelled" }),
      session({ id: "b", sessionDate: "2026-10-01", startTime: "08:00:00" }),
    ]);

    expect(rows.map((row) => [row.id, row.ordinal])).toEqual([
      ["b", 1],
      ["a", 2],
      ["x", null],
      ["c", 3],
    ]);
  });
});

describe("getClassSessionStage", () => {
  it("maps status, lock and date to the team's stage", () => {
    expect(getClassSessionStage({ lockedAt: null, sessionDate: TODAY, status: "scheduled" }, TODAY)).toBe("upcoming");
    expect(getClassSessionStage({ lockedAt: null, sessionDate: "2026-10-12", status: "scheduled" }, TODAY)).toBe("overdue");
    expect(getClassSessionStage({ lockedAt: null, sessionDate: TODAY, status: "in_progress" }, TODAY)).toBe("live");
    expect(getClassSessionStage({ lockedAt: null, sessionDate: "2026-10-12", status: "completed" }, TODAY)).toBe("pending_lock");
    expect(getClassSessionStage({ lockedAt: "2026-10-12T15:00:00Z", sessionDate: "2026-10-12", status: "completed" }, TODAY)).toBe("locked");
    expect(getClassSessionStage({ lockedAt: null, sessionDate: "2026-10-20", status: "cancelled" }, TODAY)).toBe("cancelled");
  });
});

describe("summarizeClassSessions and countClassSessionFilters", () => {
  const rows = [
    session({ id: "1", lockedAt: "x", sessionDate: "2026-10-01", status: "completed" }),
    session({ id: "2", sessionDate: "2026-10-05", status: "completed" }),
    session({ id: "3", sessionDate: "2026-10-12", status: "scheduled" }),
    session({ id: "4", sessionDate: TODAY, status: "in_progress" }),
    session({ id: "5", sessionDate: "2026-10-15", status: "scheduled" }),
    session({ id: "6", sessionDate: "2026-10-16", status: "cancelled" }),
  ];

  it("counts non-cancelled sessions by stage", () => {
    expect(summarizeClassSessions(rows, TODAY)).toEqual({
      cancelled: 1,
      completed: 2,
      locked: 1,
      overdue: 1,
      pendingLock: 1,
      total: 5,
      upcoming: 2,
    });
  });

  it("gives each chip its count; overdue sessions only appear under all", () => {
    expect(countClassSessionFilters(rows, TODAY)).toEqual({ all: 6, cancelled: 1, locked: 1, pending_lock: 1, upcoming: 2 });
  });
});

describe("findNextClassSession", () => {
  it("prefers a session in progress", () => {
    const rows = [
      session({ id: "later", sessionDate: "2026-10-15" }),
      session({ id: "live", sessionDate: "2026-10-12", status: "in_progress" }),
    ];

    expect(findNextClassSession(rows, TODAY, "10:00")?.id).toBe("live");
  });

  it("skips a session that already ended today and cancelled ones", () => {
    const rows = [
      session({ endTime: "09:00:00", id: "ended", sessionDate: TODAY, startTime: "07:30:00" }),
      session({ id: "cancelled", sessionDate: TODAY, status: "cancelled" }),
      session({ id: "tonight", sessionDate: TODAY }),
      session({ id: "friday", sessionDate: "2026-10-16" }),
    ];

    expect(findNextClassSession(rows, TODAY, "10:00:00")?.id).toBe("tonight");
    expect(findNextClassSession(rows, TODAY, "22:00")?.id).toBe("friday");
  });
});

describe("tallyClassSessionAttendance", () => {
  it("counts only roster students and only present or an absence as recorded", () => {
    const tallies = tallyClassSessionAttendance(
      [
        { class_session_id: "s1", student_id: "a" },
        { class_session_id: "s1", student_id: "b" },
        { class_session_id: "s1", student_id: "c" },
        { class_session_id: "s1", student_id: "d" },
      ],
      [
        { attendance_status: "present", class_session_id: "s1", student_id: "a" },
        { attendance_status: "unexcused_absence", class_session_id: "s1", student_id: "b" },
        // A roster student marked additional_study is not recorded for the lock.
        { attendance_status: "additional_study", class_session_id: "s1", student_id: "c" },
        // A walk-in outside the roster.
        { attendance_status: "additional_study", class_session_id: "s1", student_id: "walk-in" },
        { attendance_status: "present", class_session_id: "other", student_id: "a" },
        { attendance_status: "late", class_session_id: "s1", student_id: "d" },
      ],
    );

    expect(tallies.get("s1")).toEqual({ absent: 1, additional: 1, present: 1, unmarked: 2 });
    // Sessions without a resolved roster are left out.
    expect(tallies.has("other")).toBe(false);
  });
});

describe("getClassAttendanceRate", () => {
  it("is present over present plus absences on completed sessions", () => {
    const rows = [
      session({ attendance: { absent: 2, additional: 3, present: 18, unmarked: 0 }, id: "1", sessionDate: "2026-10-01", status: "completed" }),
      session({ attendance: { absent: 0, additional: 0, present: 20, unmarked: 0 }, id: "2", sessionDate: "2026-10-03", status: "completed" }),
      session({ attendance: { absent: 10, additional: 0, present: 0, unmarked: 0 }, id: "3", sessionDate: TODAY, status: "in_progress" }),
    ];

    expect(getClassAttendanceRate(rows)).toBe(95);
    expect(getClassAttendanceRate([])).toBeNull();
  });
});

describe("getAttendanceChart", () => {
  function completed(id: string, date: string, present: number) {
    return session({ attendance: { absent: 20 - present, additional: 0, present, unmarked: 0 }, id, ordinal: Number(id), rosterCount: 20, sessionDate: date, status: "completed" });
  }

  it("keeps the last sessions oldest first and flags a single clearly low bar", () => {
    const rows = [
      completed("1", "2026-10-01", 20),
      completed("2", "2026-10-02", 12),
      completed("3", "2026-10-03", 19),
      completed("4", "2026-10-04", 18),
    ];
    const bars = getAttendanceChart(rows, 3);

    expect(bars.map((bar) => bar.id)).toEqual(["2", "3", "4"]);
    expect(bars.find((bar) => bar.low)?.id).toBe("2");
    expect(bars.at(-1)?.latest).toBe(true);
  });

  it("flags nothing when the lowest rate is tied or high", () => {
    expect(getAttendanceChart([completed("1", "2026-10-01", 12), completed("2", "2026-10-02", 12)]).some((bar) => bar.low)).toBe(false);
    expect(getAttendanceChart([completed("1", "2026-10-01", 20), completed("2", "2026-10-02", 19)]).some((bar) => bar.low)).toBe(false);
  });
});

describe("findAbsenceStreaks", () => {
  const sessions = orderClassSessions([
    session({ id: "s1", sessionDate: "2026-10-01", status: "completed" }),
    session({ id: "s2", sessionDate: "2026-10-03", status: "completed" }),
    session({ id: "s3", sessionDate: "2026-10-05", status: "completed" }),
    session({ id: "s4", sessionDate: "2026-10-07", status: "scheduled" }),
  ]);
  const students = [
    { fullName: "Bảo", id: "bao", publicCode: null },
    { fullName: "An", id: "an", publicCode: null },
    { fullName: "Chi", id: "chi", publicCode: null },
  ];

  it("counts consecutive absences back from the latest session and stops at a present mark", () => {
    const streaks = findAbsenceStreaks(students, sessions, [
      { attendance_status: "unexcused_absence", class_session_id: "s1", student_id: "bao" },
      { attendance_status: "excused_absence", class_session_id: "s2", student_id: "bao" },
      { attendance_status: "unexcused_absence", class_session_id: "s3", student_id: "bao" },
      { attendance_status: "unexcused_absence", class_session_id: "s1", student_id: "an" },
      { attendance_status: "present", class_session_id: "s2", student_id: "an" },
      { attendance_status: "unexcused_absence", class_session_id: "s3", student_id: "an" },
      { attendance_status: "excused_absence", class_session_id: "s2", student_id: "chi" },
      // Additional study does not break or extend a streak.
      { attendance_status: "additional_study", class_session_id: "s3", student_id: "chi" },
      { attendance_status: "excused_absence", class_session_id: "s1", student_id: "chi" },
    ]);

    expect(streaks.map((streak) => [streak.student.id, streak.count, streak.ordinals])).toEqual([
      ["bao", 3, [1, 2, 3]],
      ["chi", 2, [1, 2]],
    ]);
  });
});

describe("summarizeClassDebt", () => {
  it("totals students with open debt and those overdue", () => {
    expect(
      summarizeClassDebt({
        a: { amountVnd: 2_400_000, overdue: true },
        b: { amountVnd: 1_200_000, overdue: false },
        c: { amountVnd: 0, overdue: false },
      }),
    ).toEqual({ outstandingVnd: 3_600_000, overdueStudentCount: 1, studentCount: 2 });
  });
});

describe("formatScheduleSummary", () => {
  function slot(weekday: number, startTime = "19:30:00", roomName: string | null = "P.101"): ClassScheduleReadModel {
    return {
      componentCode: null,
      effectiveFrom: "2026-09-01",
      effectiveTo: null,
      endReason: null,
      endTime: startTime === "19:30:00" ? "21:30:00" : "10:00:00",
      id: `slot-${weekday}-${startTime}`,
      isActive: true,
      learningMode: "offline",
      meetingUrl: null,
      roomName,
      startTime,
      weekday,
    };
  }

  it("collapses slots that share a time and orders Monday first", () => {
    expect(formatScheduleSummary([slot(5), slot(1), slot(3)])).toBe("Thứ 2-4-6, 19:30–21:30 · P.101");
  });

  it("lists each slot when times differ and names Sunday", () => {
    expect(formatScheduleSummary([slot(0, "08:00:00", null), slot(6)])).toBe("Thứ 7 19:30, Chủ nhật 08:00 · P.101");
    expect(formatScheduleSummary([])).toBeNull();
  });
});
