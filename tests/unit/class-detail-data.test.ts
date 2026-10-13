// Value: protects=the class workspace loader reads only permitted feeds, includes component-class sessions, ties attendance to the resolved roster, fails a feed on its own (a failed attendance read does not hide sessions), and offers enrolment only to students without enrolment history;
// fails_when=payments are queried without payments.view, a composite class misses its component sessions, a roster RPC failure is shown as 0/0 attendance, a paged attendance error yields partial tallies, or the candidate query stops filtering on missing enrolments;
// why_new=class-detail-data is new and server-only; Supabase is mockable at its client boundary;
// seam=none; no_claim=does not prove PostgREST accepts the embedded anti-join or that RLS returns these rows
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: supabase.from, rpc: supabase.rpc })),
}));

import { getClassDetailWorkspace, getClassEnrollmentCandidates } from "@/features/classes/detail/class-detail-data";

type Result = { data: unknown; error: unknown };

/** Chainable PostgREST stand-in; records filter calls so tests can assert them. */
function query(result: Result, calls: Array<[string, unknown[]]>) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "or", "gte", "lte", "order", "limit", "range"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    });
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function tables(results: Record<string, Result>) {
  const calls: Record<string, Array<[string, unknown[]]>> = {};
  supabase.from.mockImplementation((table: string) => {
    const result = results[table];
    if (!result) throw new Error(`Unexpected table query: ${table}`);
    calls[table] ??= [];
    return query(result, calls[table]);
  });
  return calls;
}

const allowed = { canViewAttendance: true, canViewPayments: true, canViewResults: true, canViewSessions: true, canViewStudents: true };

const sessionRow = (id: string, date: string, status: string, classId = "class-1") => ({
  class: { code: classId === "class-1" ? "L-9A" : "L-9A-T" },
  class_id: classId,
  component_code: null,
  end_time: "21:30:00",
  id,
  learning_mode: "offline",
  locked_at: null,
  room_name: "P.101",
  session_date: date,
  session_kind: "regular",
  start_time: "19:30:00",
  status,
});

beforeEach(() => {
  supabase.from.mockReset();
  supabase.rpc.mockReset();
});

describe("getClassDetailWorkspace", () => {
  it("reads nothing beyond enrolments for a viewer without feed permissions", async () => {
    const calls = tables({ student_enrollments: { data: [{ student_id: "a" }], error: null } });

    const workspace = await getClassDetailWorkspace("class-1", {
      canViewAttendance: false,
      canViewPayments: false,
      canViewResults: false,
      canViewSessions: false,
      canViewStudents: false,
    });

    expect(Object.keys(calls)).toEqual(["student_enrollments"]);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(workspace.sessions).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(workspace.debt).toEqual({ reason: "forbidden", status: "unavailable" });
  });

  it("includes component-class sessions and tallies attendance against the roster", async () => {
    const calls = tables({
      class_component_links: { data: [{ component_class_id: "class-1-t" }], error: null },
      class_sessions: {
        data: [
          sessionRow("s3", "2026-10-15", "scheduled"),
          sessionRow("s2", "2026-10-12", "completed", "class-1-t"),
          { ...sessionRow("s1", "2026-10-09", "completed"), locked_at: "2026-10-10T00:00:00Z" },
          sessionRow("s0", "2026-10-07", "scheduled"),
        ],
        error: null,
      },
      session_attendance: {
        data: [
          { attendance_status: "present", class_session_id: "s2", student_id: "a" },
          { attendance_status: "unexcused_absence", class_session_id: "s2", student_id: "b" },
          { attendance_status: "present", class_session_id: "s1", student_id: "a" },
          { attendance_status: "excused_absence", class_session_id: "s1", student_id: "b" },
          { attendance_status: "additional_study", class_session_id: "s1", student_id: "walk-in" },
        ],
        error: null,
      },
      session_results: { data: [{ class_session_id: "s2" }], error: null },
      student_enrollments: {
        data: [
          { student: { full_name: "Bảo", id: "b", public_code: "HS2" }, student_id: "b" },
          { student: { full_name: "An", id: "a", public_code: "HS1" }, student_id: "a" },
        ],
        error: null,
      },
      student_payment_requests: {
        data: [{ created_at: "2026-10-10T00:00:00Z", expected_amount_vnd: "1200000", paid_amount_vnd: "200000", status: "pending", student_id: "a" }],
        error: null,
      },
    });
    supabase.rpc.mockResolvedValue({
      data: [{ student_id: "a" }, { student_id: "b" }, { student_id: "c" }],
      error: null,
    });

    const workspace = await getClassDetailWorkspace("class-1", allowed);

    expect(calls.class_sessions).toContainEqual(["in", ["class_id", ["class-1", "class-1-t"]]]);
    // Only the unlocked started session needs the per-session roster RPC.
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("resolve_class_session_roster", { p_class_session_id: "s2" });
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    const byId = Object.fromEntries(workspace.sessions.value.rows.map((row) => [row.id, row]));
    expect(byId.s2).toMatchObject({ attendance: { absent: 1, additional: 0, present: 1, unmarked: 1 }, classCode: "L-9A-T", resultCount: 1, rosterCount: 3 });
    // A locked session's roster is its present/absent students; the walk-in stays additional.
    expect(byId.s1).toMatchObject({ attendance: { absent: 1, additional: 1, present: 1, unmarked: 0 }, rosterCount: 2 });
    // Future and overdue scheduled sessions carry no attendance.
    expect(byId.s3).toMatchObject({ attendance: null, resultCount: null, rosterCount: null });
    expect(byId.s0).toMatchObject({ attendance: null, ordinal: 1, rosterCount: null });
    expect(workspace.students).toEqual({
      status: "ready",
      value: [
        { fullName: "An", id: "a", publicCode: "HS1" },
        { fullName: "Bảo", id: "b", publicCode: "HS2" },
      ],
    });
    expect(workspace.debt).toEqual({ status: "ready", value: { outstandingVnd: 1_000_000, overdueStudentCount: 0, studentCount: 1 } });
  });

  it("fails attendance on its own when the roster RPC fails, keeping sessions", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [sessionRow("s1", "2026-10-12", "completed")], error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(workspace.sessions.status).toBe("ready");
    expect(workspace.attendance).toEqual({ reason: "failed", status: "unavailable" });
    // Streaks read attendance rows directly, so they survive a roster failure.
    expect(workspace.absenceStreaks).toEqual({ status: "ready", value: [] });
    if (workspace.sessions.status === "ready") {
      expect(workspace.sessions.value.rows[0]).toMatchObject({ attendance: null, rosterCount: null });
    }
  });

  it("reports the sessions feed as failed when the session query errors", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: null, error: { message: "denied" } },
      student_enrollments: { data: [], error: null },
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(workspace.sessions).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.attendance).toEqual({ reason: "failed", status: "unavailable" });
  });
});

describe("getClassEnrollmentCandidates", () => {
  it("asks only for students without any enrolment and maps them", async () => {
    const calls = tables({
      students: {
        data: [{ current_grade: 9, full_name: "Ngọc", id: "s-1", lifecycle_status: "trial", public_code: "HS1", registered_mode: "online", student_enrollments: [] }],
        error: null,
      },
    });

    await expect(getClassEnrollmentCandidates()).resolves.toEqual({
      candidates: [{ fullName: "Ngọc", grade: 9, id: "s-1", lifecycleStatus: "trial", publicCode: "HS1", registeredMode: "online" }],
      truncated: false,
    });
    expect(calls.students).toContainEqual(["is", ["student_enrollments", null]]);

    tables({ students: { data: null, error: { message: "denied" } } });
    await expect(getClassEnrollmentCandidates()).resolves.toBeNull();
  });
});
