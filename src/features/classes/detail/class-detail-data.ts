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
import type { SessionKind, SessionStatus } from "@/features/sessions/read-models";
import { summarizeDirectoryDebt } from "@/features/students/student-directory-metrics";
import { getVietnamToday } from "@/lib/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** PostgREST returns at most this many rows per request; bigger reads are paged. */
const PAGE_SIZE = 1000;
/** Hard stop for paged reads (attendance of ~400 sessions × 25 students). */
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
}

const forbidden = { reason: "forbidden", status: "unavailable" } as const;
const failed = { reason: "failed", status: "unavailable" } as const;

/** Every feed the viewer may read is `failed`, the rest `forbidden`. */
function unavailableWorkspace(permissions: ClassDetailWorkspacePermissions): ClassDetailWorkspace {
  return {
    absenceStreaks: permissions.canViewSessions && permissions.canViewAttendance && permissions.canViewStudents ? failed : forbidden,
    attendance: permissions.canViewSessions && permissions.canViewAttendance ? failed : forbidden,
    debt: permissions.canViewPayments ? failed : forbidden,
    results: permissions.canViewSessions && permissions.canViewResults ? failed : forbidden,
    sessions: permissions.canViewSessions ? failed : forbidden,
    students: permissions.canViewStudents ? failed : forbidden,
  };
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function fetchPaged<T>(
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
 * resolve_class_session_rosters applies).
 */
async function getSessionClassIds(
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
 */
async function loadOpenRosters(
  supabase: SupabaseClient,
  sessionIds: readonly string[],
): Promise<Array<RosterEntry & { enrollment_class_id: string }> | null> {
  const entries: Array<RosterEntry & { enrollment_class_id: string }> = [];

  for (const ids of chunk(sessionIds, ROSTER_CONCURRENCY)) {
    const results = await Promise.all(
      ids.map(async (id) => ({ id, result: await supabase.rpc("resolve_class_session_roster", { p_class_session_id: id }) })),
    );

    for (const { id, result } of results) {
      if (result.error) return null;
      entries.push(
        ...(result.data ?? []).map((row) => ({ class_session_id: id, enrollment_class_id: row.enrollment_class_id, student_id: row.student_id })),
      );
    }
  }

  return entries;
}

/** Roster of a locked session = its students marked present or absent. */
export function getLockedSessionRosters(lockedIds: ReadonlySet<string>, attendance: readonly AttendanceEntry[]): RosterEntry[] {
  return attendance
    .filter((entry) => lockedIds.has(entry.class_session_id) && isLockCountedAttendanceStatus(entry.attendance_status))
    .map((entry) => ({ class_session_id: entry.class_session_id, student_id: entry.student_id }));
}

/** Runs one paged read per id chunk in parallel; `null` when any chunk fails. */
async function fetchChunked<T>(ids: readonly string[], load: (chunkIds: string[]) => Promise<T[] | null>): Promise<T[] | null> {
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

interface ResultEntry {
  class_session_id: string;
  student_id: string;
}

async function loadResults(supabase: SupabaseClient, sessionIds: readonly string[]): Promise<ResultEntry[] | null> {
  return fetchChunked(sessionIds, (ids) =>
    fetchPaged<ResultEntry>((from, to) =>
      supabase
        .from("session_results")
        .select("class_session_id, student_id")
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
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));

  return { ids, students };
}

async function loadDebt(supabase: SupabaseClient, studentIds: readonly string[]): Promise<ClassDebtSummary | null> {
  if (studentIds.length === 0) return summarizeClassDebt({});

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

  return rows ? summarizeClassDebt(summarizeDirectoryDebt(rows)) : null;
}

type SessionsResult = NonNullable<Awaited<ReturnType<typeof loadSessions>>>;

/** Fills the session-based feeds (sessions, attendance, results, streaks) of `workspace`. */
async function fillSessionFeeds(
  supabase: SupabaseClient,
  classId: string,
  permissions: ClassDetailWorkspacePermissions,
  sessionsResult: SessionsResult,
  workspace: ClassDetailWorkspace,
): Promise<void> {
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
          ...openRosters
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
  const resolved = new Set([...lockedIds, ...openIds]);
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
    // Without rosters (RPC failed) streaks fall back to the marks alone.
    workspace.absenceStreaks =
      attendance && workspace.students.status === "ready"
        ? {
            status: "ready",
            value: findAbsenceStreaks(workspace.students.value, rows, attendance, { rosters: rosters ?? undefined, today: getVietnamToday() }),
          }
        : failed;
  }
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
    const [sessionsResult, studentsResult] = await Promise.all([
      permissions.canViewSessions ? loadSessions(supabase, classId) : Promise.resolve(undefined),
      loadActiveStudents(supabase, classId, permissions.canViewStudents),
    ]);

    if (studentsResult === null) {
      workspace.students = permissions.canViewStudents ? failed : forbidden;
      workspace.debt = permissions.canViewPayments ? failed : forbidden;
    } else if (studentsResult.students) {
      workspace.students = { status: "ready", value: studentsResult.students };
    }

    // Debt runs alongside the session reads; a throw there is a failed read.
    const debt =
      studentsResult && permissions.canViewPayments ? loadDebt(supabase, studentsResult.ids).catch(() => null) : undefined;

    if (sessionsResult === null) {
      workspace.sessions = failed;
      if (permissions.canViewAttendance) workspace.attendance = failed;
      if (permissions.canViewResults) workspace.results = failed;
      if (permissions.canViewAttendance && permissions.canViewStudents) workspace.absenceStreaks = failed;
    } else if (sessionsResult !== undefined) {
      await fillSessionFeeds(supabase, classId, permissions, sessionsResult, workspace);
    }

    if (debt) {
      const value = await debt;
      workspace.debt = value ? { status: "ready", value } : failed;
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
      candidates: rows.slice(0, limit).map((row) => ({
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
