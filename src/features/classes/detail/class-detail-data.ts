import "server-only";

import {
  findAbsenceStreaks,
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
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Sessions read per class; a school year of three sessions a week fits well inside. */
export const CLASS_SESSION_LIMIT = 400;
/** PostgREST returns at most this many rows per request; bigger reads are paged. */
const PAGE_SIZE = 1000;
/** Hard stop for paged reads (attendance of ~400 sessions × 25 students). */
const MAX_PAGES = 12;

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

/** The class plus its component classes: composite classes hold sessions on components. */
async function getSessionClassIds(supabase: SupabaseClient, classId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("class_component_links")
    .select("component_class_id")
    .eq("parent_class_id", classId);

  if (error) return null;

  return [classId, ...new Set((data ?? []).map((link) => link.component_class_id))];
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
  const classIds = await getSessionClassIds(supabase, classId);

  if (!classIds) return null;

  const { data, error } = await supabase
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
    .in("class_id", classIds)
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
          (sessionStatuses as readonly string[]).includes(row.status),
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

/** Unlocked started sessions whose roster is resolved one RPC at a time. */
export const OPEN_ROSTER_LIMIT = 40;
const ROSTER_CONCURRENCY = 8;

/**
 * Rosters of started sessions that are not locked yet, through the per-session
 * RPC (the batch variant is internal-only). Locked sessions need no call: the
 * lock requires every roster student to be present or absent, and only roster
 * students may hold those statuses, so their roster is read off the attendance.
 */
async function loadOpenRosters(supabase: SupabaseClient, sessionIds: readonly string[]): Promise<RosterEntry[] | null> {
  const entries: RosterEntry[] = [];

  for (const ids of chunk(sessionIds, ROSTER_CONCURRENCY)) {
    const results = await Promise.all(
      ids.map(async (id) => ({ id, result: await supabase.rpc("resolve_class_session_roster", { p_class_session_id: id }) })),
    );

    for (const { id, result } of results) {
      if (result.error) return null;
      entries.push(...(result.data ?? []).map((row) => ({ class_session_id: id, student_id: row.student_id })));
    }
  }

  return entries;
}

/** Roster of a locked session = its students marked present or absent. */
export function getLockedSessionRosters(lockedIds: ReadonlySet<string>, attendance: readonly AttendanceEntry[]): RosterEntry[] {
  return attendance
    .filter(
      (entry) =>
        lockedIds.has(entry.class_session_id) &&
        (entry.attendance_status === "present" ||
          entry.attendance_status === "excused_absence" ||
          entry.attendance_status === "unexcused_absence"),
    )
    .map((entry) => ({ class_session_id: entry.class_session_id, student_id: entry.student_id }));
}

async function loadAttendance(supabase: SupabaseClient, sessionIds: readonly string[]): Promise<AttendanceEntry[] | null> {
  const entries: AttendanceEntry[] = [];

  for (const ids of chunk(sessionIds, 150)) {
    const rows = await fetchPaged<AttendanceEntry>((from, to) =>
      supabase
        .from("session_attendance")
        .select("class_session_id, student_id, attendance_status")
        .in("class_session_id", ids)
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (!rows) return null;
    entries.push(...rows);
  }

  return entries;
}

async function loadResultCounts(supabase: SupabaseClient, sessionIds: readonly string[]): Promise<Map<string, number> | null> {
  const counts = new Map<string, number>();

  for (const ids of chunk(sessionIds, 150)) {
    const rows = await fetchPaged<{ class_session_id: string }>((from, to) =>
      supabase
        .from("session_results")
        .select("class_session_id")
        .in("class_session_id", ids)
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (!rows) return null;
    for (const row of rows) counts.set(row.class_session_id, (counts.get(row.class_session_id) ?? 0) + 1);
  }

  return counts;
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

  const rows: Parameters<typeof summarizeDirectoryDebt>[0][number][] = [];

  for (const ids of chunk(studentIds, 150)) {
    const page = await fetchPaged<Parameters<typeof summarizeDirectoryDebt>[0][number]>((from, to) =>
      supabase
        .from("student_payment_requests")
        .select("student_id, status, expected_amount_vnd, paid_amount_vnd, created_at")
        .in("student_id", ids)
        .in("status", ["pending", "partially_paid"])
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (!page) return null;
    rows.push(...page);
  }

  return summarizeClassDebt(summarizeDirectoryDebt(rows));
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
  const workspace: ClassDetailWorkspace = {
    absenceStreaks: forbidden,
    attendance: forbidden,
    debt: forbidden,
    results: forbidden,
    sessions: forbidden,
    students: forbidden,
  };

  let supabase: SupabaseClient;

  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return {
      absenceStreaks: permissions.canViewSessions && permissions.canViewAttendance && permissions.canViewStudents ? failed : forbidden,
      attendance: permissions.canViewSessions && permissions.canViewAttendance ? failed : forbidden,
      debt: permissions.canViewPayments ? failed : forbidden,
      results: permissions.canViewSessions && permissions.canViewResults ? failed : forbidden,
      sessions: permissions.canViewSessions ? failed : forbidden,
      students: permissions.canViewStudents ? failed : forbidden,
    };
  }

  try {
    const [sessionsResult, studentsResult] = await Promise.all([
      permissions.canViewSessions ? loadSessions(supabase, classId) : Promise.resolve(undefined),
      loadActiveStudents(supabase, classId, permissions.canViewStudents),
    ]);

    if (studentsResult === null) {
      workspace.students = permissions.canViewStudents ? failed : forbidden;
      workspace.debt = permissions.canViewPayments ? failed : forbidden;
    } else {
      if (studentsResult.students) workspace.students = { status: "ready", value: studentsResult.students };
      if (permissions.canViewPayments) {
        const debt = await loadDebt(supabase, studentsResult.ids);
        workspace.debt = debt ? { status: "ready", value: debt } : failed;
      }
    }

    if (sessionsResult === undefined) {
      return workspace;
    }

    if (sessionsResult === null) {
      workspace.sessions = failed;
      if (permissions.canViewAttendance) workspace.attendance = failed;
      if (permissions.canViewResults) workspace.results = failed;
      if (permissions.canViewAttendance && permissions.canViewStudents) workspace.absenceStreaks = failed;
      return workspace;
    }

    // Attendance, rosters and results matter for sessions that have started; an
    // overdue "scheduled" session has none and shows "—".
    const startedRows = sessionsResult.rows.filter((row) => row.status === "in_progress" || row.status === "completed");
    const startedIds = startedRows.map((row) => row.id);
    const lockedIds = new Set(startedRows.filter((row) => row.lockedAt).map((row) => row.id));
    // Newest first, so the cap keeps the sessions the team is working on.
    const openIds = startedRows
      .filter((row) => !row.lockedAt)
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
      .slice(0, OPEN_ROSTER_LIMIT)
      .map((row) => row.id);

    const [openRosters, attendance, resultCounts] = await Promise.all([
      permissions.canViewAttendance ? loadOpenRosters(supabase, openIds) : Promise.resolve(undefined),
      permissions.canViewAttendance ? loadAttendance(supabase, startedIds) : Promise.resolve(undefined),
      permissions.canViewResults ? loadResultCounts(supabase, startedIds) : Promise.resolve(undefined),
    ]);

    const rosters = openRosters && attendance ? [...openRosters, ...getLockedSessionRosters(lockedIds, attendance)] : null;
    const rosterCounts = new Map<string, number>();
    for (const entry of rosters ?? []) rosterCounts.set(entry.class_session_id, (rosterCounts.get(entry.class_session_id) ?? 0) + 1);
    const tallies = rosters && attendance ? tallyClassSessionAttendance(rosters, attendance) : null;
    const resolved = new Set([...lockedIds, ...openIds]);
    const started = new Set(startedIds);

    const rows = orderClassSessions(
      sessionsResult.rows.map((row) => ({
        ...row,
        attendance: resolved.has(row.id) && tallies ? tallies.get(row.id) ?? { absent: 0, additional: 0, present: 0, unmarked: 0 } : null,
        resultCount: started.has(row.id) && resultCounts ? resultCounts.get(row.id) ?? 0 : null,
        rosterCount: resolved.has(row.id) && rosters ? rosterCounts.get(row.id) ?? 0 : null,
      })),
    );

    workspace.sessions = { status: "ready", value: { rows, truncated: sessionsResult.truncated } };

    if (permissions.canViewAttendance) {
      workspace.attendance = tallies ? { status: "ready", value: true } : failed;
    }

    if (permissions.canViewResults) {
      workspace.results = resultCounts ? { status: "ready", value: true } : failed;
    }

    if (permissions.canViewAttendance && permissions.canViewStudents) {
      workspace.absenceStreaks =
        attendance && workspace.students.status === "ready"
          ? { status: "ready", value: findAbsenceStreaks(workspace.students.value, rows, attendance) }
          : failed;
    }

    return workspace;
  } catch {
    return {
      ...workspace,
      sessions: permissions.canViewSessions && workspace.sessions.status !== "ready" ? failed : workspace.sessions,
    };
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

/**
 * Students who were never enrolled anywhere, the only ones enroll_student_in_class
 * accepts (others transfer or resume from their profile). `null` = query failed.
 */
export async function getClassEnrollmentCandidates(): Promise<{ candidates: ClassEnrollmentCandidate[]; truncated: boolean } | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name, public_code, current_grade, lifecycle_status, registered_mode, student_enrollments!left ( id )")
      .is("student_enrollments", null)
      .order("full_name", { ascending: true })
      .limit(ENROLLMENT_CANDIDATE_LIMIT + 1);

    if (error) return null;

    const rows = data ?? [];

    return {
      candidates: rows.slice(0, ENROLLMENT_CANDIDATE_LIMIT).map((row) => ({
        fullName: row.full_name,
        grade: row.current_grade,
        id: row.id,
        lifecycleStatus: row.lifecycle_status,
        publicCode: row.public_code,
        registeredMode: row.registered_mode,
      })),
      truncated: rows.length > ENROLLMENT_CANDIDATE_LIMIT,
    };
  } catch {
    return null;
  }
}
