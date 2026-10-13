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
      session_results: { data: [{ class_session_id: "s2", student_id: "a" }], error: null },
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

  // Value: protects=the loader feeds the resolved rosters and the Vietnam date into findAbsenceStreaks, so an unmarked roster session breaks a streak (owner rule D2) and a future-dated session is ignored;
  // fails_when=getClassDetailWorkspace drops `rosters` (two absences read as a streak despite a later unmarked session) or drops `today` (a session dated later counts);
  // why_new=findAbsenceStreaks is tested alone; no loader test reached its rosters/today wiring (pass-2 review, owner decision D14);
  // seam=none; no_claim=does not prove resolve_class_session_roster returns the students the care rule expects
  it("breaks an absence streak on an unmarked roster session and ignores sessions after today", async () => {
    const absentRows = [
      { ...sessionRow("s1", "2026-10-01", "completed"), locked_at: "2026-10-01T15:00:00Z" },
      { ...sessionRow("s2", "2026-10-05", "completed"), locked_at: "2026-10-05T15:00:00Z" },
    ];
    const setup = (latest: ReturnType<typeof sessionRow>, rosterIncludesA: boolean) => {
      tables({
        class_component_links: { data: [], error: null },
        class_sessions: { data: [...absentRows, latest], error: null },
        session_attendance: {
          data: [
            { attendance_status: "unexcused_absence", class_session_id: "s1", student_id: "a" },
            { attendance_status: "unexcused_absence", class_session_id: "s2", student_id: "a" },
          ],
          error: null,
        },
        session_results: { data: [], error: null },
        student_enrollments: { data: [{ student: { full_name: "An", id: "a", public_code: "HS1" }, student_id: "a" }], error: null },
      });
      supabase.rpc.mockResolvedValue({ data: rosterIncludesA ? [{ enrollment_class_id: "class-1", student_id: "a" }] : [], error: null });
    };

    // a is on the newest session's roster without a mark: the streak is broken.
    setup(sessionRow("s3", "2026-10-08", "completed"), true);
    let workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });
    expect(workspace.absenceStreaks).toEqual({ status: "ready", value: [] });

    // Control: a is not on that roster, so the two absences stand as a streak.
    setup(sessionRow("s3", "2026-10-08", "completed"), false);
    workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });
    expect(workspace.absenceStreaks).toMatchObject({ status: "ready", value: [{ count: 2, student: { id: "a" } }] });

    // The same unmarked session dated after today is not counted, so it cannot break the streak.
    setup(sessionRow("s3", "2099-01-01", "completed"), true);
    workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });
    expect(workspace.absenceStreaks).toMatchObject({ status: "ready", value: [{ count: 2, student: { id: "a" } }] });
  });

  // Value: protects=a roster RPC that fails or throws for one session leaves only that session unresolved; the others keep their tallies and the attendance feed stays ready (owner decision D18);
  // fails_when=one failed or rejected resolve_class_session_roster call marks the whole attendance feed failed, or the failed session shows a 0/0 tally instead of an unknown one;
  // why_new=the loader used to drop every roster on the first failed call (ship adversarial review);
  // seam=none; no_claim=does not prove which errors the RPC raises for a deleted session
  it("leaves only the session whose roster RPC failed unresolved, keeping the feed", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: {
        data: [sessionRow("s1", "2026-10-12", "completed"), sessionRow("s2", "2026-10-09", "completed"), sessionRow("s3", "2026-10-07", "completed")],
        error: null,
      },
      session_attendance: { data: [{ attendance_status: "present", class_session_id: "s2", student_id: "a" }], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });
    supabase.rpc.mockImplementation(async (_name: string, args: { p_class_session_id: string }) => {
      if (args.p_class_session_id === "s1") return { data: null, error: { message: "CLASS_SESSION_NOT_FOUND" } };
      if (args.p_class_session_id === "s3") throw new Error("network down");
      return { data: [{ enrollment_class_id: "class-1", student_id: "a" }], error: null };
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(workspace.sessions.status).toBe("ready");
    expect(workspace.attendance).toEqual({ status: "ready", value: true });
    expect(workspace.absenceStreaks).toEqual({ status: "ready", value: [] });
    if (workspace.sessions.status !== "ready") return;
    const byId = Object.fromEntries(workspace.sessions.value.rows.map((row) => [row.id, row]));
    expect(byId.s1).toMatchObject({ attendance: null, rosterCount: null });
    expect(byId.s3).toMatchObject({ attendance: null, rosterCount: null });
    expect(byId.s2).toMatchObject({ attendance: { absent: 0, additional: 0, present: 1, unmarked: 0 }, rosterCount: 1 });
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

  // Value: protects=the per-session roster RPC fan-out stays capped at 40, 8 in flight at a time, and spends the cap on live sessions first
  // (newest first), then pending-lock sessions oldest first;
  // fails_when=the OPEN_ROSTER_LIMIT slice or the chunked concurrency is removed, a backlog of pending-lock sessions crowds out a live session's
  // roster, or the cap keeps the newest pending-lock sessions (the overview's needs-action list, which shows the oldest, then gets "—" rosters);
  // why_new=red-team found 40+ pending-lock sessions left a session being marked right now without a roster;
  // seam=none; no_claim=does not measure real RPC latency or prove the database tolerates 8 concurrent calls
  it("resolves at most 40 open rosters, live first, then oldest pending-lock, 8 at a time", async () => {
    const day = (offset: number) => new Date(Date.UTC(2026, 7, 1 + offset)).toISOString().slice(0, 10);
    const arrange = (completed: number, live: number) => {
      tables({
        class_component_links: { data: [], error: null },
        class_sessions: {
          data: [
            ...Array.from({ length: completed }, (_, index) => sessionRow(`s${String(index).padStart(2, "0")}`, day(index), "completed")),
            ...Array.from({ length: live }, (_, index) => sessionRow(`live${index}`, day(60 + index), "in_progress")),
          ].reverse(),
          error: null,
        },
        session_attendance: { data: [], error: null },
        session_results: { data: [], error: null },
        student_enrollments: { data: [], error: null },
      });
    };
    const resolvedIds = () => supabase.rpc.mock.calls.map(([, args]) => (args as { p_class_session_id: string }).p_class_session_id);
    let inFlight = 0;
    let maxInFlight = 0;
    supabase.rpc.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return { data: [{ student_id: "a" }], error: null };
    });

    arrange(41, 1);
    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(supabase.rpc).toHaveBeenCalledTimes(40);
    // The live session and the 39 oldest pending-lock sessions win over the two newest pending-lock ones.
    expect(new Set(resolvedIds())).toEqual(new Set(["live0", ...Array.from({ length: 39 }, (_, index) => `s${String(index).padStart(2, "0")}`)]));
    expect(maxInFlight).toBe(8);
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    const byId = Object.fromEntries(workspace.sessions.value.rows.map((row) => [row.id, row]));
    // An open session outside the cap shows "—" rather than 0/0.
    expect(byId.s39).toMatchObject({ attendance: null, rosterCount: null });
    expect(byId.s40).toMatchObject({ attendance: null, rosterCount: null });
    expect(byId.live0).toMatchObject({ attendance: { absent: 0, additional: 0, present: 0, unmarked: 1 }, rosterCount: 1 });
    expect(byId.s00).toMatchObject({ attendance: { absent: 0, additional: 0, present: 0, unmarked: 1 }, rosterCount: 1 });
    expect(byId.s38).toMatchObject({ rosterCount: 1 });

    // Live sessions newest first, then pending-lock sessions oldest first.
    supabase.rpc.mockClear();
    arrange(38, 3);
    await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(resolvedIds()).toHaveLength(40);
    expect(resolvedIds().slice(0, 5)).toEqual(["live2", "live1", "live0", "s00", "s01"]);
    expect(resolvedIds().at(-1)).toBe("s36");
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
        // A loader that throws (not a returned error): the results read rejects.
        session_results: () => {
          throw new Error("network down");
        },
        student_enrollments: { data: [{ student: { full_name: "An", id: "a", public_code: "HS1" }, student_id: "a" }], error: null },
        student_payment_requests: { data: [], error: null },
      });
    load();
    supabase.rpc.mockResolvedValue({ data: [], error: null });

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
  // seam=none; no_claim=the mock ignores the query's or() window filter, so this checks the JS safety net only (the query filter is tested below)
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

  // Value: protects=on a composite parent page, result counts of resolved sessions (component or own) count only students the attendance tally
  // counts (the roster plus walk-ins); component sessions stay "—" when their roster is unknown, own sessions then count every result;
  // fails_when=a result of a student enrolled only in the component class is counted, the walk-in rule differs from the tally, an unresolved
  // component session shows an unfiltered count, a resolved own session counts an off-roster result, or an unresolved own session loses its count;
  // why_new=red-team found loadResultCounts counted every session_results row while attendance was already restricted to the parent's roster;
  // own sessions are now filtered once resolved (a withdrawn student's result made "6/5");
  // seam=none; no_claim=does not cover a student enrolled in both the parent and the component (the RPC then reports the component enrolment)
  it("counts component-session results only for the page class's students", async () => {
    const arrange = () =>
      tables({
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
            { attendance_status: "additional_study", class_session_id: "open-component", student_enrollment_id: null, student_id: "w" },
            { attendance_status: "present", class_session_id: "locked-component", student_enrollment_id: "e-a", student_id: "a" },
            { attendance_status: "unexcused_absence", class_session_id: "locked-component", student_enrollment_id: "e-z", student_id: "z" },
            { attendance_status: "present", class_session_id: "locked-own", student_enrollment_id: "e-a", student_id: "a" },
          ],
          error: null,
        },
        session_results: {
          data: [
            { class_session_id: "open-component", student_id: "a" },
            { class_session_id: "open-component", student_id: "z" },
            { class_session_id: "open-component", student_id: "w" },
            { class_session_id: "locked-component", student_id: "a" },
            { class_session_id: "locked-component", student_id: "z" },
            { class_session_id: "locked-own", student_id: "a" },
            { class_session_id: "locked-own", student_id: "q" },
          ],
          error: null,
        },
        student_enrollments: (own) =>
          own.some(([method, args]) => method === "select" && args[0] === "id")
            ? { data: [{ id: "e-a" }], error: null }
            : { data: [{ student: { full_name: "An", id: "a", public_code: "HS1" }, student_id: "a" }], error: null },
      });
    const calls = arrange();
    supabase.rpc.mockResolvedValue({
      data: [
        { enrollment_class_id: "class-1", student_id: "a" },
        { enrollment_class_id: "class-1-t", student_id: "z" },
      ],
      error: null,
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(calls.session_results).toContainEqual(["select", ["class_session_id, student_id, test_score"]]);
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    const byId = Object.fromEntries(workspace.sessions.value.rows.map((row) => [row.id, row]));
    // z is enrolled only in the component class: not counted; the walk-in w is, as in the tally.
    expect(byId["open-component"]).toMatchObject({ attendance: { additional: 1, present: 1 }, resultCount: 2 });
    expect(byId["locked-component"]).toMatchObject({ resultCount: 1 });
    // A resolved own session counts only its tallied students: q has a result but no lock-counted mark.
    expect(byId["locked-own"]).toMatchObject({ resultCount: 1 });

    // Without attendance rights the component rosters are unknown: no count rather than an unfiltered one.
    arrange();
    const noAttendance = await getClassDetailWorkspace("class-1", { ...allowed, canViewAttendance: false, canViewPayments: false });

    expect(noAttendance.results).toEqual({ status: "ready", value: true });
    if (noAttendance.sessions.status !== "ready") throw new Error("sessions not ready");
    const noAttendanceById = Object.fromEntries(noAttendance.sessions.value.rows.map((row) => [row.id, row]));
    expect(noAttendanceById["open-component"]).toMatchObject({ resultCount: null });
    expect(noAttendanceById["locked-component"]).toMatchObject({ resultCount: null });
    // An own session with an unknown roster has no denominator to exceed: every result counts.
    expect(noAttendanceById["locked-own"]).toMatchObject({ resultCount: 2 });
  });

  // Value: protects=an own open session's result count never exceeds its roster: a withdrawn student's result (open rosters list only active
  // enrolments) is left out, a walk-in's is kept, and an own session beyond OPEN_ROSTER_LIMIT still counts every result;
  // fails_when=own sessions skip the tallied-student filter once their roster is resolved, the walk-in rule differs from the tally, or an
  // unresolved own session's count becomes null or filtered;
  // why_new=red-team found "6/5" on an own session after a student withdrew while holding a result;
  // seam=none; no_claim=does not prove resolve_class_session_roster drops withdrawn enrolments (the RPC is mocked)
  it("counts own open-session results only for the resolved roster and walk-ins", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [sessionRow("open-own", "2026-10-12", "completed")], error: null },
      session_attendance: {
        data: [
          { attendance_status: "present", class_session_id: "open-own", student_enrollment_id: "e-a", student_id: "a" },
          { attendance_status: "present", class_session_id: "open-own", student_enrollment_id: "e-x", student_id: "withdrawn" },
          { attendance_status: "additional_study", class_session_id: "open-own", student_enrollment_id: null, student_id: "w" },
        ],
        error: null,
      },
      session_results: {
        data: [
          { class_session_id: "open-own", student_id: "a" },
          { class_session_id: "open-own", student_id: "withdrawn" },
          { class_session_id: "open-own", student_id: "w" },
        ],
        error: null,
      },
      student_enrollments: { data: [], error: null },
    });
    // The withdrawn student is no longer on the roster.
    supabase.rpc.mockResolvedValue({ data: [{ enrollment_class_id: "class-1", student_id: "a" }], error: null });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    if (workspace.sessions.status !== "ready") throw new Error("sessions not ready");
    expect(workspace.sessions.value.rows[0]).toMatchObject({ resultCount: 2, rosterCount: 1 });

    // Roster RPC failure: the roster is unknown, so the own session counts every result.
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [sessionRow("open-own", "2026-10-12", "completed")], error: null },
      session_attendance: { data: [], error: null },
      session_results: {
        data: [
          { class_session_id: "open-own", student_id: "a" },
          { class_session_id: "open-own", student_id: "withdrawn" },
        ],
        error: null,
      },
      student_enrollments: { data: [], error: null },
    });
    const unresolved = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    if (unresolved.sessions.status !== "ready") throw new Error("sessions not ready");
    expect(unresolved.sessions.value.rows[0]).toMatchObject({ resultCount: 2, rosterCount: null });
  });

  // Value: protects=link windows filter component sessions in the query, before the 400 limit, so out-of-window rows neither take the budget nor make `truncated` true; malformed ids or dates never reach the filter string;
  // fails_when=the or() window filter is dropped or mis-built (missing lte for a closed window, lte on an open one), the limit is applied before the window, or an id with , ( ) is interpolated;
  // why_new=red-team found loadSessions limited first and dropped out-of-window rows afterwards, so a composite class could show fewer than 400 sessions with a false truncation flag;
  // seam=none; no_claim=the mock applies the window itself when it sees the expected or() string; it does not prove PostgREST parses that string
  it("filters component sessions by link window in the query, before the limit", async () => {
    const windows = [
      { component_class_id: "class-1-t", effective_from: "2026-09-01", effective_to: "2026-09-30" },
      { component_class_id: "class-1-t", effective_from: "2026-10-10", effective_to: null },
    ];
    const expectedFilter =
      "class_id.eq.class-1," +
      "and(class_id.eq.class-1-t,session_date.gte.2026-09-01,session_date.lte.2026-09-30)," +
      "and(class_id.eq.class-1-t,session_date.gte.2026-10-10)";
    const day = (offset: number) => new Date(Date.UTC(2026, 7, 31) - offset * 86_400_000).toISOString().slice(0, 10);
    // 400 own sessions up to 2026-08-31, plus newer component sessions between the two windows.
    const own = Array.from({ length: 400 }, (_, index) => sessionRow(`own${index}`, day(index), "scheduled"));
    const outside = Array.from({ length: 9 }, (_, index) => sessionRow(`out${index}`, `2026-10-0${index + 1}`, "scheduled", "class-1-t"));
    const dataset = [...outside.reverse(), ...own];
    const calls = tables({
      class_component_links: { data: windows, error: null },
      // Stand-in for the server: applies the window only when the query sends the expected filter.
      class_sessions: (ownCalls) => {
        const filtered = ownCalls.some(([method, args]) => method === "or" && args[0] === expectedFilter);
        const limit = ownCalls.find(([method]) => method === "limit")?.[1][0] as number;
        return { data: dataset.filter((row) => !filtered || row.class_id === "class-1").slice(0, limit), error: null };
      },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(calls.class_sessions).toContainEqual(["or", [expectedFilter]]);
    expect(calls.class_sessions).toContainEqual(["limit", [401]]);
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    expect(workspace.sessions.value.truncated).toBe(false);
    expect(workspace.sessions.value.rows).toHaveLength(400);

    // A class without components sends no or() filter.
    const plain = tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [], error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });
    await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });
    expect(plain.class_sessions.some(([method]) => method === "or")).toBe(false);

    // An id that could split the filter fails the feed instead of reaching PostgREST.
    const unsafe = tables({
      class_component_links: { data: [{ component_class_id: "x,class_id.neq.y", effective_from: "2026-09-01", effective_to: null }], error: null },
      class_sessions: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });
    const rejected = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });
    expect(unsafe.class_sessions).toBeUndefined();
    expect(rejected.sessions).toEqual({ reason: "failed", status: "unavailable" });
  });

  // Value: protects=a link date or class id that is not plain ISO date / id text never reaches the PostgREST or() filter: the sessions feed fails and no session query is sent;
  // fails_when=the date check in buildSessionWindowFilter is dropped or only checks effective_from, so "2026-09-30),class_id.neq.x" splits the filter and widens the session read;
  // why_new=only an unsafe component id was tested; malformed effective_from/effective_to and an unsafe page class id were not;
  // seam=none (driven through getClassDetailWorkspace); no_claim=does not prove the database can store such dates
  it.each([
    ["a malformed effective_from", "class-1", { effective_from: "2026-09-01),class_id.neq.x", effective_to: null }],
    ["a malformed effective_to", "class-1", { effective_from: "2026-09-01", effective_to: "2026-09-30),class_id.neq.x" }],
    ["a timestamp effective_to", "class-1", { effective_from: "2026-09-01", effective_to: "2026-09-30T00:00:00" }],
    ["an unsafe page class id", "class-1,class_id.neq.y", { effective_from: "2026-09-01", effective_to: null }],
  ])("fails the sessions feed instead of sending a filter built from %s", async (_label, classId, window) => {
    const calls = tables({
      class_component_links: { data: [{ component_class_id: "class-1-t", ...window }], error: null },
      class_sessions: { data: [], error: null },
      student_enrollments: { data: [], error: null },
    });

    const workspace = await getClassDetailWorkspace(classId, { ...allowed, canViewPayments: false });

    expect(calls.class_sessions).toBeUndefined();
    expect(workspace.sessions).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.attendance).toEqual({ reason: "failed", status: "unavailable" });
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

describe("getClassDetailWorkspace partial failures", () => {
  const loaded = (debt: TableResult) =>
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [sessionRow("s1", "2026-10-12", "completed")], error: null },
      session_attendance: { data: [{ attendance_status: "present", class_session_id: "s1", student_id: "a" }], error: null },
      session_results: { data: [], error: null },
      student_enrollments: { data: [{ student: { full_name: "An", id: "a", public_code: "HS1" }, student_id: "a" }], error: null },
      student_payment_requests: debt,
    });

  // Value: protects=a debt read that errors or throws fails only the debt feed; sessions, attendance and students still show and nothing rejects unhandled;
  // fails_when=the debt .catch is removed: the throw settles while the roster RPC is still pending on a later macrotask, so the rejection is unhandled (and the late await hits the outer catch); or a debt error marks other feeds failed;
  // why_new=testing review found every mock settled in microtasks, so the rejection was always awaited in time and the test passed without the .catch;
  // seam=none; no_claim=does not cover a debt read failing in a later chunk or page (same null path)
  it.each([
    ["errors", { data: null, error: { message: "denied" } } as TableResult],
    [
      "throws",
      (() => {
        throw new Error("socket hang up");
      }) as TableResult,
    ],
  ])("fails only debt when the debt read %s", async (_label, debt) => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      loaded(debt);
      // The session side settles on a later macrotask, after the debt read has failed.
      supabase.rpc.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [{ enrollment_class_id: "class-1", student_id: "a" }], error: null }), 5)),
      );

      const workspace = await getClassDetailWorkspace("class-1", allowed);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(supabase.from).toHaveBeenCalledWith("student_payment_requests");
      expect(workspace.debt).toEqual({ reason: "failed", status: "unavailable" });
      expect(workspace.students).toEqual({ status: "ready", value: [{ fullName: "An", id: "a", publicCode: "HS1" }] });
      expect(workspace.attendance).toEqual({ status: "ready", value: true });
      expect(workspace.results).toEqual({ status: "ready", value: true });
      expect(workspace.sessions.status).toBe("ready");
      if (workspace.sessions.status !== "ready") return;
      expect(workspace.sessions.value.rows[0]).toMatchObject({ attendance: { present: 1, unmarked: 0 }, rosterCount: 1 });
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  // Value: protects=on a parent with locked component sessions, a failed read of the parent's enrolment ids fails attendance instead of showing 0/0 tallies;
  // fails_when=a null classEnrollmentIds is treated as an empty set (every component student filtered out) and attendance stays ready;
  // why_new=the loadClassEnrollmentIds failure branch was never exercised; the existing component test only covers its success;
  // seam=none; no_claim=does not cover a failure on a later page of the enrolment-id read (same null path)
  it("fails attendance when the parent's enrolment-id read fails on locked component sessions", async () => {
    tables({
      class_component_links: { data: [{ component_class_id: "class-1-t", effective_from: "2026-09-01", effective_to: null }], error: null },
      class_sessions: {
        data: [{ ...sessionRow("locked-component", "2026-10-09", "completed", "class-1-t"), locked_at: "2026-10-10T00:00:00Z" }],
        error: null,
      },
      session_attendance: {
        data: [{ attendance_status: "present", class_session_id: "locked-component", student_enrollment_id: "e-a", student_id: "a" }],
        error: null,
      },
      session_results: { data: [], error: null },
      student_enrollments: (own) =>
        own.some(([method, args]) => method === "select" && args[0] === "id")
          ? { data: null, error: { message: "denied" } }
          : { data: [{ student: { full_name: "An", id: "a", public_code: "HS1" }, student_id: "a" }], error: null },
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(workspace.attendance).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.sessions.status).toBe("ready");
    if (workspace.sessions.status !== "ready") return;
    expect(workspace.sessions.value.rows[0]).toMatchObject({ attendance: null, rosterCount: null });
  });
});

describe("getClassDetailWorkspace roster feeds", () => {
  const student = (id: string, fullName: string, publicCode: string) => ({ full_name: fullName, id, public_code: publicCode });
  const enrollmentRow = (id: string, studentId: string, fullName: string, overrides: Record<string, unknown> = {}) => ({
    effective_from: "2026-09-01",
    effective_to: null,
    end_reason: null,
    id,
    registered_mode: "offline",
    status: "active",
    student: student(studentId, fullName, `HS-${studentId}`),
    student_id: studentId,
    ...overrides,
  });
  /** The active-student read filters on status; the roster read returns every enrolment ever made. */
  const enrollments = (all: unknown[], active: unknown[]): TableResult => (own) =>
    own.some(([method, args]) => method === "eq" && args[0] === "status") ? { data: active, error: null } : { data: all, error: null };

  // Value: protects=session balances are read (student_session_balances) only for viewers with session_ledger.view and a readable roster, and the enrolments feed gives one latest row per student, or is forbidden without students.view;
  // fails_when=balances are queried without canViewLedger (or without students.view), the open enrolment of a student who also holds an older reserved one is replaced, or a viewer without students.view still gets the enrolments feed;
  // why_new=step 5b part 2 added the enrolments, balances and studentDebts feeds to the loader;
  // seam=none; no_claim=does not prove the student_session_balances view exposes balance_sessions to this role
  it("reads balances only with session_ledger.view and groups enrolments per student", async () => {
    const rows = [
      enrollmentRow("e-a-old", "a", "An", { effective_from: "2026-08-01", effective_to: "2026-09-09", status: "reserved" }),
      enrollmentRow("e-a", "a", "An", { effective_from: "2026-09-10" }),
      enrollmentRow("e-b", "b", "Bảo", { effective_to: "2026-09-20", status: "reserved" }),
    ];
    const arrange = () =>
      tables({
        student_enrollments: enrollments(rows, [{ student: student("a", "An", "HS-a"), student_id: "a" }]),
        student_session_balances: {
          data: [
            { balance_sessions: 5, student_id: "a" },
            { balance_sessions: "-2", student_id: "b" },
          ],
          error: null,
        },
      });
    const permissions = { canViewAttendance: false, canViewPayments: false, canViewResults: false, canViewSessions: false, canViewStudents: true };

    let calls = arrange();
    let workspace = await getClassDetailWorkspace("class-1", permissions);

    expect(calls.student_session_balances).toBeUndefined();
    expect(workspace.balances).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(workspace.enrollments.status).toBe("ready");
    if (workspace.enrollments.status !== "ready") return;
    expect(workspace.enrollments.value.map((row) => [row.studentId, row.enrollmentId, row.status])).toEqual([
      ["a", "e-a", "active"],
      ["b", "e-b", "reserved"],
    ]);

    calls = arrange();
    workspace = await getClassDetailWorkspace("class-1", { ...permissions, canViewLedger: true });

    expect(calls.student_session_balances).toContainEqual(["select", ["student_id, balance_sessions"]]);
    expect(calls.student_session_balances).toContainEqual(["in", ["student_id", ["a", "b"]]]);
    expect(workspace.balances).toEqual({ status: "ready", value: { a: 5, b: -2 } });

    // Without students.view there is no roster to show balances for, whatever the ledger permission.
    calls = arrange();
    workspace = await getClassDetailWorkspace("class-1", { ...permissions, canViewLedger: true, canViewStudents: false });

    expect(calls.student_session_balances).toBeUndefined();
    expect(workspace.enrollments).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(workspace.balances).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(workspace.resultMatrix).toEqual({ reason: "forbidden", status: "unavailable" });
  });

  // Value: protects=the results matrix is built from the loader's own reads: a present student at a completed session with no result row gets a "missing" cell, an entered numeric-string score is parsed, and the count reaches the workspace;
  // fails_when=test_score is not selected or not parsed, attendance is not handed to the matrix (no missing cells), or the matrix stays failed/forbidden with every permission;
  // why_new=step 5b part 2 added resultMatrix to the workspace;
  // seam=none; no_claim=does not prove which sessions the matrix should show beyond completed and in-progress ones
  it("builds the results matrix with a missing cell for a present student lacking a result", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: {
        data: [sessionRow("s2", "2026-10-08", "completed"), sessionRow("s1", "2026-10-01", "completed"), sessionRow("s-next", "2026-10-20", "scheduled")],
        error: null,
      },
      session_attendance: {
        data: [
          { attendance_status: "present", class_session_id: "s1", student_id: "a" },
          { attendance_status: "present", class_session_id: "s2", student_id: "a" },
          { attendance_status: "present", class_session_id: "s2", student_id: "b" },
        ],
        error: null,
      },
      session_results: {
        data: [
          { class_session_id: "s1", student_id: "a", test_score: "8.50" },
          { class_session_id: "s2", student_id: "b", test_score: null },
        ],
        error: null,
      },
      student_enrollments: enrollments(
        [enrollmentRow("e-a", "a", "An"), enrollmentRow("e-b", "b", "Bảo")],
        [
          { student: student("a", "An", "HS-a"), student_id: "a" },
          { student: student("b", "Bảo", "HS-b"), student_id: "b" },
        ],
      ),
    });
    supabase.rpc.mockResolvedValue({
      data: [
        { enrollment_class_id: "class-1", student_id: "a" },
        { enrollment_class_id: "class-1", student_id: "b" },
      ],
      error: null,
    });

    const workspace = await getClassDetailWorkspace("class-1", { ...allowed, canViewPayments: false });

    expect(workspace.resultMatrix.status).toBe("ready");
    if (workspace.resultMatrix.status !== "ready") return;
    const matrix = workspace.resultMatrix.value;
    expect(matrix.columns.map((column) => column.id)).toEqual(["s1", "s2"]);
    expect(matrix.attendanceKnown).toBe(true);
    expect(matrix.rows.map((row) => [row.student.fullName, row.cells])).toEqual([
      ["An", [{ kind: "score", score: 8.5 }, { kind: "missing" }]],
      ["Bảo", [null, { kind: "graded" }]],
    ]);
    expect(matrix.missingCount).toBe(1);
  });

  // Value: protects=the overview debt tile still counts only active students while the students tab's studentDebts covers everyone enrolled (a reserved student can owe), and a failed roster read fails studentDebts without hiding the overview debt;
  // fails_when=the overview filter to active ids is dropped (reserved students' debt inflates the tile), studentDebts is limited to active students or never filled, or a failed roster read leaves studentDebts forbidden/ready;
  // why_new=step 5b part 2 widened the debt read to every enrolled student and split it into two feeds; no test asserted studentDebts or the active-only overview;
  // seam=none; no_claim=does not prove RLS on student_payment_requests or the overdue cutoff (created_at is recent)
  it("keeps the overview debt to active students while studentDebts covers reserved ones", async () => {
    const createdAt = new Date().toISOString();
    const requests = {
      data: [
        { created_at: createdAt, expected_amount_vnd: "1000000", paid_amount_vnd: "0", status: "pending", student_id: "a" },
        { created_at: createdAt, expected_amount_vnd: "500000", paid_amount_vnd: "200000", status: "partially_paid", student_id: "b" },
      ],
      error: null,
    };
    const rows = [enrollmentRow("e-a", "a", "An"), enrollmentRow("e-b", "b", "Bảo", { effective_to: "2026-09-20", status: "reserved" })];
    const active = [{ student: student("a", "An", "HS-a"), student_id: "a" }];
    const permissions = { canViewAttendance: false, canViewPayments: true, canViewResults: false, canViewSessions: false, canViewStudents: true };

    const calls = tables({ student_enrollments: enrollments(rows, active), student_payment_requests: requests });
    let workspace = await getClassDetailWorkspace("class-1", permissions);

    expect(calls.student_payment_requests).toContainEqual(["in", ["student_id", ["a", "b"]]]);
    expect(workspace.debt).toEqual({ status: "ready", value: { outstandingVnd: 1_000_000, overdueStudentCount: 0, studentCount: 1 } });
    expect(workspace.studentDebts).toEqual({
      status: "ready",
      value: { a: { amountVnd: 1_000_000, overdue: false }, b: { amountVnd: 300_000, overdue: false } },
    });

    // The roster read fails: the tab's debt column fails, the overview tile keeps the active students' debt.
    tables({
      student_enrollments: (own) =>
        own.some(([method, args]) => method === "eq" && args[0] === "status") ? { data: active, error: null } : { data: null, error: { message: "denied" } },
      student_payment_requests: requests,
    });
    workspace = await getClassDetailWorkspace("class-1", permissions);

    expect(workspace.enrollments).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.studentDebts).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.debt).toEqual({ status: "ready", value: { outstandingVnd: 1_000_000, overdueStudentCount: 0, studentCount: 1 } });
  });

  // Value: protects=a reserved enrolment that a later enrolment in ANOTHER class resumed is flagged resumedElsewhere (only reserved ids are looked up), a resumption in this class is not, and a failed successor read fails the enrolments feed instead of showing the student as still reserved;
  // fails_when=the successor read is skipped or not filtered on supersedes_enrollment_id, a same-class resumption is flagged, the flag is not mapped onto the row, or a failed successor read leaves the feed ready;
  // why_new=loadClassEnrollments gained the resumedElsewhere lookup in the pre-landing review fixes;
  // seam=none; no_claim=does not prove RLS lets the viewer read the successor enrolment in the other class
  it("flags a reserved enrolment resumed in another class and keeps the roster when that read fails", async () => {
    const rows = [
      enrollmentRow("e-a", "a", "An"),
      enrollmentRow("e-b", "b", "Bảo", { effective_to: "2026-09-20", status: "reserved" }),
      // Cúc reserved, then resumed into this same class.
      enrollmentRow("e-c", "c", "Cúc", { effective_from: "2026-09-01", effective_to: "2026-09-20", status: "reserved" }),
      enrollmentRow("e-c2", "c", "Cúc", { effective_from: "2026-10-01" }),
    ];
    const active = [{ student: student("a", "An", "HS-a"), student_id: "a" }, { student: student("c", "Cúc", "HS-c"), student_id: "c" }];
    const successors = [
      { class_id: "class-2", supersedes_enrollment_id: "e-b" },
      { class_id: "class-1", supersedes_enrollment_id: "e-c" },
    ];
    const roster = (successorResult: Result): TableResult => (own) => {
      if (own.some(([method, args]) => method === "in" && args[0] === "supersedes_enrollment_id")) return successorResult;
      return own.some(([method, args]) => method === "eq" && args[0] === "status") ? { data: active, error: null } : { data: rows, error: null };
    };
    const permissions = { canViewAttendance: false, canViewPayments: false, canViewResults: false, canViewSessions: false, canViewStudents: true };

    const calls = tables({ student_enrollments: roster({ data: successors, error: null }) });
    let workspace = await getClassDetailWorkspace("class-1", permissions);

    expect(calls.student_enrollments).toContainEqual(["in", ["supersedes_enrollment_id", ["e-b", "e-c"]]]);
    expect(calls.student_enrollments).toContainEqual(["select", ["class_id, supersedes_enrollment_id"]]);
    expect(workspace.enrollments.status).toBe("ready");
    if (workspace.enrollments.status !== "ready") return;
    expect(workspace.enrollments.value.map((row) => [row.enrollmentId, row.status, row.resumedElsewhere])).toEqual([
      ["e-a", "active", false],
      ["e-b", "reserved", true],
      ["e-c2", "active", false],
    ]);

    tables({ student_enrollments: roster({ data: null, error: { message: "denied" } }) });
    workspace = await getClassDetailWorkspace("class-1", permissions);

    // Only the badge depends on the successor read: the roster stays ready, reserved rows stay reserved.
    expect(workspace.enrollments.status).toBe("ready");
    if (workspace.enrollments.status !== "ready") return;
    expect(workspace.enrollments.value.find((row) => row.enrollmentId === "e-b")?.resumedElsewhere).toBe(false);
    expect(workspace.students.status).toBe("ready");
  });

  // Value: protects=when only the active-students read fails, the students tab's debt column still loads from the roster (ready, or failed if the debt read fails), never "forbidden", while the overview debt tile stays failed;
  // fails_when=the debt read is gated on the active read again (studentDebts stays forbidden and the column silently disappears), or the overview tile shows a total computed without knowing who is active;
  // why_new=the review made the debt read start when either the active read or the roster read succeeded;
  // seam=none; no_claim=does not prove which RLS failure makes the active read fail alone
  it("loads studentDebts from the roster when only the active-students read fails", async () => {
    const createdAt = new Date().toISOString();
    const rows = [enrollmentRow("e-a", "a", "An"), enrollmentRow("e-b", "b", "Bảo", { effective_to: "2026-09-20", status: "transferred" })];
    const roster: TableResult = (own) =>
      own.some(([method, args]) => method === "eq" && args[0] === "status") ? { data: null, error: { message: "timeout" } } : { data: rows, error: null };
    const permissions = { canViewAttendance: false, canViewPayments: true, canViewResults: false, canViewSessions: false, canViewStudents: true };

    const calls = tables({
      student_enrollments: roster,
      student_payment_requests: {
        data: [{ created_at: createdAt, expected_amount_vnd: "700000", paid_amount_vnd: "0", status: "pending", student_id: "b" }],
        error: null,
      },
    });
    let workspace = await getClassDetailWorkspace("class-1", permissions);

    expect(calls.student_payment_requests).toContainEqual(["in", ["student_id", ["a", "b"]]]);
    expect(workspace.students).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.debt).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.studentDebts).toEqual({ status: "ready", value: { b: { amountVnd: 700_000, overdue: false } } });

    tables({ student_enrollments: roster, student_payment_requests: { data: null, error: { message: "denied" } } });
    workspace = await getClassDetailWorkspace("class-1", permissions);

    expect(workspace.studentDebts).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.debt).toEqual({ reason: "failed", status: "unavailable" });
  });

  // Value: protects=a failed sessions or results read marks the results matrix failed (the tab explains) for a viewer with results+students, and an enrolment with an unknown status is left off the roster;
  // fails_when=the matrix stays forbidden (tab hidden) or turns ready with empty columns after a failed read, or an unexpected enrolment status reaches the roster (undefined badge);
  // why_new=partial-failure tests predate resultMatrix and no loader test fed an unknown enrolment status;
  // seam=none; no_claim=does not prove which statuses the database can hold
  it("fails the results matrix on a failed sessions or results read and drops unknown enrolment statuses", async () => {
    const roster = enrollments(
      [enrollmentRow("e-a", "a", "An"), enrollmentRow("e-x", "x", "Xuân", { status: "archived" })],
      [{ student: student("a", "An", "HS-a"), student_id: "a" }],
    );
    const permissions = { ...allowed, canViewPayments: false };

    tables({ class_component_links: { data: [], error: null }, class_sessions: { data: null, error: { message: "denied" } }, student_enrollments: roster });
    let workspace = await getClassDetailWorkspace("class-1", permissions);

    expect(workspace.resultMatrix).toEqual({ reason: "failed", status: "unavailable" });
    expect(workspace.enrollments.status).toBe("ready");
    if (workspace.enrollments.status !== "ready") return;
    expect(workspace.enrollments.value.map((row) => row.studentId)).toEqual(["a"]);

    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [sessionRow("s1", "2026-10-08", "completed")], error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: null, error: { message: "denied" } },
      student_enrollments: roster,
    });
    supabase.rpc.mockResolvedValue({ data: [{ enrollment_class_id: "class-1", student_id: "a" }], error: null });
    workspace = await getClassDetailWorkspace("class-1", permissions);

    expect(workspace.sessions.status).toBe("ready");
    expect(workspace.resultMatrix).toEqual({ reason: "failed", status: "unavailable" });
  });
});
