import "server-only";

import {
  CLASS_SESSION_LIMIT,
  compareSessions,
  ENROLLMENT_SEARCH_MAX_LENGTH,
  findAbsenceStreaks,
  forbiddenClassDetailWorkspace,
  getTalliedStudents,
  isLockCountedAttendanceStatus,
  orderClassSessions,
  summarizeClassDebt,
  tallyClassSessionAttendance,
  type AbsenceStreak,
  type AttendanceEntry,
  type ClassDebtSummary,
  type ClassDetailFeed,
  type ClassSessionRow,
  type ClassStudentRef,
  type RosterEntry,
} from "@/features/classes/detail/class-detail-models";
import {
  buildClassResultMatrix,
  isClassEnrollmentStatus,
  pickLatestEnrollments,
  type ClassEnrollmentRow,
  type ClassResultEntry,
  type ClassResultMatrix,
  type ClassStudentDebt,
} from "@/features/classes/detail/class-roster-models";
import type { SessionKind, SessionStatus } from "@/features/sessions/read-models";
import { summarizeDirectoryDebt } from "@/features/students/student-directory-metrics";
import { getVietnamToday } from "@/lib/datetime";
import { compareStudentNames, sortByStudentName } from "@/lib/student-order";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** PostgREST returns at most this many rows per request; bigger reads are paged. */
const PAGE_SIZE = 1000;
/**
 * Hard stop for one paged read. Reads are split into groups of IN_FILTER_CHUNK_SIZE
 * ids, so this caps each group at 12 000 rows (about 80 marks per session).
 */
const MAX_PAGES = 12;
/** Ids per `in` filter: PostgREST takes them in the URL, which must stay well under proxy length limits. */
const IN_FILTER_CHUNK_SIZE = 150;

const sessionKinds: readonly SessionKind[] = ["regular", "makeup", "additional"];
const sessionStatuses: readonly SessionStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];

export interface ClassDetailWorkspacePermissions {
  canViewAttendance: boolean;
  canViewPayments: boolean;
  canViewResults: boolean;
  canViewSessions: boolean;
  canViewStudents: boolean;
  /** session_ledger.view: per-student session balances on the students tab. */
  canViewLedger?: boolean;
}

export interface ClassDetailWorkspace {
  /** Ordered ascending; `truncated` when the class has more than CLASS_SESSION_LIMIT sessions. */
  sessions: ClassDetailFeed<{ rows: ClassSessionRow[]; truncated: boolean }>;
  /** Whether per-session attendance tallies are filled in on `sessions`. */
  attendance: ClassDetailFeed<true>;
  /** Whether per-session result counts are filled in on `sessions`. */
  results: ClassDetailFeed<true>;
  /** Active students of the class (names need students.view). */
  students: ClassDetailFeed<ClassStudentRef[]>;
  absenceStreaks: ClassDetailFeed<AbsenceStreak[]>;
  /** Open debt of the class's active students, across all their requests. */
  debt: ClassDetailFeed<ClassDebtSummary>;
  /** Latest enrolment per student who was ever in the class (students.view). */
  enrollments: ClassDetailFeed<ClassEnrollmentRow[]>;
  /** Session balance per enrolled student, across all their classes (session_ledger.view). */
  balances: ClassDetailFeed<Record<string, number>>;
  /** Open debt per enrolled student, across all their requests (payments.view). */
  studentDebts: ClassDetailFeed<Record<string, ClassStudentDebt>>;
  /** Students × started sessions test scores (results.view + students.view). */
  resultMatrix: ClassDetailFeed<ClassResultMatrix>;
}

const forbidden = { reason: "forbidden", status: "unavailable" } as const;
const failed = { reason: "failed", status: "unavailable" } as const;

/** Every feed the viewer may read is `failed`, the rest `forbidden`. */
function unavailableWorkspace(permissions: ClassDetailWorkspacePermissions): ClassDetailWorkspace {
  return {
    absenceStreaks: permissions.canViewSessions && permissions.canViewAttendance && permissions.canViewStudents ? failed : forbidden,
    attendance: permissions.canViewSessions && permissions.canViewAttendance ? failed : forbidden,
    balances: permissions.canViewStudents && permissions.canViewLedger ? failed : forbidden,
    debt: permissions.canViewPayments ? failed : forbidden,
    enrollments: permissions.canViewStudents ? failed : forbidden,
    resultMatrix: permissions.canViewSessions && permissions.canViewResults && permissions.canViewStudents ? failed : forbidden,
    results: permissions.canViewSessions && permissions.canViewResults ? failed : forbidden,
    sessions: permissions.canViewSessions ? failed : forbidden,
    studentDebts: permissions.canViewStudents && permissions.canViewPayments ? failed : forbidden,
    students: permissions.canViewStudents ? failed : forbidden,
  };
}

export type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function fetchPaged<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await load(from, from + PAGE_SIZE - 1);

    if (error) return null;

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) return rows;
  }

  // Ran out of pages: an incomplete tally would be wrong, so report a failure.
  return null;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

interface LinkWindow {
  from: string;
  to: string | null;
}

/**
 * The class plus its component classes: composite classes hold sessions on
 * components, but only while a link covers the session date (the same window
 * per-session resolve_class_session_roster RPC applies).
 */
export async function getSessionClassIds(
  supabase: SupabaseClient,
  classId: string,
): Promise<{ classIds: string[]; windows: Map<string, LinkWindow[]> } | null> {
  const { data, error } = await supabase
    .from("class_component_links")
    .select("component_class_id, effective_from, effective_to")
    .eq("parent_class_id", classId);

  if (error) return null;

  const windows = new Map<string, LinkWindow[]>();
  for (const link of data ?? []) {
    windows.set(link.component_class_id, [...(windows.get(link.component_class_id) ?? []), { from: link.effective_from, to: link.effective_to }]);
  }

  return { classIds: [classId, ...windows.keys()], windows };
}

/** Ids and dates go into a PostgREST filter string: allow only characters that cannot end or split it. */
const FILTER_ID_PATTERN = /^[0-9A-Za-z-]+$/;
const FILTER_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `or()` filter for the class's own sessions plus each component's sessions
 * inside a link window, so out-of-window rows never reach the limit. `null`
 * when an id or date is not in the expected uuid / ISO date shape.
 */
export function buildSessionWindowFilter(classId: string, windows: ReadonlyMap<string, readonly LinkWindow[]>): string | null {
  if (!FILTER_ID_PATTERN.test(classId)) return null;

  const parts = [`class_id.eq.${classId}`];

  for (const [componentId, componentWindows] of windows) {
    if (!FILTER_ID_PATTERN.test(componentId)) return null;

    for (const window of componentWindows) {
      if (!FILTER_DATE_PATTERN.test(window.from) || (window.to !== null && !FILTER_DATE_PATTERN.test(window.to))) return null;
      const to = window.to === null ? "" : `,session_date.lte.${window.to}`;
      parts.push(`and(class_id.eq.${componentId},session_date.gte.${window.from}${to})`);
    }
  }

  return parts.join(",");
}

function isSessionOfClass(classId: string, windows: ReadonlyMap<string, LinkWindow[]>, row: Pick<SessionQueryRow, "class_id" | "session_date">): boolean {
  if (row.class_id === classId) return true;
  return (windows.get(row.class_id) ?? []).some((window) => window.from <= row.session_date && (window.to === null || window.to >= row.session_date));
}

interface SessionQueryRow {
  class: { code: string } | { code: string }[] | null;
  class_id: string;
  component_code: string | null;
  end_time: string;
  id: string;
  learning_mode: string;
  locked_at: string | null;
  room_name: string | null;
  session_date: string;
  session_kind: string;
  start_time: string;
  status: string;
}

async function loadSessions(
  supabase: SupabaseClient,
  classId: string,
): Promise<{ rows: Omit<ClassSessionRow, "ordinal">[]; truncated: boolean } | null> {
  const links = await getSessionClassIds(supabase, classId);

  if (!links) return null;

  const windowFilter = buildSessionWindowFilter(classId, links.windows);

  if (!windowFilter) return null;

  let query = supabase
    .from("class_sessions")
    .select(
      `
      id,
      class_id,
      session_date,
      session_kind,
      component_code,
      start_time,
      end_time,
      learning_mode,
      room_name,
      status,
      locked_at,
      class:classes!class_sessions_class_id_fkey ( code )
      `,
    )
    .in("class_id", links.classIds);

  // Link windows are applied in the query, before the limit, so `truncated`
  // counts only sessions this page shows.
  if (links.windows.size > 0) query = query.or(windowFilter);

  const { data, error } = await query
    .order("session_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(CLASS_SESSION_LIMIT + 1);

  if (error) return null;

  const rows = (data ?? []) as unknown as SessionQueryRow[];
  const truncated = rows.length > CLASS_SESSION_LIMIT;

  return {
    rows: rows
      .slice(0, CLASS_SESSION_LIMIT)
      // Unknown kinds or statuses are dropped rather than guessed.
      .filter(
        (row) =>
          (sessionKinds as readonly string[]).includes(row.session_kind) &&
          (sessionStatuses as readonly string[]).includes(row.status) &&
          // Safety net for the query's window filter: component sessions outside
          // every link window belong to another parent period.
          isSessionOfClass(classId, links.windows, row),
      )
      .map((row) => {
        const klass = Array.isArray(row.class) ? row.class[0] ?? null : row.class;

        return {
          attendance: null,
          classCode: klass?.code ?? "",
          classId: row.class_id,
          componentCode: row.component_code,
          endTime: row.end_time,
          id: row.id,
          learningMode: row.learning_mode,
          lockedAt: row.locked_at,
          resultCount: null,
          roomName: row.room_name,
          rosterCount: null,
          sessionDate: row.session_date,
          sessionKind: row.session_kind as SessionKind,
          startTime: row.start_time,
          status: row.status as SessionStatus,
        };
      }),
    truncated,
  };
}

/** Unlocked started sessions whose roster is resolved one RPC at a time (priority order in fillSessionFeeds). */
export const OPEN_ROSTER_LIMIT = 40;
const ROSTER_CONCURRENCY = 8;

/**
 * Rosters of started sessions that are not locked yet, through the per-session
 * RPC (the batch variant is internal-only). Locked sessions need no call: the
 * lock requires every roster student to be present or absent, and only roster
 * students may hold those statuses, so their roster is read off the attendance.
 * A call that fails (a session deleted since the read, a transient error) only
 * leaves that session unresolved: it lands in `failedIds`, the rest still count
 * (owner decision D18).
 */
export async function loadOpenRosters(
  supabase: SupabaseClient,
  sessionIds: readonly string[],
): Promise<{ entries: Array<RosterEntry & { enrollment_class_id: string }>; failedIds: Set<string> }> {
  const entries: Array<RosterEntry & { enrollment_class_id: string }> = [];
  const failedIds = new Set<string>();

  for (const ids of chunk(sessionIds, ROSTER_CONCURRENCY)) {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return { id, result: await supabase.rpc("resolve_class_session_roster", { p_class_session_id: id }) };
        } catch {
          return { id, result: null };
        }
      }),
    );

    for (const { id, result } of results) {
      if (!result || result.error) {
        failedIds.add(id);
        continue;
      }
      entries.push(
        ...(result.data ?? []).map((row) => ({ class_session_id: id, enrollment_class_id: row.enrollment_class_id, student_id: row.student_id })),
      );
    }
  }

  return { entries, failedIds };
}

/** Roster of a locked session = its students marked present or absent. */
export function getLockedSessionRosters(lockedIds: ReadonlySet<string>, attendance: readonly AttendanceEntry[]): RosterEntry[] {
  return attendance
    .filter((entry) => lockedIds.has(entry.class_session_id) && isLockCountedAttendanceStatus(entry.attendance_status))
    .map((entry) => ({ class_session_id: entry.class_session_id, student_id: entry.student_id }));
}

/** Runs one paged read per id chunk in parallel; `null` when any chunk fails. */
export async function fetchChunked<T>(ids: readonly string[], load: (chunkIds: string[]) => Promise<T[] | null>): Promise<T[] | null> {
  const pages = await Promise.all(chunk(ids, IN_FILTER_CHUNK_SIZE).map(load));
  return pages.some((page) => page === null) ? null : pages.flatMap((page) => page ?? []);
}

async function loadAttendance(supabase: SupabaseClient, sessionIds: readonly string[]): Promise<AttendanceEntry[] | null> {
  return fetchChunked(sessionIds, (ids) =>
    fetchPaged<AttendanceEntry>((from, to) =>
      supabase
        .from("session_attendance")
        .select("class_session_id, student_id, student_enrollment_id, attendance_status")
        .in("class_session_id", ids)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );
}

async function loadResults(supabase: SupabaseClient, sessionIds: readonly string[]): Promise<ClassResultEntry[] | null> {
  return fetchChunked(sessionIds, (ids) =>
    fetchPaged<ClassResultEntry>((from, to) =>
      supabase
        .from("session_results")
        .select("class_session_id, student_id, test_score")
        .in("class_session_id", ids)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );
}

/** Every enrolment ever made in the class (any status), to tell its students apart on component sessions. */
async function loadClassEnrollmentIds(supabase: SupabaseClient, classId: string): Promise<Set<string> | null> {
  const rows = await fetchPaged<{ id: string }>((from, to) =>
    supabase.from("student_enrollments").select("id").eq("class_id", classId).order("id", { ascending: true }).range(from, to),
  );

  return rows ? new Set(rows.map((row) => row.id)) : null;
}

interface EnrollmentQueryRow {
  student: { full_name: string; id: string; public_code: string | null } | { full_name: string; id: string; public_code: string | null }[] | null;
  student_id: string;
}

async function loadActiveStudents(
  supabase: SupabaseClient,
  classId: string,
  withNames: boolean,
): Promise<{ ids: string[]; students: ClassStudentRef[] | null } | null> {
  const { data, error } = await supabase
    .from("student_enrollments")
    .select(withNames ? "student_id, student:students ( id, full_name, public_code )" : "student_id")
    .eq("class_id", classId)
    .eq("status", "active")
    .is("effective_to", null);

  if (error) return null;

  const rows = (data ?? []) as unknown as EnrollmentQueryRow[];
  const ids = [...new Set(rows.map((row) => row.student_id))];

  if (!withNames) return { ids, students: null };

  const students = rows
    .map((row) => (Array.isArray(row.student) ? row.student[0] ?? null : row.student))
    .filter((student): student is NonNullable<typeof student> => student !== null)
    .map((student) => ({ fullName: student.full_name, id: student.id, publicCode: student.public_code }))
    .sort((a, b) => compareStudentNames(a.fullName, b.fullName));

  return { ids, students };
}

type StudentRelation = { full_name: string; id: string; public_code: string | null };

interface ClassEnrollmentQueryRow {
  effective_from: string;
  effective_to: string | null;
  end_reason: string | null;
  id: string;
  registered_mode: string;
  status: string;
  student: StudentRelation | StudentRelation[] | null;
  student_id: string;
}

/**
 * Every enrolment ever made in the class, one row per student
 * (pickLatestEnrollments). Shared with the tuition tab's loader.
 */
export async function loadClassEnrollments(supabase: SupabaseClient, classId: string): Promise<ClassEnrollmentRow[] | null> {
  const rows = await fetchPaged<ClassEnrollmentQueryRow>((from, to) =>
    supabase
      .from("student_enrollments")
      .select("id, student_id, status, effective_from, effective_to, registered_mode, end_reason, student:students ( id, full_name, public_code )")
      .eq("class_id", classId)
      .order("id", { ascending: true })
      .range(from, to),
  );

  if (!rows) return null;

  // Only a badge depends on it: a failed read leaves reserved rows as reserved
  // rather than failing every feed built on the roster (matrix, debts, tuition).
  const resumedElsewhere =
    (await loadResumedElsewhere(
      supabase,
      classId,
      rows.filter((row) => row.status === "reserved").map((row) => row.id),
    ).catch(() => null)) ?? new Set<string>();

  return pickLatestEnrollments(
    rows.flatMap((row) => {
      const student = Array.isArray(row.student) ? row.student[0] ?? null : row.student;
      // Unknown statuses are dropped rather than guessed.
      if (!student || !isClassEnrollmentStatus(row.status)) return [];

      return [
        {
          effectiveFrom: row.effective_from,
          effectiveTo: row.effective_to,
          endReason: row.end_reason,
          enrollmentId: row.id,
          fullName: student.full_name,
          publicCode: student.public_code,
          registeredMode: row.registered_mode === "online" ? "online" : "offline",
          resumedElsewhere: resumedElsewhere.has(row.id),
          status: row.status,
          studentId: row.student_id,
        },
      ];
    }),
  );
}

/**
 * Reserved enrolments a later enrolment in another class resumed:
 * resume_student_enrollment inserts the successor (supersedes_enrollment_id)
 * and leaves the reserved row unchanged. `null` = the read failed.
 */
async function loadResumedElsewhere(supabase: SupabaseClient, classId: string, reservedIds: readonly string[]): Promise<Set<string> | null> {
  if (reservedIds.length === 0) return new Set();

  const successors = await fetchChunked(reservedIds, (ids) =>
    fetchPaged<{ class_id: string; supersedes_enrollment_id: string | null }>((from, to) =>
      supabase
        .from("student_enrollments")
        .select("class_id, supersedes_enrollment_id")
        .in("supersedes_enrollment_id", ids)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );

  if (!successors) return null;

  return new Set(
    successors
      .filter((row) => row.class_id !== classId && row.supersedes_enrollment_id)
      .map((row) => row.supersedes_enrollment_id as string),
  );
}

async function loadBalances(supabase: SupabaseClient, studentIds: readonly string[]): Promise<Record<string, number> | null> {
  const rows = await fetchChunked(studentIds, (ids) =>
    fetchPaged<{ balance_sessions: number | null; student_id: string | null }>((from, to) =>
      supabase
        .from("student_session_balances")
        .select("student_id, balance_sessions")
        .in("student_id", ids)
        .order("student_id", { ascending: true })
        .range(from, to),
    ),
  );

  if (!rows) return null;

  const balances: Record<string, number> = {};
  for (const row of rows) {
    if (row.student_id) balances[row.student_id] = Number(row.balance_sessions ?? 0);
  }
  return balances;
}

/** Open debt per student; `{}` without students. */
async function loadDebt(supabase: SupabaseClient, studentIds: readonly string[]): Promise<Record<string, ClassStudentDebt> | null> {
  if (studentIds.length === 0) return {};

  const rows = await fetchChunked(studentIds, (ids) =>
    fetchPaged<Parameters<typeof summarizeDirectoryDebt>[0][number]>((from, to) =>
      supabase
        .from("student_payment_requests")
        .select("student_id, status, expected_amount_vnd, paid_amount_vnd, created_at")
        .in("student_id", ids)
        .in("status", ["pending", "partially_paid"])
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );

  return rows ? summarizeDirectoryDebt(rows) : null;
}

type SessionsResult = NonNullable<Awaited<ReturnType<typeof loadSessions>>>;

interface SessionFeedReads {
  /** `undefined` = not read (no permission); `null` = the read failed. */
  attendance: AttendanceEntry[] | null | undefined;
  results: ClassResultEntry[] | null | undefined;
  rows: ClassSessionRow[];
}

/**
 * Fills the session-based feeds (sessions, attendance, results, streaks) of
 * `workspace` and hands back the raw reads the results matrix is built from.
 */
async function fillSessionFeeds(
  supabase: SupabaseClient,
  classId: string,
  permissions: ClassDetailWorkspacePermissions,
  sessionsResult: SessionsResult,
  workspace: ClassDetailWorkspace,
): Promise<SessionFeedReads> {
  // Attendance, rosters and results matter for sessions that have started; an
  // overdue "scheduled" session has none and shows "—".
  const startedRows = sessionsResult.rows.filter((row) => row.status === "in_progress" || row.status === "completed");
  const startedIds = startedRows.map((row) => row.id);
  const lockedIds = new Set(startedRows.filter((row) => row.lockedAt).map((row) => row.id));
  // Roster priority under the cap: sessions in progress first, newest first
  // (teachers are marking them right now, so a backlog of pending-lock sessions
  // must not hide their roster); then pending-lock (completed, unlocked)
  // sessions oldest first, because the overview's needs-action list shows the
  // oldest of those.
  const unlockedRows = startedRows.filter((row) => !row.lockedAt);
  const openIds = [
    ...unlockedRows.filter((row) => row.status === "in_progress").sort((a, b) => compareSessions(b, a)),
    ...unlockedRows.filter((row) => row.status === "completed").sort(compareSessions),
  ]
    .slice(0, OPEN_ROSTER_LIMIT)
    .map((row) => row.id);
  // A component session's roster also holds students enrolled only in the
  // component class; on the parent's page only the parent's students count.
  const ownSessionIds = new Set(sessionsResult.rows.filter((row) => row.classId === classId).map((row) => row.id));
  const hasLockedComponentSessions = [...lockedIds].some((id) => !ownSessionIds.has(id));

  const [openRosters, attendance, results, classEnrollmentIds] = await Promise.all([
    permissions.canViewAttendance ? loadOpenRosters(supabase, openIds) : Promise.resolve(undefined),
    permissions.canViewAttendance ? loadAttendance(supabase, startedIds) : Promise.resolve(undefined),
    permissions.canViewResults ? loadResults(supabase, startedIds) : Promise.resolve(undefined),
    // Locked rosters come from attendance, whose rows carry only the enrolment id.
    permissions.canViewAttendance && hasLockedComponentSessions ? loadClassEnrollmentIds(supabase, classId) : Promise.resolve(new Set<string>()),
  ]);

  const rosters =
    openRosters && attendance && classEnrollmentIds
      ? [
          ...openRosters.entries
            .filter((entry) => ownSessionIds.has(entry.class_session_id) || entry.enrollment_class_id === classId)
            .map(({ class_session_id, student_id }) => ({ class_session_id, student_id })),
          ...getLockedSessionRosters(
            lockedIds,
            attendance.filter(
              (entry) =>
                ownSessionIds.has(entry.class_session_id) ||
                (entry.student_enrollment_id != null && classEnrollmentIds.has(entry.student_enrollment_id)),
            ),
          ),
        ]
      : null;
  const rosterCounts = new Map<string, number>();
  for (const entry of rosters ?? []) rosterCounts.set(entry.class_session_id, (rosterCounts.get(entry.class_session_id) ?? 0) + 1);
  const tallies = rosters && attendance ? tallyClassSessionAttendance(rosters, attendance) : null;
  const resolved = new Set([...lockedIds, ...openIds.filter((id) => !openRosters?.failedIds.has(id))]);
  const started = new Set(startedIds);
  // Once a session's roster is resolved, its results count only the students
  // its tally counts (roster plus additional_study walk-ins), so a withdrawn
  // student's result (open rosters hold only active enrolments) or a component
  // session's other students never push the count past the roster. An own
  // session whose roster is unknown (beyond OPEN_ROSTER_LIMIT, no attendance
  // permission, or a failed read) counts every result: there is no roster
  // denominator to exceed. A component session with an unknown roster gets no
  // count rather than an unfiltered one.
  const talliedStudents = rosters && attendance ? getTalliedStudents(rosters, attendance) : null;
  const hasResolvedRoster = (id: string) => resolved.has(id) && talliedStudents !== null;
  const resultCounts = new Map<string, number>();
  for (const entry of results ?? []) {
    const id = entry.class_session_id;
    const counted = hasResolvedRoster(id) ? Boolean(talliedStudents?.get(id)?.has(entry.student_id)) : ownSessionIds.has(id);
    if (counted) resultCounts.set(id, (resultCounts.get(id) ?? 0) + 1);
  }
  const getResultCount = (id: string): number | null => {
    if (!started.has(id) || !results) return null;
    return hasResolvedRoster(id) || ownSessionIds.has(id) ? resultCounts.get(id) ?? 0 : null;
  };

  const rows = orderClassSessions(
    sessionsResult.rows.map((row) => ({
      ...row,
      attendance: resolved.has(row.id) && tallies ? tallies.get(row.id) ?? { absent: 0, additional: 0, present: 0, unmarked: 0 } : null,
      resultCount: getResultCount(row.id),
      rosterCount: resolved.has(row.id) && rosters ? rosterCounts.get(row.id) ?? 0 : null,
    })),
  );

  workspace.sessions = { status: "ready", value: { rows, truncated: sessionsResult.truncated } };

  if (permissions.canViewAttendance) {
    workspace.attendance = tallies ? { status: "ready", value: true } : failed;
  }

  if (permissions.canViewResults) {
    workspace.results = results ? { status: "ready", value: true } : failed;
  }

  if (permissions.canViewAttendance && permissions.canViewStudents) {
    // Without rosters (no attendance read) streaks fall back to the marks alone.
    workspace.absenceStreaks =
      attendance && workspace.students.status === "ready"
        ? {
            status: "ready",
            value: findAbsenceStreaks(workspace.students.value, rows, attendance, { rosters: rosters ?? undefined, today: getVietnamToday() }),
          }
        : failed;
  }

  return { attendance, results, rows };
}

/**
 * Everything the class workspace shows beyond the class record itself. Each feed
 * is gated by its own permission and fails on its own: a TA without payments.view
 * still sees sessions and attendance.
 */
export async function getClassDetailWorkspace(
  classId: string,
  permissions: ClassDetailWorkspacePermissions,
): Promise<ClassDetailWorkspace> {
  const workspace: ClassDetailWorkspace = { ...forbiddenClassDetailWorkspace };

  let supabase: SupabaseClient;

  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return unavailableWorkspace(permissions);
  }

  try {
    const [sessionsResult, studentsResult, enrollments] = await Promise.all([
      permissions.canViewSessions ? loadSessions(supabase, classId) : Promise.resolve(undefined),
      loadActiveStudents(supabase, classId, permissions.canViewStudents),
      permissions.canViewStudents ? loadClassEnrollments(supabase, classId).catch(() => null) : Promise.resolve(undefined),
    ]);

    if (studentsResult === null) {
      workspace.students = permissions.canViewStudents ? failed : forbidden;
      workspace.debt = permissions.canViewPayments ? failed : forbidden;
    } else if (studentsResult.students) {
      workspace.students = { status: "ready", value: studentsResult.students };
    }

    if (permissions.canViewStudents) {
      workspace.enrollments = enrollments ? { status: "ready", value: enrollments } : failed;
      if (!enrollments) {
        if (permissions.canViewLedger) workspace.balances = failed;
        if (permissions.canViewPayments) workspace.studentDebts = failed;
      }
    }

    // Debt covers active students for the overview and, on the students tab,
    // everyone who was enrolled (a reserved student can still owe tuition).
    const activeIds = studentsResult?.ids ?? [];
    const enrolledIds = [...new Set([...activeIds, ...(enrollments ?? []).map((row) => row.studentId)])];

    // Debt and balances run alongside the session reads; a throw there is a failed read.
    // The students tab's debt only needs the roster, so it does not wait on the active read.
    const debt =
      (studentsResult || enrollments) && permissions.canViewPayments ? loadDebt(supabase, enrolledIds).catch(() => null) : undefined;
    const balances =
      enrollments && permissions.canViewLedger ? loadBalances(supabase, enrolledIds).catch(() => null) : undefined;

    let reads: SessionFeedReads | undefined;

    if (sessionsResult === null) {
      workspace.sessions = failed;
      if (permissions.canViewAttendance) workspace.attendance = failed;
      if (permissions.canViewResults) workspace.results = failed;
      if (permissions.canViewAttendance && permissions.canViewStudents) workspace.absenceStreaks = failed;
      if (permissions.canViewResults && permissions.canViewStudents) workspace.resultMatrix = failed;
    } else if (sessionsResult !== undefined) {
      reads = await fillSessionFeeds(supabase, classId, permissions, sessionsResult, workspace);
    }

    if (reads && permissions.canViewResults && permissions.canViewStudents) {
      workspace.resultMatrix =
        reads.results && workspace.students.status === "ready" && enrollments
          ? {
              status: "ready",
              value: buildClassResultMatrix({
                activeStudents: workspace.students.value,
                // A failed attendance read leaves the matrix without "missing" cells, never with wrong ones.
                attendance: reads.attendance ?? null,
                enrollments,
                results: reads.results,
                sessions: reads.rows,
              }),
            }
          : failed;
    }

    if (debt) {
      const value = await debt;
      const activeSet = new Set(activeIds);
      // Without the active read the overview's total is unknown (already marked failed above).
      if (studentsResult) {
        workspace.debt = value
          ? { status: "ready", value: summarizeClassDebt(Object.fromEntries(Object.entries(value).filter(([id]) => activeSet.has(id)))) }
          : failed;
      }
      if (permissions.canViewStudents && enrollments) workspace.studentDebts = value ? { status: "ready", value } : failed;
    }

    if (balances) {
      const value = await balances;
      workspace.balances = value ? { status: "ready", value } : failed;
    }

    return workspace;
  } catch {
    // Keep what already loaded; everything else permitted is failed.
    const ready = Object.fromEntries(Object.entries(workspace).filter(([, feed]) => feed.status === "ready"));
    return { ...unavailableWorkspace(permissions), ...ready };
  }
}

export interface ClassEnrollmentCandidate {
  fullName: string;
  grade: number;
  id: string;
  lifecycleStatus: string;
  publicCode: string;
  registeredMode: string | null;
}

/** Candidates shown in the enroll dialog; the RPC accepts only students without enrollment history. */
export const ENROLLMENT_CANDIDATE_LIMIT = 500;
/** Matches returned by one enroll-dialog search. */
export const ENROLLMENT_SEARCH_LIMIT = 50;

/**
 * `ilike` value for a PostgREST `or()` filter matching `input` anywhere. LIKE
 * wildcards (`%`, `_`, `\`) are escaped so they match literally, and the value is
 * double-quoted (with `"` and `\` escaped) so `,`, `(`, `)` cannot end the filter.
 * PostgREST still reads `*` as `%`; that only widens the match.
 */
export function toContainsFilterValue(input: string): string {
  const pattern = `%${input.replace(/[\\%_]/g, "\\$&")}%`;
  return `"${pattern.replace(/[\\"]/g, "\\$&")}"`;
}

async function queryEnrollmentCandidates(
  search: string | null,
  limit: number,
): Promise<{ candidates: ClassEnrollmentCandidate[]; truncated: boolean } | null> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("students")
      .select("id, full_name, public_code, current_grade, lifecycle_status, registered_mode, student_enrollments!left ( id )")
      .is("student_enrollments", null);

    if (search) {
      const value = toContainsFilterValue(search);
      query = query.or(`full_name.ilike.${value},public_code.ilike.${value}`);
    }

    const { data, error } = await query.order("full_name", { ascending: true }).limit(limit + 1);

    if (error) return null;

    const rows = data ?? [];

    return {
      candidates: sortByStudentName(rows.slice(0, limit), (row) => row.full_name).map((row) => ({
        fullName: row.full_name,
        grade: row.current_grade,
        id: row.id,
        lifecycleStatus: row.lifecycle_status,
        publicCode: row.public_code,
        registeredMode: row.registered_mode,
      })),
      truncated: rows.length > limit,
    };
  } catch {
    return null;
  }
}

/**
 * Students who were never enrolled anywhere, the only ones enroll_student_in_class
 * accepts (others transfer or resume from their profile). `null` = query failed.
 */
export async function getClassEnrollmentCandidates(): Promise<{ candidates: ClassEnrollmentCandidate[]; truncated: boolean } | null> {
  return queryEnrollmentCandidates(null, ENROLLMENT_CANDIDATE_LIMIT);
}

/**
 * Never-enrolled students whose name or public code contains `query`, at most
 * ENROLLMENT_SEARCH_LIMIT. A blank query returns the initial list. The caller
 * checks permissions. `null` = query failed.
 */
export async function searchClassEnrollmentCandidates(
  query: string,
): Promise<{ candidates: ClassEnrollmentCandidate[]; truncated: boolean } | null> {
  const search = query.trim().slice(0, ENROLLMENT_SEARCH_MAX_LENGTH);

  return search ? queryEnrollmentCandidates(search, ENROLLMENT_SEARCH_LIMIT) : getClassEnrollmentCandidates();
}
