import { isSessionAttendanceStatus } from "@/features/sessions/detail-read-models";
import type { SessionKind, SessionStatus } from "@/features/sessions/read-models";

/**
 * Pure models for the class detail page (design 03). The loader lives in
 * `class-detail-data.ts`; everything here is plain data so the client page,
 * the dev preview and unit tests can share it.
 */

/** A feed the viewer may not read, or whose query failed, carries no value at all. */
export type ClassDetailFeed<T> =
  | { status: "ready"; value: T }
  | { status: "unavailable"; reason: "forbidden" | "failed" };

export interface ClassSessionAttendanceTally {
  /** Roster students marked present. */
  present: number;
  /** Roster students with an excused or unexcused absence. */
  absent: number;
  /** Roster students with no lock-counted status yet (unmarked or additional_study only). */
  unmarked: number;
  /** Students outside the roster marked additional_study (walk-ins). */
  additional: number;
}

export interface ClassSessionRow {
  /** Session's own class; differs from the page class for composite classes. */
  classCode: string;
  classId: string;
  componentCode: string | null;
  endTime: string;
  id: string;
  learningMode: string;
  lockedAt: string | null;
  /** 1-based position among non-cancelled sessions by date and time; `null` when cancelled. */
  ordinal: number | null;
  roomName: string | null;
  sessionDate: string;
  sessionKind: SessionKind;
  startTime: string;
  status: SessionStatus;
  /** `null` = roster not loaded (future session, no permission or failed). */
  rosterCount: number | null;
  /** `null` = attendance not loaded for this session. */
  attendance: ClassSessionAttendanceTally | null;
  /** `null` = results not loaded. */
  resultCount: number | null;
}

/**
 * Where a session stands for the class team. `overdue` = still scheduled although
 * its date has passed (nobody started or cancelled it).
 */
export type ClassSessionStage = "upcoming" | "live" | "overdue" | "pending_lock" | "locked" | "cancelled";

export function getClassSessionStage(row: Pick<ClassSessionRow, "lockedAt" | "sessionDate" | "status">, today: string): ClassSessionStage {
  if (row.status === "cancelled") return "cancelled";
  if (row.lockedAt) return "locked";
  if (row.status === "completed") return "pending_lock";
  if (row.status === "in_progress") return "live";
  return row.sessionDate < today ? "overdue" : "upcoming";
}

export const classSessionStageMeta: Record<ClassSessionStage, { label: string; tone: "info" | "success" | "warning" | "danger" | "neutral" | "primary" }> = {
  cancelled: { label: "Đã hủy", tone: "neutral" },
  live: { label: "Đang học", tone: "primary" },
  locked: { label: "Đã khóa", tone: "success" },
  overdue: { label: "Chưa bắt đầu", tone: "danger" },
  pending_lock: { label: "Chờ khóa", tone: "warning" },
  upcoming: { label: "Sắp tới", tone: "info" },
};

export type ClassSessionFilter = "all" | "upcoming" | "pending_lock" | "locked" | "cancelled";

export const classSessionFilters: readonly ClassSessionFilter[] = ["all", "upcoming", "pending_lock", "locked", "cancelled"];

export function isClassSessionFilter(value: unknown): value is ClassSessionFilter {
  return typeof value === "string" && (classSessionFilters as readonly string[]).includes(value);
}

export function matchesClassSessionFilter(stage: ClassSessionStage, filter: ClassSessionFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "upcoming":
      return stage === "upcoming" || stage === "live";
    default:
      return stage === filter;
  }
}

function compareSessions(a: Pick<ClassSessionRow, "sessionDate" | "startTime">, b: Pick<ClassSessionRow, "sessionDate" | "startTime">): number {
  return a.sessionDate === b.sessionDate ? a.startTime.localeCompare(b.startTime) : a.sessionDate.localeCompare(b.sessionDate);
}

/** Sorts ascending by date and time and numbers the non-cancelled sessions 1..n. */
export function orderClassSessions<T extends Omit<ClassSessionRow, "ordinal">>(rows: readonly T[]): Array<T & { ordinal: number | null }> {
  let next = 1;

  return [...rows].sort(compareSessions).map((row) => ({
    ...row,
    ordinal: row.status === "cancelled" ? null : next++,
  }));
}

export function formatSessionOrdinal(ordinal: number | null): string {
  return ordinal === null ? "—" : `B${ordinal}`;
}

export interface ClassSessionSummary {
  /** Non-cancelled sessions. */
  total: number;
  /** Completed sessions, locked or not. */
  completed: number;
  locked: number;
  pendingLock: number;
  /** Scheduled from today on, plus sessions in progress. */
  upcoming: number;
  overdue: number;
  cancelled: number;
}

export function summarizeClassSessions(rows: readonly ClassSessionRow[], today: string): ClassSessionSummary {
  const summary: ClassSessionSummary = { cancelled: 0, completed: 0, locked: 0, overdue: 0, pendingLock: 0, total: 0, upcoming: 0 };

  for (const row of rows) {
    const stage = getClassSessionStage(row, today);

    if (stage === "cancelled") {
      summary.cancelled += 1;
      continue;
    }

    summary.total += 1;
    if (row.status === "completed") summary.completed += 1;
    if (stage === "locked") summary.locked += 1;
    if (stage === "pending_lock") summary.pendingLock += 1;
    if (stage === "upcoming" || stage === "live") summary.upcoming += 1;
    if (stage === "overdue") summary.overdue += 1;
  }

  return summary;
}

export function countClassSessionFilters(rows: readonly ClassSessionRow[], today: string): Record<ClassSessionFilter, number> {
  const counts: Record<ClassSessionFilter, number> = { all: rows.length, cancelled: 0, locked: 0, pending_lock: 0, upcoming: 0 };

  for (const row of rows) {
    const stage = getClassSessionStage(row, today);

    for (const filter of classSessionFilters) {
      if (filter !== "all" && matchesClassSessionFilter(stage, filter)) counts[filter] += 1;
    }
  }

  return counts;
}

/**
 * The session the class meets next: one in progress, or the first scheduled one
 * that has not ended yet (`nowTime` is HH:MM[:SS] in Vietnam time).
 */
export function findNextClassSession<T extends Pick<ClassSessionRow, "endTime" | "sessionDate" | "startTime" | "status">>(
  rows: readonly T[],
  today: string,
  nowTime: string,
): T | null {
  const candidates = rows
    .filter((row) => {
      if (row.status === "in_progress") return true;
      if (row.status !== "scheduled") return false;
      return row.sessionDate > today || (row.sessionDate === today && row.endTime.slice(0, 5) >= nowTime.slice(0, 5));
    })
    .sort(compareSessions);

  return candidates.find((row) => row.status === "in_progress") ?? candidates[0] ?? null;
}

export interface RosterEntry {
  class_session_id: string;
  student_id: string;
}

export interface AttendanceEntry {
  attendance_status: string;
  class_session_id: string;
  student_id: string;
}

/**
 * Per-session tallies that mirror lock_class_session_internal: only roster
 * students count, and only present or an absence counts as recorded. Sessions
 * without a resolved roster are left out (the caller shows "—").
 */
export function tallyClassSessionAttendance(
  rosters: readonly RosterEntry[],
  attendance: readonly AttendanceEntry[],
): Map<string, ClassSessionAttendanceTally> {
  const rosterBySession = new Map<string, Set<string>>();

  for (const entry of rosters) {
    const roster = rosterBySession.get(entry.class_session_id) ?? new Set<string>();
    roster.add(entry.student_id);
    rosterBySession.set(entry.class_session_id, roster);
  }

  const statusBySession = new Map<string, Map<string, string>>();

  for (const entry of attendance) {
    if (!isSessionAttendanceStatus(entry.attendance_status)) continue;
    const statuses = statusBySession.get(entry.class_session_id) ?? new Map<string, string>();
    statuses.set(entry.student_id, entry.attendance_status);
    statusBySession.set(entry.class_session_id, statuses);
  }

  const tallies = new Map<string, ClassSessionAttendanceTally>();

  for (const [sessionId, roster] of rosterBySession) {
    const statuses = statusBySession.get(sessionId) ?? new Map<string, string>();
    const tally: ClassSessionAttendanceTally = { absent: 0, additional: 0, present: 0, unmarked: 0 };

    for (const studentId of roster) {
      const status = statuses.get(studentId);
      if (status === "present") tally.present += 1;
      else if (status === "excused_absence" || status === "unexcused_absence") tally.absent += 1;
      else tally.unmarked += 1;
    }

    for (const [studentId, status] of statuses) {
      if (!roster.has(studentId) && status === "additional_study") tally.additional += 1;
    }

    tallies.set(sessionId, tally);
  }

  return tallies;
}

export function getRecordedCount(tally: ClassSessionAttendanceTally): number {
  return tally.present + tally.absent;
}

/** Present / (present + absences) over completed sessions with a tally; `null` when none. */
export function getClassAttendanceRate(rows: readonly ClassSessionRow[]): number | null {
  let present = 0;
  let main = 0;

  for (const row of rows) {
    if (row.status !== "completed" || !row.attendance) continue;
    present += row.attendance.present;
    main += row.attendance.present + row.attendance.absent;
  }

  return main === 0 ? null : Math.round((present / main) * 100);
}

export interface AttendanceChartBar {
  id: string;
  ordinal: number | null;
  present: number;
  roster: number;
  sessionDate: string;
  /** Present share of the roster, 0–100. */
  rate: number;
  /** Lowest bar in the window and clearly below the rest (shown in warning colour). */
  low: boolean;
  /** Most recent completed session. */
  latest: boolean;
}

/** A session this far below the window's typical attendance is called out. */
const LOW_ATTENDANCE_RATE = 85;

/** Last `limit` completed sessions with a roster, oldest first. */
export function getAttendanceChart(rows: readonly ClassSessionRow[], limit = 12): AttendanceChartBar[] {
  const completed = rows
    .filter((row) => row.status === "completed" && row.attendance && row.rosterCount)
    .sort(compareSessions)
    .slice(-limit);

  const bars = completed.map((row, index) => {
    const roster = row.rosterCount ?? 0;
    const present = row.attendance?.present ?? 0;

    return {
      id: row.id,
      latest: index === completed.length - 1,
      low: false,
      ordinal: row.ordinal,
      present,
      rate: roster === 0 ? 0 : Math.round((present / roster) * 100),
      roster,
      sessionDate: row.sessionDate,
    };
  });

  const lowest = bars.reduce<AttendanceChartBar | null>((min, bar) => (!min || bar.rate < min.rate ? bar : min), null);

  if (lowest && lowest.rate < LOW_ATTENDANCE_RATE && bars.filter((bar) => bar.rate === lowest.rate).length === 1) {
    lowest.low = true;
  }

  return bars;
}

export interface ClassStudentRef {
  fullName: string;
  id: string;
  publicCode: string | null;
}

export interface AbsenceStreak {
  student: ClassStudentRef;
  /** Consecutive absences counted back from the most recent completed session. */
  count: number;
  /** Ordinals of the absent sessions, oldest first. */
  ordinals: number[];
}

/** Same threshold as the care rule `absence_streak`: the last two sessions both missed. */
export const ABSENCE_STREAK_THRESHOLD = 2;

/**
 * Active students whose most recent attendances in this class are absences.
 * Only completed sessions where the student has present or an absence count;
 * additional study and unmarked sessions are skipped, as in the care rule.
 */
export function findAbsenceStreaks(
  students: readonly ClassStudentRef[],
  sessions: readonly ClassSessionRow[],
  attendance: readonly AttendanceEntry[],
  threshold = ABSENCE_STREAK_THRESHOLD,
): AbsenceStreak[] {
  const completed = new Map(sessions.filter((row) => row.status === "completed").map((row) => [row.id, row]));
  const byStudent = new Map<string, Array<{ absent: boolean; session: ClassSessionRow }>>();

  for (const entry of attendance) {
    const session = completed.get(entry.class_session_id);
    if (!session) continue;
    const status = entry.attendance_status;
    if (status !== "present" && status !== "excused_absence" && status !== "unexcused_absence") continue;
    const list = byStudent.get(entry.student_id) ?? [];
    list.push({ absent: status !== "present", session });
    byStudent.set(entry.student_id, list);
  }

  const streaks: AbsenceStreak[] = [];

  for (const student of students) {
    const history = (byStudent.get(student.id) ?? []).sort((a, b) => compareSessions(b.session, a.session));
    const absences: ClassSessionRow[] = [];

    for (const item of history) {
      if (!item.absent) break;
      absences.push(item.session);
    }

    if (absences.length >= threshold) {
      streaks.push({
        count: absences.length,
        ordinals: absences
          .map((session) => session.ordinal)
          .filter((ordinal): ordinal is number => ordinal !== null)
          .reverse(),
        student,
      });
    }
  }

  return streaks.sort((a, b) => b.count - a.count || a.student.fullName.localeCompare(b.student.fullName, "vi"));
}

export interface ClassDebtSummary {
  /** Students of the class with open debt (their debt across all classes). */
  studentCount: number;
  outstandingVnd: number;
  overdueStudentCount: number;
}

export function summarizeClassDebt(byStudentId: Record<string, { amountVnd: number; overdue: boolean }>): ClassDebtSummary {
  const entries = Object.values(byStudentId).filter((entry) => entry.amountVnd > 0);

  return {
    outstandingVnd: entries.reduce((sum, entry) => sum + entry.amountVnd, 0),
    overdueStudentCount: entries.filter((entry) => entry.overdue).length,
    studentCount: entries.length,
  };
}
