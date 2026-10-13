// Value: protects=the class workspace loader reads only permitted feeds, includes component-class sessions, ties attendance to the resolved roster, fails a feed on its own (a failed attendance read does not hide sessions), and offers enrolment only to students without enrolment history;
// fails_when=payments are queried without payments.view, a composite class misses its component sessions, a roster RPC failure is shown as 0/0 attendance, a paged attendance error yields partial tallies, or the candidate query stops filtering on missing enrolments;
// why_new=class-detail-data is new and server-only; Supabase is mockable at its client boundary;
// seam=none; no_claim=does not prove PostgREST accepts the embedded anti-join or that RLS returns these rows
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: supabase.from, rpc: supabase.rpc })),
}));

import {
  getClassDetailWorkspace,
  getClassEnrollmentCandidates,
  searchClassEnrollmentCandidates,
  toContainsFilterValue,
} from "@/features/classes/detail/class-detail-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { data: unknown; error: unknown };
type Call = [string, unknown[]];
/** A fixed result, or one computed from this request's own calls (e.g. its range). */
type TableResult = Result | ((calls: Call[]) => Result);

/** Chainable PostgREST stand-in; records filter calls so tests can assert them. */
function query(result: TableResult, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  const own: Call[] = [];
  for (const method of ["select", "eq", "in", "is", "or", "gte", "lte", "order", "limit", "range"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      own.push([method, args]);
      return builder;
    });
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(typeof result === "function" ? result(own) : result).then(resolve, reject);
  return builder;
}

function tables(results: Record<string, TableResult>) {
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
      class_component_links: { data: [{ component_class_id: "class-1-t", effective_from: "2026-09-01", effective_to: null }], error: null },
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
      data: [
        { enrollment_class_id: "class-1", student_id: "a" },
        { enrollment_class_id: "class-1", student_id: "b" },
        { enrollment_class_id: "class-1", student_id: "c" },
      ],
      error: null,
    });

    const workspace = await getClassDetailWorkspace("class-1", allowed);

    expect(calls.class_sessions).toContainEqual(["in", ["class_id", ["class-1", "class-1-t"]]]);
    // No locked component session, so no enrolment-id lookup.
    expect(calls.student_enrollments).not.toContainEqual(["select", ["id"]]);
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

  // Value: protects=a TA without payments.view never gets a debt feed marked "failed" (which renders tuition tiles) when the client or the enrolment read fails;
  // fails_when=the failure branches map debt to failed regardless of canViewPayments, or a permitted feed is reported as forbidden instead of failed;
  // why_new=existing tests only cover the session-query failure with payments already off; the client-creation and enrolment-error branches were untested;
  // seam=none; no_claim=does not cover exceptions thrown after enrolments load (the outer catch)
  it("keeps forbidden feeds forbidden when the client or the enrolment read fails", async () => {
    const ta = { ...allowed, canViewPayments: false };
    vi.mocked(createSupabaseServerClient).mockRejectedValueOnce(new Error("cookies unavailable"));

    const noClient = await getClassDetailWorkspace("class-1", ta);

    expect(noClient.debt).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(noClient.sessions).toEqual({ reason: "failed", status: "unavailable" });
    expect(noClient.attendance).toEqual({ reason: "failed", status: "unavailable" });
    expect(noClient.students).toEqual({ reason: "failed", status: "unavailable" });

    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [], error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: null, error: { message: "denied" } },
    });

    const noEnrolments = await getClassDetailWorkspace("class-1", ta);

    expect(noEnrolments.debt).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(noEnrolments.students).toEqual({ reason: "failed", status: "unavailable" });
    expect(supabase.from).not.toHaveBeenCalledWith("student_payment_requests");

    const owner = await getClassDetailWorkspace("class-1", allowed);
    expect(owner.debt).toEqual({ reason: "failed", status: "unavailable" });
  });

  // Value: protects=the per-session roster RPC fan-out stays capped at 40 newest unlocked sessions, 8 in flight at a time;
  // fails_when=the OPEN_ROSTER_LIMIT slice or the chunked concurrency is removed, or the cap keeps the oldest sessions instead of the newest;
  // why_new=existing loader tests use one or two sessions, so neither the cap nor the concurrency limit is exercised;
  // seam=none; no_claim=does not measure real RPC latency or prove the database tolerates 8 concurrent calls
  it("resolves at most 40 open rosters, newest first, 8 at a time", async () => {
    const rows = Array.from({ length: 41 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10);
      return sessionRow(`s${String(index).padStart(2, "0")}`, day, "completed");
    }).reverse();
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: rows, error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });
    let inFlight = 0;
    let maxInFlight = 0;
    supabase.rpc.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return { data: [{ student_id: "a" }], error: null };
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(supabase.rpc).toHaveBeenCalledTimes(40);
    expect(supabase.rpc).not.toHaveBeenCalledWith("resolve_class_session_roster", { p_class_session_id: "s00" });
    expect(maxInFlight).toBe(8);
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    const byId = Object.fromEntries(workspace.sessions.value.rows.map((row) => [row.id, row]));
    // The oldest open session falls outside the cap and shows "—" rather than 0/0.
    expect(byId.s00).toMatchObject({ attendance: null, rosterCount: null });
    expect(byId.s40).toMatchObject({ attendance: { absent: 0, additional: 0, present: 0, unmarked: 1 }, rosterCount: 1 });
  });

  // Value: protects=an exception thrown after the client exists (G1) marks every permitted feed that had not loaded as failed and keeps loaded ones;
  // fails_when=the outer catch resets only sessions, leaving attendance/results/debt "forbidden" for an owner (hiding the error), or reports debt as failed to a TA;
  // why_new=review found the outer catch only reset sessions and no test reached it;
  // seam=none; no_claim=does not cover a throw inside createSupabaseServerClient (covered above)
  it("fails every permitted unfinished feed when a loader throws (G1)", async () => {
    const load = () =>
      tables({
        class_component_links: { data: [], error: null },
        class_sessions: { data: [sessionRow("s1", "2026-10-12", "completed")], error: null },
        session_attendance: { data: [], error: null },
        session_results: { data: [], error: null },
        student_enrollments: { data: [{ student: { full_name: "An", id: "a", public_code: "HS1" }, student_id: "a" }], error: null },
        student_payment_requests: { data: [], error: null },
      });
    load();
    supabase.rpc.mockRejectedValue(new Error("network down"));

    const owner = await getClassDetailWorkspace("class-1", allowed);

    expect(owner.students).toEqual({ status: "ready", value: [{ fullName: "An", id: "a", publicCode: "HS1" }] });
    for (const feed of ["sessions", "attendance", "results", "absenceStreaks", "debt"] as const) {
      expect(owner[feed]).toEqual({ reason: "failed", status: "unavailable" });
    }

    load();
    const ta = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(ta.debt).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(ta.attendance).toEqual({ reason: "failed", status: "unavailable" });
  });

  // Value: protects=a composite parent shows a component's sessions only while a link covers the session date, and always its own sessions;
  // fails_when=effective_from/effective_to are ignored (sessions of a component's earlier or later parent appear) or an open-ended link (effective_to null) drops sessions;
  // why_new=api-contract review found getSessionClassIds ignored the link window that resolve_class_session_rosters applies;
  // seam=none; no_claim=does not prove the window filter keeps the 400-session cap exact (out-of-window rows still count toward the limit)
  it("keeps component sessions only inside a link window", async () => {
    const calls = tables({
      class_component_links: {
        data: [
          { component_class_id: "class-1-t", effective_from: "2026-09-01", effective_to: "2026-09-30" },
          { component_class_id: "class-1-t", effective_from: "2026-10-10", effective_to: null },
        ],
        error: null,
      },
      class_sessions: {
        data: [
          sessionRow("in-open-window", "2026-10-15", "scheduled", "class-1-t"),
          sessionRow("between-windows", "2026-10-05", "scheduled", "class-1-t"),
          sessionRow("in-first-window", "2026-09-30", "scheduled", "class-1-t"),
          sessionRow("before-link", "2026-08-20", "scheduled", "class-1-t"),
          sessionRow("own", "2026-08-01", "scheduled"),
        ],
        error: null,
      },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(calls.class_component_links).toContainEqual(["select", ["component_class_id, effective_from, effective_to"]]);
    expect(calls.class_sessions).toContainEqual(["in", ["class_id", ["class-1", "class-1-t"]]]);
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    expect(workspace.sessions.value.rows.map((row) => row.id)).toEqual(["own", "in-first-window", "in-open-window"]);
  });

  // Value: protects=on a composite parent page, component-session rosters, tallies and roster counts hold only the parent's students, for open (RPC) and locked (attendance-derived) sessions;
  // fails_when=students enrolled only in the component class inflate rosterCount/unmarked or the attendance rate, or the parent's own sessions get filtered;
  // why_new=red-team found component sessions counted the component class's own students on the parent page;
  // seam=none; no_claim=does not cover a student enrolled in both the parent and the component (the RPC then reports the component enrolment)
  it("counts only the page class's students on component sessions", async () => {
    const calls = tables({
      class_component_links: { data: [{ component_class_id: "class-1-t", effective_from: "2026-09-01", effective_to: null }], error: null },
      class_sessions: {
        data: [
          sessionRow("open-component", "2026-10-12", "completed", "class-1-t"),
          { ...sessionRow("locked-component", "2026-10-09", "completed", "class-1-t"), locked_at: "2026-10-10T00:00:00Z" },
          { ...sessionRow("locked-own", "2026-10-08", "completed"), locked_at: "2026-10-09T00:00:00Z" },
        ],
        error: null,
      },
      session_attendance: {
        data: [
          { attendance_status: "present", class_session_id: "open-component", student_enrollment_id: "e-a", student_id: "a" },
          { attendance_status: "present", class_session_id: "open-component", student_enrollment_id: "e-z", student_id: "z" },
          { attendance_status: "present", class_session_id: "locked-component", student_enrollment_id: "e-a", student_id: "a" },
          { attendance_status: "unexcused_absence", class_session_id: "locked-component", student_enrollment_id: "e-z", student_id: "z" },
          { attendance_status: "present", class_session_id: "locked-own", student_enrollment_id: "e-a", student_id: "a" },
          { attendance_status: "excused_absence", class_session_id: "locked-own", student_enrollment_id: "e-old", student_id: "y" },
        ],
        error: null,
      },
      session_results: { data: [], error: null },
      student_enrollments: (own) =>
        own.some(([method, args]) => method === "select" && args[0] === "id")
          ? { data: [{ id: "e-a" }], error: null }
          : { data: [{ student: { full_name: "An", id: "a", public_code: "HS1" }, student_id: "a" }], error: null },
    });
    supabase.rpc.mockResolvedValue({
      data: [
        { enrollment_class_id: "class-1", student_id: "a" },
        { enrollment_class_id: "class-1-t", student_id: "z" },
      ],
      error: null,
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(calls.student_enrollments).toContainEqual(["eq", ["class_id", "class-1"]]);
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    const byId = Object.fromEntries(workspace.sessions.value.rows.map((row) => [row.id, row]));
    expect(byId["open-component"]).toMatchObject({ attendance: { absent: 0, additional: 0, present: 1, unmarked: 0 }, rosterCount: 1 });
    expect(byId["locked-component"]).toMatchObject({ attendance: { absent: 0, additional: 0, present: 1, unmarked: 0 }, rosterCount: 1 });
    // The parent's own session keeps every marked student, as before.
    expect(byId["locked-own"]).toMatchObject({ attendance: { absent: 1, additional: 0, present: 1, unmarked: 0 }, rosterCount: 2 });
  });

  // Value: protects=an attendance read error fails attendance and streaks only; sessions and results still show, with "—" instead of 0/0;
  // fails_when=an attendance error hides sessions or results, or rows carry stale zero tallies;
  // why_new=audit gap: only the roster-RPC failure was tested, not the attendance read itself;
  // seam=none; no_claim=does not cover a partially failing chunk among several (same null path)
  it("fails attendance and streaks on their own when the attendance read errors", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [sessionRow("s1", "2026-10-12", "completed")], error: null },
      session_attendance: { data: null, error: { message: "denied" } },
      session_results: { data: [{ class_session_id: "s1" }], error: null },
      student_enrollments: { data: [], error: null },
    });
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(workspace.attendance).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.absenceStreaks).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.results).toEqual({ status: "ready", value: true });
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    expect(workspace.sessions.value.rows[0]).toMatchObject({ attendance: null, resultCount: 1, rosterCount: null });
  });

  // Value: protects=a results read error fails only the results feed and leaves resultCount null;
  // fails_when=a results error fails sessions or attendance, or rows show 0 results instead of "—";
  // why_new=audit gap: the results failure branch was untested;
  // seam=none; no_claim=does not cover results of sessions that never started (always null)
  it("fails only results when the results read errors", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [sessionRow("s1", "2026-10-12", "completed")], error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: null, error: { message: "denied" } },
      student_enrollments: { data: [], error: null },
    });
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(workspace.results).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.attendance).toEqual({ status: "ready", value: true });
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    expect(workspace.sessions.value.rows[0]).toMatchObject({ resultCount: null, rosterCount: 0 });
  });

  // Value: protects=a link read error fails the sessions feed, while a session row with an unknown status is dropped without failing it;
  // fails_when=a class_component_links error is swallowed (component sessions silently missing) or an unknown status fails the whole feed or leaks through;
  // why_new=audit gap: neither the link error branch nor the unknown-status filter was exercised;
  // seam=none; no_claim=does not cover unknown session kinds (same filter)
  it("fails sessions on a link error and drops unknown statuses otherwise", async () => {
    tables({
      class_component_links: { data: null, error: { message: "denied" } },
      student_enrollments: { data: [], error: null },
    });

    const linkError = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(linkError.sessions).toEqual({ reason: "failed", status: "unavailable" });
    expect(linkError.attendance).toEqual({ reason: "failed", status: "unavailable" });

    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [sessionRow("s1", "2026-10-15", "scheduled"), sessionRow("odd", "2026-10-16", "postponed")], error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });

    const unknown = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(unknown.sessions.status).toBe("ready");
    if (unknown.sessions.status !== "ready") return;
    expect(unknown.sessions.value.rows.map((row) => row.id)).toEqual(["s1"]);
  });

  // Value: protects=paged reads continue past PostgREST's 1000-row page and give up (failed, not partial) after MAX_PAGES;
  // fails_when=fetchPaged stops after the first full page (tallies capped at 1000) or loops without bound / returns a partial tally;
  // why_new=audit gap: every loader test fits in one page;
  // seam=none; no_claim=does not prove PostgREST's max-rows setting is 1000 in production
  it("pages attendance past 1000 rows and fails past the page cap", async () => {
    const lockedSession = { ...sessionRow("s1", "2026-10-12", "completed"), locked_at: "2026-10-13T00:00:00Z" };
    const marks = (from: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({ attendance_status: "present", class_session_id: "s1", student_id: `p${from + index}` }));
    const range = (own: Call[]) => own.find(([method]) => method === "range")?.[1] as [number, number];
    const calls = tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [lockedSession], error: null },
      session_attendance: (own) => ({ data: range(own)[0] === 0 ? marks(0, 1000) : marks(1000, 5), error: null }),
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });

    const paged = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false, canViewStudents: false });

    expect(calls.session_attendance.filter(([method]) => method === "range").map(([, args]) => args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(paged.sessions.status).toBe("ready");
    if (paged.sessions.status !== "ready") return;
    expect(paged.sessions.value.rows[0]).toMatchObject({ attendance: { present: 1005 }, rosterCount: 1005 });

    const endless = tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [lockedSession], error: null },
      session_attendance: (own) => ({ data: marks(range(own)[0], 1000), error: null }),
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });

    const capped = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false, canViewStudents: false });

    expect(endless.session_attendance.filter(([method]) => method === "range")).toHaveLength(12);
    expect(capped.attendance).toEqual({ reason: "failed", status: "unavailable" });
  });

  // Value: protects=a class with more than 400 sessions shows the 400 newest and flags truncation;
  // fails_when=the limit+1 probe or the slice is removed, or truncated stays false;
  // why_new=audit gap: CLASS_SESSION_LIMIT was never exceeded in a test;
  // seam=none; no_claim=does not prove the UI shows the truncation note
  it("caps sessions at 400 and flags truncation", async () => {
    const rows = Array.from({ length: 401 }, (_, index) =>
      sessionRow(`s${index}`, new Date(Date.UTC(2027, 0, 1) - index * 86_400_000).toISOString().slice(0, 10), "scheduled"),
    );
    const calls = tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: rows, error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(calls.class_sessions).toContainEqual(["limit", [401]]);
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    expect(workspace.sessions.value.truncated).toBe(true);
    expect(workspace.sessions.value.rows).toHaveLength(400);
    expect(workspace.sessions.value.rows.some((row) => row.id === "s400")).toBe(false);
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

const candidateRow = (index: number) => ({
  current_grade: 9,
  full_name: `HS ${String(index).padStart(3, "0")}`,
  id: `s-${index}`,
  lifecycle_status: "trial",
  public_code: `HS${index}`,
  registered_mode: null,
  student_enrollments: [],
});

describe("getClassEnrollmentCandidates limits", () => {
  // Value: protects=the enroll dialog gets at most 500 candidates with truncated=true beyond, and null (not a throw) when the client cannot be created;
  // fails_when=the limit+1 probe or slice is removed, truncated stays false, or a client failure crashes the page;
  // why_new=audit gap: truncation and the client-rejection branch were untested;
  // seam=none; no_claim=does not prove PostgREST orders Vietnamese names as the UI expects
  it("truncates at 500 and returns null when the client fails", async () => {
    const calls = tables({ students: { data: Array.from({ length: 501 }, (_, index) => candidateRow(index)), error: null } });

    const result = await getClassEnrollmentCandidates();

    expect(calls.students).toContainEqual(["limit", [501]]);
    expect(result?.candidates).toHaveLength(500);
    expect(result?.truncated).toBe(true);

    vi.mocked(createSupabaseServerClient).mockRejectedValueOnce(new Error("cookies unavailable"));
    await expect(getClassEnrollmentCandidates()).resolves.toBeNull();
  });
});

describe("searchClassEnrollmentCandidates", () => {
  // Value: protects=the server-side enroll search keeps the never-enrolled anti-join, matches name or public code, caps at 50 (+1 probe), and a blank query falls back to the initial list;
  // fails_when=the search drops the anti-join, searches only one column, uses the 500 limit, or sends an or() filter for a blank query;
  // why_new=the owner moved enroll search to the server; this function is new;
  // seam=none; no_claim=does not prove PostgREST parses the quoted ilike values (checked by escaping test only)
  it("filters never-enrolled students by name or code, 50 at a time", async () => {
    const calls = tables({ students: { data: Array.from({ length: 51 }, (_, index) => candidateRow(index)), error: null } });

    const result = await searchClassEnrollmentCandidates("  Ngọc ");

    expect(calls.students).toContainEqual(["is", ["student_enrollments", null]]);
    expect(calls.students).toContainEqual(["or", ['full_name.ilike."%Ngọc%",public_code.ilike."%Ngọc%"']]);
    expect(calls.students).toContainEqual(["order", ["full_name", { ascending: true }]]);
    expect(calls.students).toContainEqual(["limit", [51]]);
    expect(result?.candidates).toHaveLength(50);
    expect(result?.truncated).toBe(true);

    const blank = tables({ students: { data: [], error: null } });
    await expect(searchClassEnrollmentCandidates("   ")).resolves.toEqual({ candidates: [], truncated: false });
    expect(blank.students.some(([method]) => method === "or")).toBe(false);
    expect(blank.students).toContainEqual(["limit", [501]]);

    tables({ students: { data: null, error: { message: "denied" } } });
    await expect(searchClassEnrollmentCandidates("An")).resolves.toBeNull();
  });

  // Value: protects=user input cannot break or widen the PostgREST or() filter: LIKE wildcards match literally and , ( ) " \ stay inside the quoted value;
  // fails_when=% or _ act as wildcards, a comma or parenthesis splits the filter, or a quote/backslash ends the quoted value early;
  // why_new=the search builds a PostgREST filter string from user input;
  // seam=none; no_claim=does not run the string through a real PostgREST parser; `*` still acts as a wildcard there
  it("escapes LIKE wildcards and PostgREST reserved characters", async () => {
    expect(toContainsFilterValue("An")).toBe('"%An%"');
    expect(toContainsFilterValue(String.raw`a%_,()\"b`)).toBe(String.raw`"%a\\%\\_,()\\\\\"b%"`);

    const calls = tables({ students: { data: [], error: null } });
    await searchClassEnrollmentCandidates("x,y");
    expect(calls.students).toContainEqual(["or", ['full_name.ilike."%x,y%",public_code.ilike."%x,y%"']]);
  });
});
