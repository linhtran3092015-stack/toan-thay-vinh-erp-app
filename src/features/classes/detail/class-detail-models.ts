import { isSessionAttendanceStatus } from "@/features/sessions/detail-read-models";
import type { ClassDetailWorkspace } from "@/features/classes/detail/class-detail-data";
import type { SessionKind, SessionStatus } from "@/features/sessions/read-models";

/**
 * Pure models for the class detail page (design 03). The loader lives in
 * `class-detail-data.ts`; everything here is plain data so the client page,
 * the dev preview and unit tests can share it.
 */

/** Sessions read per class; a school year of three sessions a week fits well inside. */
export const CLASS_SESSION_LIMIT = 400;
/** Shortest enroll-dialog search sent to the server; shorter input shows the initial list. */
export const ENROLLMENT_SEARCH_MIN_LENGTH = 2;
/** Longer enroll-dialog search input is cut; nobody types a name or code this long. */
export const ENROLLMENT_SEARCH_MAX_LENGTH = 100;

/**
 * Shown by the enroll dialog when the search call itself fails, and returned by the
 * search action when the query fails; other returned errors carry their own message.
 */
export const ENROLLMENT_SEARCH_FAILED_MESSAGE = "Chưa tìm được học sinh, thử lại.";

/** A feed the viewer may not read, or whose query failed, carries no value at all. */
export type ClassDetailFeed<T> =
  | { status: "ready"; value: T }
  | { status: "unavailable"; reason: "forbidden" | "failed" };

/** A feed's readiness without its value: "ready", or why it is unavailable. */
export type ClassDetailFeedState = "ready" | "forbidden" | "failed";

/** Every feed forbidden: the page's default and the loader's starting point. */
export const forbiddenClassDetailWorkspace: Readonly<ClassDetailWorkspace> = {
  absenceStreaks: { reason: "forbidden", status: "unavailable" },
  attendance: { reason: "forbidden", status: "unavailable" },
  balances: { reason: "forbidden", status: "unavailable" },
  debt: { reason: "forbidden", status: "unavailable" },
  enrollments: { reason: "forbidden", status: "unavailable" },
  resultMatrix: { reason: "forbidden", status: "unavailable" },
  results: { reason: "forbidden", status: "unavailable" },
  sessions: { reason: "forbidden", status: "unavailable" },
  studentDebts: { reason: "forbidden", status: "unavailable" },
  students: { reason: "forbidden", status: "unavailable" },
};

export function getClassDetailFeedState(feed: ClassDetailFeed<unknown>): ClassDetailFeedState {
  return feed.status === "ready" ? "ready" : feed.reason;
}

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
 * its date has passed, or (when `nowTime` is given) it ended earlier today:
 * nobody started or cancelled it.
 */
export type ClassSessionStage = "upcoming" | "live" | "overdue" | "pending_lock" | "locked" | "cancelled";

/** `HH:MM` → `HH:MM:00`, so it compares with `time` columns. */
function toTimeOfDay(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

/**
 * Whether a session's time is over: its date has passed, or (when `nowTime`,
 * HH:MM[:SS] in Vietnam time, is given) it is today and its end time has been
 * reached. Shared by getClassSessionStage and findNextClassSession so a session
 * is never both "next" and overdue at the same moment.
 */
export function hasSessionEnded(
  row: Pick<ClassSessionRow, "sessionDate"> & Partial<Pick<ClassSessionRow, "endTime">>,
  today: string,
  nowTime?: string,
): boolean {
  if (row.sessionDate !== today) return row.sessionDate < today;
  return Boolean(nowTime && row.endTime && toTimeOfDay(row.endTime) <= toTimeOfDay(nowTime));
}

/** `nowTime` is HH:MM[:SS] in Vietnam time (getVietnamTime); without it only past dates are overdue. */
export function getClassSessionStage(
  row: Pick<ClassSessionRow, "lockedAt" | "sessionDate" | "status"> & Partial<Pick<ClassSessionRow, "endTime">>,
  today: string,
  nowTime?: string,
): ClassSessionStage {
  if (row.status === "cancelled") return "cancelled";
  if (row.lockedAt) return "locked";
  if (row.status === "completed") return "pending_lock";
  if (row.status === "in_progress") return "live";
  if (hasSessionEnded(row, today, nowTime)) return "overdue";
  return "upcoming";
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

/** Ascending by date, then start time. */
export function compareSessions(a: Pick<ClassSessionRow, "sessionDate" | "startTime">, b: Pick<ClassSessionRow, "sessionDate" | "startTime">): number {
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
  overdue: number;
}

export function summarizeClassSessions(rows: readonly ClassSessionRow[], today: string, nowTime?: string): ClassSessionSummary {
  const summary: ClassSessionSummary = { completed: 0, locked: 0, overdue: 0, pendingLock: 0, total: 0 };

  for (const row of rows) {
    const stage = getClassSessionStage(row, today, nowTime);

    if (stage === "cancelled") continue;

    summary.total += 1;
    if (row.status === "completed") summary.completed += 1;
    if (stage === "locked") summary.locked += 1;
    if (stage === "pending_lock") summary.pendingLock += 1;
    if (stage === "overdue") summary.overdue += 1;
  }

  return summary;
}

export function countClassSessionFilters(
  rows: readonly ClassSessionRow[],
  today: string,
  nowTime?: string,
): Record<ClassSessionFilter, number> {
  const counts: Record<ClassSessionFilter, number> = { all: rows.length, cancelled: 0, locked: 0, pending_lock: 0, upcoming: 0 };

  for (const row of rows) {
    const stage = getClassSessionStage(row, today, nowTime);

    for (const filter of classSessionFilters) {
      if (filter !== "all" && matchesClassSessionFilter(stage, filter)) counts[filter] += 1;
    }
  }

  return counts;
}

/**
 * The session the class meets next: one in progress, or the first scheduled one
 * that has not ended yet (hasSessionEnded; `nowTime` is HH:MM[:SS] in Vietnam time).
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
      return !hasSessionEnded(row, today, nowTime);
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
  /** Enrolment the mark was made under; `null` for walk-ins. Not always selected. */
  student_enrollment_id?: string | null;
}

export const ABSENCE_STATUSES = ["excused_absence", "unexcused_absence"] as const;

export function isAbsenceStatus(status: string): boolean {
  return (ABSENCE_STATUSES as readonly string[]).includes(status);
}

/** Statuses lock_class_session_internal accepts as recorded: present or an absence. */
export function isLockCountedAttendanceStatus(status: string): boolean {
  return status === "present" || isAbsenceStatus(status);
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
      else if (status && isAbsenceStatus(status)) tally.absent += 1;
      else tally.unmarked += 1;
    }

    for (const [studentId, status] of statuses) {
      if (!roster.has(studentId) && status === "additional_study") tally.additional += 1;
    }

    tallies.set(sessionId, tally);
  }

  return tallies;
}

/**
 * Per session, the students tallyClassSessionAttendance counts: the roster plus
 * additional_study walk-ins off the roster. Like the tally, sessions without a
 * roster entry are left out. Used to keep result counts to the same students.
 */
export function getTalliedStudents(rosters: readonly RosterEntry[], attendance: readonly AttendanceEntry[]): Map<string, Set<string>> {
  const students = new Map<string, Set<string>>();

  for (const entry of rosters) {
    const set = students.get(entry.class_session_id) ?? new Set<string>();
    set.add(entry.student_id);
    students.set(entry.class_session_id, set);
  }

  const rosterStudents = new Map([...students].map(([sessionId, set]) => [sessionId, new Set(set)]));
  for (const entry of attendance) {
    const roster = rosterStudents.get(entry.class_session_id);
    if (roster && !roster.has(entry.student_id) && entry.attendance_status === "additional_study") {
      students.get(entry.class_session_id)?.add(entry.student_id);
    }
  }

  return students;
}

export function getRecordedCount(tally: ClassSessionAttendanceTally): number {
  return tally.present + tally.absent;
}

/**
 * Whether a session's attendance is ready to lock, as far as this page can tell.
 * `not_applicable` = not in progress or completed, or already locked or cancelled;
 * `unknown` = a component class's session on a composite parent's page (its
 * roster here is filtered, while lock_class_session_internal checks the full
 * roster) or roster / attendance not loaded; `no_roster` = resolved roster is
 * empty; `incomplete` = fewer roster students recorded (present or an absence)
 * than on the roster; `complete` otherwise. Show a lock CTA only on `complete`.
 */
export type SessionAttendanceReadiness = "not_applicable" | "unknown" | "no_roster" | "incomplete" | "complete";

export function getSessionAttendanceReadiness(
  row: Pick<ClassSessionRow, "attendance" | "classId" | "lockedAt" | "rosterCount" | "status">,
  classId: string,
): SessionAttendanceReadiness {
  if ((row.status !== "in_progress" && row.status !== "completed") || row.lockedAt) return "not_applicable";
  if (row.classId !== classId || row.rosterCount === null || row.attendance === null) return "unknown";
  if (row.rosterCount === 0) return "no_roster";
  return getRecordedCount(row.attendance) < row.rosterCount ? "incomplete" : "complete";
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
  /** The unique lowest bar in the window, when its rate is below LOW_ATTENDANCE_RATE (shown in warning colour). */
  low: boolean;
  /** Most recent completed session. */
  latest: boolean;
}

/** Attendance rate (%) below which a session or the class is flagged; an absolute cutoff, not relative to the window. */
export const LOW_ATTENDANCE_RATE = 85;

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
/** From this many consecutive absences the streak is shown as danger rather than warning. */
export const ABSENCE_STREAK_DANGER_COUNT = 3;

export interface AbsenceStreakOptions {
  /**
   * Resolved rosters of this page's sessions. A roster student without a mark on
   * a completed non-additional session is an observation that breaks the streak.
   * Without rosters only sessions where the student has a mark are observed.
   */
  rosters?: readonly RosterEntry[];
  /** Vietnam date; completed sessions after it are ignored, as in the care rule. */
  today?: string;
}

/**
 * Active students whose latest observations in this class are absences, following
 * the care rule (student_care_observations + student_care_calculate): a student is
 * observed on a completed session where they have any mark, or on a completed
 * non-additional session where they are on the roster. Present, additional_study
 * or no mark breaks the streak. Differences that remain: the care rule looks across
 * all of the student's classes and counts enrolments of any status, while this page
 * sees only its own sessions, rosters only of active enrolments, and no roster for
 * open sessions beyond OPEN_ROSTER_LIMIT (those count only when marked).
 */
export function findAbsenceStreaks(
  students: readonly ClassStudentRef[],
  sessions: readonly ClassSessionRow[],
  attendance: readonly AttendanceEntry[],
  options: AbsenceStreakOptions = {},
): AbsenceStreak[] {
  const completed = new Map(
    sessions
      .filter((row) => row.status === "completed" && (!options.today || row.sessionDate <= options.today))
      .map((row) => [row.id, row]),
  );
  // Student → session → status; `null` = on the roster without a mark.
  const byStudent = new Map<string, Map<string, string | null>>();
  const observe = (studentId: string, sessionId: string, status: string | null) => {
    const observations = byStudent.get(studentId) ?? new Map<string, string | null>();
    if (status !== null || !observations.has(sessionId)) observations.set(sessionId, status);
    byStudent.set(studentId, observations);
  };

  for (const entry of options.rosters ?? []) {
    const session = completed.get(entry.class_session_id);
    if (session && session.sessionKind !== "additional") observe(entry.student_id, session.id, null);
  }

  for (const entry of attendance) {
    if (completed.has(entry.class_session_id)) observe(entry.student_id, entry.class_session_id, entry.attendance_status);
  }

  const streaks: AbsenceStreak[] = [];

  for (const student of students) {
    const history = [...(byStudent.get(student.id) ?? new Map<string, string | null>())]
      .map(([sessionId, status]) => ({ session: completed.get(sessionId) as ClassSessionRow, status }))
      // Newest first, ties broken by id as in the care rule.
      .sort((a, b) => compareSessions(b.session, a.session) || b.session.id.localeCompare(a.session.id));
    const absences: ClassSessionRow[] = [];

    for (const item of history) {
      if (item.status === null || !isAbsenceStatus(item.status)) break;
      absences.push(item.session);
    }

    if (absences.length >= ABSENCE_STREAK_THRESHOLD) {
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
