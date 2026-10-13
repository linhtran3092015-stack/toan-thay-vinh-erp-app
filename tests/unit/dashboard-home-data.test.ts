// Value: protects=the home dashboard loader reads only the feeds the viewer's permissions and layout allow, ties today's attendance to the resolved roster, counts overdue not-started sessions by Vietnam time, sums tuition progress from current (reissued) items, and fails one feed without hiding the others;
// fails_when=a TA's dashboard queries SePay, tuition or student counts, an accountant without sessions.view reads class sessions, a roster RPC failure shows as 0/0, a session still running counts as unmarked, a replaced tuition item is counted twice, or a failed session read blanks the SePay figure;
//   also when an ended in-progress session is dropped from the unmarked list, a session whose class RLS hid is silently dropped (a false "no sessions" / "no backlog") or session feeds wrongly require classes.view, missing results or locked-session rosters come from the wrong rows, a thrown loader blanks the whole home, week attendance stops counting in the database, a failed executive read fails other feeds, or the upcoming-session read runs while a session is still ahead today;
// why_new=home-data is a new server-only loader; Supabase is mockable at its client boundary and the shared feature loaders at their module boundaries;
// seam=createSupabaseServerClient, unlocked-sessions-data, timekeeping data, student-care data and auth current-user are mocked; no_claim=does not prove PostgREST accepts these filters or that RLS returns these rows
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const loaders = vi.hoisted(() => ({
  getAttendanceVerificationPolicy: vi.fn(),
  getCachedCurrentAuthUser: vi.fn(),
  getCachedMyTimekeepingEntries: vi.fn(),
  getCareDashboard: vi.fn(),
  getMyMonthlyTimekeepingEntries: vi.fn(),
  getUnlockedSessionQueueResult: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => supabase),
}));
vi.mock("@/features/sessions/unlocked-sessions-data", () => ({
  getUnlockedSessionQueueResult: loaders.getUnlockedSessionQueueResult,
}));
vi.mock("@/features/timekeeping/data", () => ({
  getAttendanceVerificationPolicy: loaders.getAttendanceVerificationPolicy,
  getCachedMyTimekeepingEntries: loaders.getCachedMyTimekeepingEntries,
  getMyMonthlyTimekeepingEntries: loaders.getMyMonthlyTimekeepingEntries,
}));
vi.mock("@/features/student-care/data", () => ({ getCareDashboard: loaders.getCareDashboard }));
vi.mock("@/features/auth/current-user", () => ({ getCachedCurrentAuthUser: loaders.getCachedCurrentAuthUser }));

import { getDashboardHomeReadModel, UNLOCKED_QUEUE_LIMIT } from "@/features/dashboard/home-data";
import { buildNeedsAction, hasNoBacklog } from "@/features/dashboard/home-models";
import type { RoleAwareDashboardReadModel } from "@/features/dashboard/read-models";
import type { PermissionCode } from "@/lib/permissions/types";

type Result = { count?: number | null; data: unknown; error: unknown };
type Call = [string, unknown[]];
type TableResult = Result | ((calls: Call[]) => Result);

/** Chainable PostgREST stand-in; records filter calls so tests can assert them. */
function query(result: TableResult, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  const own: Call[] = [];
  for (const method of ["select", "eq", "in", "is", "or", "gt", "gte", "lte", "not", "order", "limit", "range"]) {
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
  const calls: Record<string, Call[]> = {};
  supabase.from.mockImplementation((table: string) => {
    const result = results[table];
    if (!result) throw new Error(`Unexpected table query: ${table}`);
    calls[table] ??= [];
    return query(result, calls[table]);
  });
  return calls;
}

/** 2026-10-12 16:00 in Vietnam. */
const now = new Date("2026-10-12T09:00:00.000Z");

const executive: Pick<RoleAwareDashboardReadModel, "attention" | "receivablesAging" | "studentStatus"> = {
  attention: { data: [], status: "ready" },
  receivablesAging: { status: "hidden" },
  studentStatus: { status: "hidden" },
};

const sessionRow = (id: string, date: string, start: string, end: string, status: string, lockedAt: string | null = null) => ({
  class: { code: `L-${id}`, name: `Lớp ${id}` },
  class_id: `class-${id}`,
  end_time: end,
  id,
  learning_mode: "offline",
  locked_at: lockedAt,
  room_name: "P.101",
  session_date: date,
  start_time: start,
  status,
});

const emptyQueue = { data: { autoLockAfterDays: 0, items: [] }, ok: true };

beforeEach(() => {
  supabase.from.mockReset();
  supabase.rpc.mockReset();
  for (const loader of Object.values(loaders)) loader.mockReset();
  loaders.getUnlockedSessionQueueResult.mockResolvedValue(emptyQueue);
});

describe("getDashboardHomeReadModel", () => {
  it("gives a teaching assistant the personal layout without reading centre money or week figures", async () => {
    const calls = tables({
      class_sessions: { data: [], error: null },
      session_attendance: { data: [], error: null },
      session_results: { data: [], error: null },
    });
    loaders.getCachedMyTimekeepingEntries.mockResolvedValue({ entries: [], ok: true });
    loaders.getAttendanceVerificationPolicy.mockResolvedValue({ ok: false });
    loaders.getMyMonthlyTimekeepingEntries.mockResolvedValue({ entries: [], ok: true });

    const permissions: PermissionCode[] = ["dashboard.view", "classes.view", "sessions.view", "attendance.view", "attendance.mark", "results.view", "results.manage", "sessions.lock", "timekeeping.check"];
    const model = await getDashboardHomeReadModel(permissions, executive, now);

    expect(model.layout).toBe("personal");
    expect(Object.keys(calls).sort()).toEqual(["class_sessions"]);
    expect(model.sepay).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(model.tuition).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(model.newStudents).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(model.timekeeping).toEqual({ status: "ready", value: { lastCheckOutAt: null, openEntry: null, policy: null } });
    expect(model.myMonth.status).toBe("ready");
    expect(loaders.getMyMonthlyTimekeepingEntries).toHaveBeenCalledWith(10, 2026);
    expect(model.missingResults).toEqual({ status: "ready", value: [] });
  });

  it("never reads sessions for a finance viewer without sessions.view and sums tuition from current items", async () => {
    const calls = tables({
      sepay_transactions: { count: 2, data: [{ amount_vnd: "300000", transaction_at: "2026-10-12T01:14:00Z" }, { amount_vnd: 200000, transaction_at: "2026-10-12T02:00:00Z" }], error: null },
      tuition_collection_items: {
        data: [
          { id: "i1", payable_amount_vnd: 1_000_000, payment_request: { expected_amount_vnd: 1_000_000, paid_amount_vnd: 1_000_000, status: "paid" }, reissued_from_item_id: null, student_id: "a" },
          // i2 was replaced by i3: only i3's request counts.
          { id: "i2", payable_amount_vnd: 2_000_000, payment_request: { expected_amount_vnd: 2_000_000, paid_amount_vnd: 0, status: "cancelled" }, reissued_from_item_id: null, student_id: "b" },
          { id: "i3", payable_amount_vnd: 1_500_000, payment_request: [{ expected_amount_vnd: 1_500_000, paid_amount_vnd: 500_000, status: "partially_paid" }], reissued_from_item_id: "i2", student_id: "b" },
        ],
        error: null,
      },
      tuition_collection_periods: {
        data: [
          { due_on: "2026-11-15", ends_on: "2026-11-30", id: "nov", name: "tháng 11/2026", starts_on: "2026-11-01", status: "draft" },
          { due_on: "2026-10-10", ends_on: "2026-10-31", id: "oct", name: "tháng 10/2026", starts_on: "2026-10-01", status: "locked" },
        ],
        error: null,
      },
    });

    const permissions: PermissionCode[] = ["dashboard.view", "finance.view", "payments.view", "sepay.view", "tuition_periods.view"];
    const model = await getDashboardHomeReadModel(permissions, executive, now);

    expect(model.layout).toBe("center");
    expect(calls.class_sessions).toBeUndefined();
    expect(loaders.getUnlockedSessionQueueResult).not.toHaveBeenCalled();
    expect(model.todaySessions).toEqual({ reason: "forbidden", status: "unavailable" });
    expect(model.sepay).toEqual({ status: "ready", value: { count: 2, oldestAt: "2026-10-12T01:14:00Z", totalIsPartial: false, totalVnd: 500_000 } });
    expect(calls.tuition_collection_items).toContainEqual(["eq", ["period_id", "oct"]]);
    expect(model.tuition).toEqual({
      status: "ready",
      value: expect.objectContaining({ collectedVnd: 1_500_000, notDueVnd: 0, overdueVnd: 1_000_000, payableVnd: 2_500_000, periodId: "oct", requestCount: 2 }),
    });
  });

  it("ties today's attendance to the roster and leaves a session with a failed roster call unresolved", async () => {
    tables({
      class_sessions: (own) =>
        own.some(([method, args]) => method === "eq" && args[0] === "session_date")
          ? {
              data: [sessionRow("s1", "2026-10-12", "08:00:00", "10:00:00", "completed"), sessionRow("s2", "2026-10-12", "17:30:00", "19:30:00", "scheduled")],
              error: null,
            }
          : { data: [], error: null },
      session_attendance: {
        data: [
          { attendance_status: "present", class_session_id: "s1", student_id: "a" },
          { attendance_status: "unexcused_absence", class_session_id: "s1", student_id: "b" },
        ],
        error: null,
      },
    });
    supabase.rpc.mockImplementation(async (_name: string, args: { p_class_session_id: string }) =>
      args.p_class_session_id === "s1"
        ? { data: [{ enrollment_class_id: "class-s1", student_id: "a" }, { enrollment_class_id: "class-s1", student_id: "b" }, { enrollment_class_id: "class-s1", student_id: "c" }], error: null }
        : { data: null, error: { message: "boom" } },
    );

    const model = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view", "attendance.view"], executive, now);

    expect(model.todaySessions.status).toBe("ready");
    const rows = model.todaySessions.status === "ready" ? model.todaySessions.value.rows : [];
    expect(rows.map((row) => [row.id, row.rosterCount, row.attendance])).toEqual([
      ["s1", 3, { absent: 1, additional: 0, present: 1, unmarked: 1 }],
      ["s2", null, null],
    ]);
  });

  it("counts not-started sessions only once they have ended in Vietnam time, plus queue sessions missing marks", async () => {
    tables({
      class_sessions: (own) =>
        own.some(([method, args]) => method === "in" && args[0] === "status")
          ? {
              data: [
                sessionRow("late", "2026-10-12", "13:30:00", "15:30:00", "scheduled"),
                sessionRow("later", "2026-10-12", "17:30:00", "19:30:00", "scheduled"),
                sessionRow("old", "2026-10-09", "19:30:00", "21:30:00", "scheduled"),
              ],
              error: null,
            }
          : { data: [], error: null },
    });
    loaders.getUnlockedSessionQueueResult.mockResolvedValue({
      data: {
        autoLockAfterDays: 0,
        items: [
          { classCode: "L-q1", className: "Lớp q1", id: "q1", missingAttendanceCount: 2, rosterCount: 20, sessionDate: "2026-10-11", startTime: "19:30:00" },
          { classCode: "L-q2", className: "Lớp q2", id: "q2", missingAttendanceCount: 0, rosterCount: 18, sessionDate: "2026-10-11", startTime: "17:30:00" },
        ],
      },
      ok: true,
    });

    const model = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view", "classes.manage_schedule"], executive, now);

    expect(model.unmarked.status).toBe("ready");
    const items = model.unmarked.status === "ready" ? model.unmarked.value.items : [];
    expect(items.map((item) => [item.id, item.reason, item.recorded, item.roster])).toEqual([
      ["late", "not_started", null, null],
      ["old", "not_started", null, null],
      ["q1", "incomplete", 18, 20],
    ]);
    // Without sessions.lock the lock-waiting count is never built.
    expect(model.awaitingLock).toEqual({ reason: "forbidden", status: "unavailable" });

    // A lock holder gets only the fully marked session (q2); q1 is already in the unmarked list.
    const locker = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view", "classes.manage_schedule", "sessions.lock"], executive, now);
    expect(locker.awaitingLock).toEqual({ status: "ready", value: { count: 1, truncated: false } });
    expect(loaders.getUnlockedSessionQueueResult).toHaveBeenCalledTimes(2);
  });

  it("fails one feed on its own: a session read error does not blank the SePay figure", async () => {
    tables({
      class_sessions: { data: null, error: { message: "boom" } },
      sepay_transactions: { count: 0, data: [], error: null },
    });

    const model = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view", "sepay.view"], { ...executive, attention: { status: "error" } }, now);

    expect(model.todaySessions).toEqual({ reason: "failed", status: "unavailable" });
    expect(model.unmarked).toEqual({ reason: "failed", status: "unavailable" });
    expect(model.upcomingSession).toEqual({ status: "ready", value: null });
    expect(model.sepay).toEqual({ status: "ready", value: { count: 0, oldestAt: null, totalIsPartial: false, totalVnd: 0 } });
    expect(model.executive.attention).toEqual({ reason: "failed", status: "unavailable" });
  });

  it("reads the coming week's first session only when none is left today", async () => {
    const calls = tables({
      class_sessions: (own) =>
        own.some(([method]) => method === "gt")
          ? { data: [sessionRow("next", "2026-10-13", "17:30:00", "19:30:00", "scheduled")], error: null }
          : { data: [], error: null },
    });
    supabase.rpc.mockResolvedValue({ data: [{ enrollment_class_id: "class-next", student_id: "a" }], error: null });

    const model = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view"], executive, now);

    expect(calls.class_sessions).toContainEqual(["lte", ["session_date", "2026-10-19"]]);
    expect(model.upcomingSession).toEqual({ status: "ready", value: expect.objectContaining({ id: "next", rosterCount: 1 }) });
  });

  // Value: protects=the home's "today", week and own month follow the Vietnam calendar day when UTC is still on the previous day;
  // fails_when=the loader dates by UTC (toISOString) so after 00:00 VN it reads yesterday's sessions, last month's timekeeping or last week's new students;
  // why_new=every other loader test runs at 16:00 VN, where UTC and Vietnam share the date; seam=none;
  // no_claim=does not prove the server's own clock or the DB's date filters (mocked Supabase)
  it("dates today, the week and the own month by the Vietnam day just after midnight", async () => {
    const calls = tables({ class_sessions: { data: [], error: null } });
    loaders.getCachedMyTimekeepingEntries.mockResolvedValue({ entries: [], ok: true });
    loaders.getAttendanceVerificationPolicy.mockResolvedValue({ ok: false });
    loaders.getMyMonthlyTimekeepingEntries.mockResolvedValue({ entries: [], ok: true });

    // Saturday 31/10 17:30 UTC = Sunday 01/11 00:30 in Vietnam.
    const personal = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view", "timekeeping.check"], executive, new Date("2026-10-31T17:30:00.000Z"));

    expect(personal).toMatchObject({ nowTime: "00:30:00", today: "2026-11-01", weekEnd: "2026-11-01", weekStart: "2026-10-26" });
    expect(calls.class_sessions).toContainEqual(["eq", ["session_date", "2026-11-01"]]);
    expect(loaders.getMyMonthlyTimekeepingEntries).toHaveBeenCalledWith(11, 2026);

    const counts = tables({ crm_cases: { count: 2, data: null, error: null }, students: { count: 4, data: null, error: null } });
    // Sunday 01/11 17:30 UTC = Monday 02/11 00:30 in Vietnam: a new week has begun.
    const centre = await getDashboardHomeReadModel(["dashboard.view", "students.view", "students.manage_status", "crm.view"], executive, new Date("2026-11-01T17:30:00.000Z"));

    expect(centre).toMatchObject({ layout: "center", newLeads: { status: "ready", value: 2 }, newStudents: { status: "ready", value: 4 }, weekStart: "2026-11-02" });
    expect(counts.students).toContainEqual(["gte", ["created_at", "2026-11-02T00:00:00+07:00"]]);
    expect(counts.crm_cases).toContainEqual(["gte", ["created_at", "2026-11-02T00:00:00+07:00"]]);
  });

  // Value: protects=a viewer's dashboard never queries a feed their permissions do not allow, and CRM/care work is read only as the viewer's own;
  // fails_when=a bare dashboard.view viewer triggers any table/RPC loader, CRM follow-ups are read without crm.update or for other owners, or care is read without student_care.handle or team-wide;
  // why_new=existing loader tests cover TA and finance viewers only; the CRM and care feeds and the no-permission viewer were never exercised; seam=none;
  // no_claim=does not prove RLS or the care RPC's own filtering (mocked Supabase and care loader)
  it("reads nothing a bare viewer may not read, and CRM and care only as the viewer's own work", async () => {
    tables({});
    const bare = await getDashboardHomeReadModel(["dashboard.view"], executive, now);

    expect(supabase.from).not.toHaveBeenCalled();
    for (const loader of Object.values(loaders)) expect(loader).not.toHaveBeenCalled();
    const forbidden = { reason: "forbidden", status: "unavailable" };
    for (const key of ["careOverdue", "crmFollowUps", "missingResults", "myMonth", "newLeads", "newStudents", "sepay", "timekeeping", "todaySessions", "tuition", "unmarked", "upcomingSession", "weekAttendance"] as const) {
      expect(bare[key], key).toEqual(forbidden);
    }

    const calls = tables({ crm_case_notes: { count: 4, data: null, error: null } });
    loaders.getCachedCurrentAuthUser.mockResolvedValue({ ok: true, user: { id: "user-1" } });
    const careViewer = await getDashboardHomeReadModel(["dashboard.view", "crm.view", "crm.update", "student_care.view"], executive, now);

    expect(careViewer.crmFollowUps).toEqual({ status: "ready", value: 4 });
    expect(calls.crm_case_notes).toEqual(
      expect.arrayContaining([
        ["eq", ["crm_cases.sale_owner_id", "user-1"]],
        ["lte", ["follow_up_at", "2026-10-12"]],
        ["is", ["follow_up_done_at", null]],
      ]),
    );
    expect(loaders.getCareDashboard).not.toHaveBeenCalled();
    expect(careViewer.careOverdue).toEqual(forbidden);

    loaders.getCareDashboard.mockResolvedValue({ total: 3 });
    loaders.getCachedCurrentAuthUser.mockResolvedValue({ error: "session_expired", ok: false });
    const handler = await getDashboardHomeReadModel(["dashboard.view", "crm.view", "crm.update", "student_care.view", "student_care.handle"], executive, now);

    expect(loaders.getCareDashboard).toHaveBeenCalledWith({ mine: "true", overdue: "true" });
    expect(handler.careOverdue).toEqual({ status: "ready", value: 3 });
    // Without a signed-in user the follow-up count is unknown, never 0.
    expect(handler.crmFollowUps).toEqual({ reason: "failed", status: "unavailable" });
  });

  // Value: protects=the unmarked read covers scheduled and in-progress sessions, reports an ended in-progress session as not completed (it never reaches the lock queue), and flags a full lock queue as a floor;
  // fails_when=the query goes back to status=scheduled only, a running session counts as overdue, an ended in-progress one is reported as not started, or 200 queue items read as an exact count;
  // why_new=review widened the status filter and the truncation rule; seam=none; no_claim=does not prove PostgREST accepts the filters
  it("reports ended in-progress sessions as not completed and a full lock queue as truncated", async () => {
    const calls = tables({
      class_sessions: (own) =>
        own.some(([method, args]) => method === "in" && args[0] === "status")
          ? {
              data: [
                sessionRow("running", "2026-10-12", "15:30:00", "17:30:00", "in_progress"),
                sessionRow("stuck", "2026-10-12", "13:30:00", "15:30:00", "in_progress"),
                sessionRow("late", "2026-10-12", "13:00:00", "14:00:00", "scheduled"),
              ],
              error: null,
            }
          : { data: [], error: null },
    });
    const queue = (length: number) => ({
      data: {
        autoLockAfterDays: 0,
        items: Array.from({ length }, (_, index) => ({ classCode: `L-q${index}`, className: `Lớp q${index}`, id: `q${index}`, missingAttendanceCount: 0, rosterCount: 10, sessionDate: "2026-10-11", startTime: "17:30:00" })),
      },
      ok: true,
    });
    const permissions: PermissionCode[] = ["dashboard.view", "classes.view", "sessions.view", "classes.manage_schedule"];

    loaders.getUnlockedSessionQueueResult.mockResolvedValue(queue(UNLOCKED_QUEUE_LIMIT));
    const full = await getDashboardHomeReadModel(permissions, executive, now);

    expect(calls.class_sessions).toContainEqual(["in", ["status", ["scheduled", "in_progress"]]]);
    expect(calls.class_sessions).toContainEqual(["lte", ["session_date", "2026-10-12"]]);
    expect(full.unmarked.status).toBe("ready");
    const value = full.unmarked.status === "ready" ? full.unmarked.value : null;
    expect(value?.items.map((item) => [item.id, item.reason])).toEqual([
      ["stuck", "not_completed"],
      ["late", "not_started"],
    ]);
    expect(value?.truncated).toBe(true);

    loaders.getUnlockedSessionQueueResult.mockResolvedValue(queue(UNLOCKED_QUEUE_LIMIT - 1));
    const partial = await getDashboardHomeReadModel(permissions, executive, now);
    expect(partial.unmarked).toMatchObject({ status: "ready", value: { truncated: false } });
  });

  // Value: protects=a session completed between the overdue read and the lock-queue read is listed once (queue entry wins), and an empty-roster session never counts as "chờ khóa" (the lock RPC refuses it); fails_when=the id dedupe or the rosterCount > 0 guard is dropped; why_new=adversarial review found both; seam=none; no_claim=does not prove the RPC's roster math
  it("lists a session caught by both reads once and leaves empty-roster sessions out of the lock count", async () => {
    tables({
      class_sessions: (own) =>
        own.some(([method, args]) => method === "in" && args[0] === "status")
          ? { data: [sessionRow("both", "2026-10-12", "13:30:00", "15:30:00", "in_progress")], error: null }
          : { data: [], error: null },
    });
    loaders.getUnlockedSessionQueueResult.mockResolvedValue({
      data: {
        autoLockAfterDays: 0,
        items: [
          { classCode: "L-both", className: "Lớp both", id: "both", missingAttendanceCount: 1, rosterCount: 10, sessionDate: "2026-10-12", startTime: "13:30:00" },
          { classCode: "L-empty", className: "Lớp empty", id: "empty", missingAttendanceCount: 0, rosterCount: 0, sessionDate: "2026-10-11", startTime: "17:30:00" },
          { classCode: "L-done", className: "Lớp done", id: "done", missingAttendanceCount: 0, rosterCount: 12, sessionDate: "2026-10-11", startTime: "19:30:00" },
        ],
      },
      ok: true,
    });

    const model = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view", "sessions.lock", "classes.manage_schedule"], executive, now);

    const items = model.unmarked.status === "ready" ? model.unmarked.value.items : [];
    expect(items.map((item) => [item.id, item.reason])).toEqual([["both", "incomplete"]]);
    expect(model.awaitingLock).toEqual({ status: "ready", value: { count: 1, truncated: false } });
  });

  // Value: protects=a session whose embedded class did not come back (null or []) fails its feed, so the work list cannot claim "Không có việc tồn", while a viewer without classes.view still gets every session feed when classes do come back;
  // fails_when=a hidden-class row is silently dropped (a false "no sessions" / "no backlog"), turned into forbidden, or a classes.view gate returns and hides a TA's schedule;
  // why_new=hasHiddenClass was restored after the classes.view gate was reverted; seam=none; no_claim=does not prove which RLS policies hide classes
  it("fails today's, the upcoming and the unmarked feed when a session's class is hidden, and reads them without classes.view", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const hidden = (id: string, start: string, end: string, status: string, klass: null | [] = null) => ({ ...sessionRow(id, "2026-10-12", start, end, status), class: klass });
    // A TA as seeded: no classes.view.
    const permissions: PermissionCode[] = ["dashboard.view", "sessions.view", "attendance.mark"];
    const failed = { reason: "failed", status: "unavailable" };
    const isOverdueQuery = (own: Call[]) => own.some(([method, args]) => method === "in" && args[0] === "status");

    const normal = tables({
      class_sessions: (own) =>
        isOverdueQuery(own)
          ? { data: [sessionRow("o", "2026-10-12", "08:00:00", "10:00:00", "scheduled")], error: null }
          : { data: [sessionRow("t", "2026-10-12", "17:30:00", "19:30:00", "scheduled")], error: null },
    });
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    const seeded = await getDashboardHomeReadModel(permissions, executive, now);
    expect(normal.class_sessions).toBeDefined();
    expect(seeded.todaySessions.status === "ready" ? seeded.todaySessions.value.rows.map((row) => row.id) : null).toEqual(["t"]);
    expect(seeded.unmarked.status === "ready" ? seeded.unmarked.value.items.map((item) => item.id) : null).toEqual(["o"]);

    tables({ class_sessions: (own) => (own.some(([method, args]) => method === "eq" && args[0] === "session_date") ? { data: [hidden("t", "17:30:00", "19:30:00", "scheduled")], error: null } : { data: [], error: null }) });
    const today = await getDashboardHomeReadModel(permissions, executive, now);
    expect(today.todaySessions).toEqual(failed);
    // A returned failed feed (not only a throw) leaves a named log line.
    expect(errorLog).toHaveBeenCalledWith("DASHBOARD_FEED_FAILED", "today-sessions");
    expect(today.unmarked.status).toBe("ready");

    tables({
      class_sessions: (own) =>
        own.some(([method]) => method === "gt") ? { data: [{ ...hidden("u", "17:30:00", "19:30:00", "scheduled"), session_date: "2026-10-13" }], error: null } : { data: [], error: null },
    });
    const upcoming = await getDashboardHomeReadModel(permissions, executive, now);
    expect(upcoming.todaySessions.status).toBe("ready");
    expect(upcoming.upcomingSession).toEqual(failed);

    // One hidden row among visible ones still fails the whole feed.
    tables({
      class_sessions: (own) =>
        isOverdueQuery(own)
          ? { data: [sessionRow("o", "2026-10-12", "08:00:00", "10:00:00", "scheduled"), hidden("h", "10:00:00", "12:00:00", "in_progress", [])], error: null }
          : { data: [], error: null },
    });
    const unmarked = await getDashboardHomeReadModel(permissions, executive, now);
    expect(unmarked.unmarked).toEqual(failed);
    expect(unmarked.todaySessions.status).toBe("ready");
    const work = buildNeedsAction(unmarked);
    expect(work.failed).toContain("buổi chưa điểm danh");
    expect(hasNoBacklog(work)).toBe(false);
    errorLog.mockRestore();
  });

  // Value: protects=a loader that throws or rejects fails only its own feed; fails_when=guard() is removed and one rejected shared loader (timekeeping, care) rejects the whole home; why_new=only resolved error results were exercised; seam=none; no_claim=none
  it("turns a rejecting loader into a failed feed and leaves the other feeds ready", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tables({ crm_case_notes: { count: 2, data: null, error: null } });
    loaders.getCachedMyTimekeepingEntries.mockRejectedValue(new Error("rpc down"));
    loaders.getAttendanceVerificationPolicy.mockResolvedValue({ ok: false });
    loaders.getMyMonthlyTimekeepingEntries.mockResolvedValue({ entries: [], ok: true });
    loaders.getCareDashboard.mockRejectedValue(new Error("care down"));
    loaders.getCachedCurrentAuthUser.mockResolvedValue({ ok: true, user: { id: "user-1" } });

    const model = await getDashboardHomeReadModel(["dashboard.view", "timekeeping.check", "student_care.view", "student_care.handle", "crm.view", "crm.update"], executive, now);

    const failed = { reason: "failed", status: "unavailable" };
    expect(model.timekeeping).toEqual(failed);
    expect(model.careOverdue).toEqual(failed);
    expect(model.myMonth.status).toBe("ready");
    expect(model.crmFollowUps).toEqual({ status: "ready", value: 2 });
    // Each failed feed leaves a named server log line.
    expect(errorLog).toHaveBeenCalledWith("DASHBOARD_FEED_FAILED", "timekeeping", "rpc down");
    expect(errorLog).toHaveBeenCalledWith("DASHBOARD_FEED_FAILED", "care-overdue", "care down");
    errorLog.mockRestore();
  });

  // Value: protects=CRM follow-ups are never read for a viewer who cannot open /crm; fails_when=the loader keys off crm.update alone; why_new=crmFollowUps now needs crm.view too; seam=none; no_claim=none
  it("never reads CRM follow-ups without crm.view", async () => {
    tables({});
    const model = await getDashboardHomeReadModel(["dashboard.view", "crm.update"], executive, now);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(loaders.getCachedCurrentAuthUser).not.toHaveBeenCalled();
    expect(model.crmFollowUps).toEqual({ reason: "forbidden", status: "unavailable" });
  });

  // Value: protects=after checking out, the strip knows the latest check-out of today and not one from another work day, and an open shift wins over it;
  // fails_when=lastCheckOutAt takes the first or an unsorted entry, counts yesterday's shift, or stays set while a shift is open; why_new=lastCheckOutAt is new; seam=none; no_claim=does not prove the timekeeping RPC's rows
  it("reports today's latest check-out only when no shift is open", async () => {
    tables({});
    const entry = (id: string, workDate: string, checkOutAt: string | null, status = "closed") => ({ checkInAt: `${workDate}T01:00:00Z`, checkInMode: "offline", checkOutAt, id, status, workDate, workShiftName: null });
    loaders.getAttendanceVerificationPolicy.mockResolvedValue({ ok: false });
    loaders.getCachedMyTimekeepingEntries.mockResolvedValue({
      // Only the sort makes c (08:30) the last of today's check-outs; y belongs to yesterday's work day.
      entries: [entry("c", "2026-10-12", "2026-10-12T08:30:00Z"), entry("y", "2026-10-11", "2026-10-12T08:45:00Z"), entry("b", "2026-10-12", "2026-10-12T05:00:00Z")],
      ok: true,
    });

    const done = await getDashboardHomeReadModel(["dashboard.view", "timekeeping.check", "classes.manage_schedule"], executive, now);
    expect(done.timekeeping).toEqual({ status: "ready", value: { lastCheckOutAt: "2026-10-12T08:30:00Z", openEntry: null, policy: null } });

    loaders.getCachedMyTimekeepingEntries.mockResolvedValue({ entries: [entry("c", "2026-10-12", "2026-10-12T05:00:00Z"), entry("o", "2026-10-12", null, "open")], ok: true });
    const open = await getDashboardHomeReadModel(["dashboard.view", "timekeeping.check", "classes.manage_schedule"], executive, now);
    expect(open.timekeeping).toMatchObject({ status: "ready", value: { lastCheckOutAt: null, openEntry: { id: "o" } } });
  });

  // Value: protects=week attendance is counted in the database over this week's started or completed sessions (no rows, no session cap), and one failed count fails the feed;
  // fails_when=the counts drop the !inner session embed or its date/status filters, count rows client-side, swap present and absent, or a failed count reads as 0;
  // why_new=loadWeekAttendance was rewritten to two head counts; seam=none; no_claim=does not prove PostgREST filters on the embedded resource as written
  it("counts this week's present and absent marks with two head-only queries", async () => {
    const attendance = (absentError: unknown = null): TableResult => (own) => {
      const statuses = own.find(([method, args]) => method === "in" && args[0] === "attendance_status")?.[1][1] as string[];
      return statuses.includes("present") ? { count: 93, data: null, error: null } : { count: 7, data: null, error: absentError };
    };
    const calls = tables({ class_sessions: { data: [], error: null }, session_attendance: attendance() });
    const permissions: PermissionCode[] = ["dashboard.view", "classes.view", "sessions.view", "attendance.view", "classes.manage_schedule"];
    // Wednesday 14/10 16:00 in Vietnam: the week started on Monday 12/10.
    const wednesday = new Date("2026-10-14T09:00:00.000Z");

    const model = await getDashboardHomeReadModel(permissions, executive, wednesday);

    expect(model.weekAttendance).toEqual({ status: "ready", value: { absent: 7, present: 93 } });
    const selects = calls.session_attendance.filter(([method]) => method === "select");
    expect(selects).toHaveLength(2);
    for (const [, args] of selects) expect(args).toEqual(["id, session:class_sessions!inner(session_date, status)", { count: "exact", head: true }]);
    expect(calls.session_attendance).toEqual(
      expect.arrayContaining([
        ["in", ["attendance_status", ["present"]]],
        ["in", ["attendance_status", ["excused_absence", "unexcused_absence"]]],
        ["gte", ["session.session_date", "2026-10-12"]],
        ["lte", ["session.session_date", "2026-10-14"]],
        ["in", ["session.status", ["in_progress", "completed"]]],
      ]),
    );
    expect(calls.session_attendance.filter(([method, args]) => method === "in" && args[0] === "session.status")).toHaveLength(2);

    tables({ class_sessions: { data: [], error: null }, session_attendance: attendance({ message: "boom" }) });
    const broken = await getDashboardHomeReadModel(permissions, executive, wednesday);
    expect(broken.weekAttendance).toEqual({ reason: "failed", status: "unavailable" });
  });

  // Value: protects=a missing or failed executive read fails only the attention, aging and student-status feeds, and a rejection is caught from the start (never unhandled while feeds load);
  // fails_when=a null/rejected executive throws the whole home or blanks another feed, or the catch is attached only after the feeds settle so a rejection during a slow feed surfaces as an unhandled rejection;
  // why_new=executive may be null or a promise and the catch moved to function entry; seam=one feed (care) yields a macrotask before resolving; no_claim=does not prove the route's own catch (see home-route.test.tsx)
  it("fails only the executive feeds when the executive read is missing, rejects or resolves null", async () => {
    const failed = { reason: "failed", status: "unavailable" };
    const permissions: PermissionCode[] = ["dashboard.view", "sepay.view", "student_care.view", "student_care.handle"];
    // A slow feed: the loader is still awaiting it a full macrotask after the executive promise has rejected.
    loaders.getCareDashboard.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { total: 1 };
    });

    for (const [label, input] of [
      ["null", () => null],
      ["rejected", () => Promise.reject(new Error("rpc"))],
      ["resolved null", () => Promise.resolve(null)],
    ] as const) {
      tables({ sepay_transactions: { count: 0, data: [], error: null } });
      const model = await getDashboardHomeReadModel(permissions, input(), now);

      expect(model.executive, label).toEqual({ attention: failed, receivablesAging: failed, studentStatus: failed });
      expect(model.sepay, label).toEqual({ status: "ready", value: { count: 0, oldestAt: null, totalIsPartial: false, totalVnd: 0 } });
      expect(model.careOverdue, label).toEqual({ status: "ready", value: 1 });
    }

    tables({ sepay_transactions: { count: 0, data: [], error: null } });
    const pending = await getDashboardHomeReadModel(permissions, Promise.resolve(executive), now);
    expect(pending.executive.attention).toEqual({ status: "ready", value: [] });
  });

  // Value: protects=the coming week's session is read only when nothing is left today; fails_when=the upcoming query runs on every load; why_new=upcoming now chains off today's read; seam=none; no_claim=none
  it("skips the upcoming-session read while a session is still ahead today", async () => {
    const calls = tables({
      class_sessions: (own) =>
        own.some(([method]) => method === "gt")
          ? { data: [sessionRow("next", "2026-10-13", "17:30:00", "19:30:00", "scheduled")], error: null }
          : { data: [sessionRow("eve", "2026-10-12", "17:30:00", "19:30:00", "scheduled")], error: null },
    });
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const model = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view"], executive, now);

    expect(calls.class_sessions.some(([method]) => method === "gt")).toBe(false);
    expect(model.upcomingSession).toEqual({ status: "ready", value: null });
    expect(model.todaySessions).toMatchObject({ status: "ready", value: { rows: [expect.objectContaining({ id: "eve" })] } });
  });

  // Value: protects=a draft period never reads items, a failed items or periods read fails the feed (never 0 ₫), and no periods is an honest "none yet";
  // fails_when=a draft period queries items, a failed items read shows an empty locked period, or no periods reads as failed; why_new=only the locked, successful path was exercised; seam=none; no_claim=none
  it("handles draft, missing and failed tuition reads", async () => {
    const permissions: PermissionCode[] = ["dashboard.view", "finance.view", "payments.view", "tuition_periods.view"];
    const locked = { due_on: "2026-10-15", ends_on: "2026-10-31", id: "oct", name: "tháng 10/2026", starts_on: "2026-10-01", status: "locked" };

    const draftCalls = tables({ tuition_collection_periods: { data: [{ ...locked, status: "draft" }], error: null } });
    const draft = await getDashboardHomeReadModel(permissions, executive, now);
    expect(draftCalls.tuition_collection_items).toBeUndefined();
    expect(draft.tuition).toEqual({ status: "ready", value: expect.objectContaining({ payableVnd: 0, periodId: "oct", requestCount: 0, status: "draft" }) });

    tables({ tuition_collection_items: { data: null, error: { message: "boom" } }, tuition_collection_periods: { data: [locked], error: null } });
    expect((await getDashboardHomeReadModel(permissions, executive, now)).tuition).toEqual({ reason: "failed", status: "unavailable" });

    tables({ tuition_collection_periods: { data: null, error: { message: "boom" } } });
    expect((await getDashboardHomeReadModel(permissions, executive, now)).tuition).toEqual({ reason: "failed", status: "unavailable" });

    tables({ tuition_collection_periods: { data: [], error: null } });
    expect((await getDashboardHomeReadModel(permissions, executive, now)).tuition).toEqual({ status: "ready", value: null });
  });

  // Value: protects=a SePay backlog with more transactions than were summed is marked partial; fails_when=totalIsPartial compares the wrong numbers or a missing count is treated as partial; why_new=only an exact backlog was exercised; seam=none; no_claim=none
  it("marks the SePay total partial when the count exceeds the rows summed", async () => {
    const rows = [{ amount_vnd: 300_000, transaction_at: "2026-10-01T01:00:00Z" }, { amount_vnd: "200000", transaction_at: "2026-10-02T01:00:00Z" }];

    tables({ sepay_transactions: { count: 600, data: rows, error: null } });
    const partial = await getDashboardHomeReadModel(["dashboard.view", "sepay.view"], executive, now);
    expect(partial.sepay).toEqual({ status: "ready", value: { count: 600, oldestAt: "2026-10-01T01:00:00Z", totalIsPartial: true, totalVnd: 500_000 } });

    tables({ sepay_transactions: { count: null, data: rows, error: null } });
    const uncounted = await getDashboardHomeReadModel(["dashboard.view", "sepay.view"], executive, now);
    expect(uncounted.sepay).toMatchObject({ status: "ready", value: { count: 2, totalIsPartial: false } });
  });

  // Value: protects=a TA's missing results are computed from the lock queue's sessions, counting present and additional-study students without a result, and a failed results read fails the feed;
  // fails_when=the attendance or results read targets other sessions, absent students count as missing, or a results error shows as "nothing missing"; why_new=loadMissingResults only ran with an empty queue; seam=none; no_claim=does not prove the lock queue's contents
  it("finds missing results for the lock queue's sessions and fails on a results read error", async () => {
    const permissions: PermissionCode[] = ["dashboard.view", "classes.view", "sessions.view", "attendance.view", "results.view", "results.manage"];
    loaders.getUnlockedSessionQueueResult.mockResolvedValue({
      data: {
        autoLockAfterDays: 0,
        items: [
          { classCode: "L-q1", className: "Lớp q1", id: "q1", missingAttendanceCount: 0, rosterCount: 3, sessionDate: "2026-10-10", startTime: "17:30:00" },
          { classCode: "L-q2", className: "Lớp q2", id: "q2", missingAttendanceCount: 0, rosterCount: 2, sessionDate: "2026-10-11", startTime: "19:30:00" },
          { classCode: "L-q3", className: "Lớp q3", id: "q3", missingAttendanceCount: 0, rosterCount: 1, sessionDate: "2026-10-11", startTime: "08:00:00" },
        ],
      },
      ok: true,
    });
    const attendance = {
      data: [
        { attendance_status: "present", class_session_id: "q1", student_id: "a" },
        { attendance_status: "present", class_session_id: "q1", student_id: "b" },
        { attendance_status: "unexcused_absence", class_session_id: "q1", student_id: "c" },
        { attendance_status: "additional_study", class_session_id: "q2", student_id: "d" },
        { attendance_status: "excused_absence", class_session_id: "q2", student_id: "e" },
        { attendance_status: "present", class_session_id: "q3", student_id: "f" },
      ],
      error: null,
    };
    const calls = tables({
      class_sessions: { data: [], error: null },
      session_attendance: attendance,
      session_results: { data: [{ class_session_id: "q1", student_id: "a" }, { class_session_id: "q3", student_id: "f" }], error: null },
    });

    const model = await getDashboardHomeReadModel(permissions, executive, now);

    expect(model.missingResults).toEqual({
      status: "ready",
      value: [
        { classCode: "L-q1", className: "Lớp q1", id: "q1", missing: 1, present: 2, sessionDate: "2026-10-10", startTime: "17:30:00" },
        { classCode: "L-q2", className: "Lớp q2", id: "q2", missing: 1, present: 1, sessionDate: "2026-10-11", startTime: "19:30:00" },
      ],
    });
    expect(calls.session_attendance).toContainEqual(["in", ["class_session_id", ["q1", "q2", "q3"]]]);
    expect(calls.session_results).toContainEqual(["in", ["class_session_id", ["q1", "q2", "q3"]]]);

    tables({ class_sessions: { data: [], error: null }, session_attendance: attendance, session_results: { data: null, error: { message: "boom" } } });
    const broken = await getDashboardHomeReadModel(permissions, executive, now);
    expect(broken.missingResults).toEqual({ reason: "failed", status: "unavailable" });
  });

  // Value: protects=a locked session's roster and tally come from its attendance (no roster RPC), and without attendance.view it stays unresolved instead of 0/0;
  // fails_when=locked sessions call the roster RPC, read their roster from the wrong source, or show 0 students when attendance cannot be read; why_new=only open sessions were exercised; seam=none; no_claim=does not prove the lock rule that makes attendance a complete roster
  it("reads a locked session's roster off its attendance and leaves it unresolved without attendance.view", async () => {
    tables({
      class_sessions: (own) =>
        own.some(([method, args]) => method === "eq" && args[0] === "session_date")
          ? {
              data: [
                sessionRow("locked", "2026-10-12", "08:00:00", "10:00:00", "completed", "2026-10-12T04:00:00Z"),
                sessionRow("open", "2026-10-12", "17:30:00", "19:30:00", "scheduled"),
              ],
              error: null,
            }
          : { data: [], error: null },
      session_attendance: {
        data: [
          { attendance_status: "present", class_session_id: "locked", student_id: "a" },
          { attendance_status: "unexcused_absence", class_session_id: "locked", student_id: "b" },
        ],
        error: null,
      },
    });
    supabase.rpc.mockResolvedValue({ data: [{ enrollment_class_id: "class-open", student_id: "x" }], error: null });

    const viewer = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view", "attendance.view"], executive, now);

    const rows = viewer.todaySessions.status === "ready" ? viewer.todaySessions.value.rows : [];
    expect(rows.map((row) => [row.id, row.rosterCount, row.attendance])).toEqual([
      ["locked", 2, { absent: 1, additional: 0, present: 1, unmarked: 0 }],
      ["open", 1, { absent: 0, additional: 0, present: 0, unmarked: 1 }],
    ]);
    expect(supabase.rpc.mock.calls.map(([, args]) => (args as { p_class_session_id: string }).p_class_session_id)).toEqual(["open"]);

    supabase.rpc.mockClear();
    const blind = await getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view"], executive, now);
    const blindRows = blind.todaySessions.status === "ready" ? blind.todaySessions.value.rows : [];
    expect(blindRows.map((row) => [row.id, row.rosterCount, row.attendance])).toEqual([
      ["locked", null, null],
      ["open", 1, null],
    ]);
    expect(supabase.rpc.mock.calls.map(([, args]) => (args as { p_class_session_id: string }).p_class_session_id)).toEqual(["open"]);
  });

  // Value: protects=the coming week's session read starts from today's raw rows, alongside their roster calls, not after them; fails_when=upcoming waits for fillRosters, so a slow roster RPC delays the next-session card; why_new=upcoming now chains off readTodaySessions; seam=the roster RPC is held open; no_claim=does not measure real latency
  it("starts the upcoming-session read before today's roster calls finish", async () => {
    let releaseRoster: (value: unknown) => void = () => undefined;
    const calls = tables({
      class_sessions: (own) =>
        own.some(([method]) => method === "gt")
          ? { data: [sessionRow("next", "2026-10-13", "17:30:00", "19:30:00", "scheduled")], error: null }
          : { data: [sessionRow("done", "2026-10-12", "08:00:00", "10:00:00", "completed")], error: null },
    });
    supabase.rpc.mockImplementation((_name: string, args: { p_class_session_id: string }) =>
      args.p_class_session_id === "done" ? new Promise((resolve) => (releaseRoster = resolve)) : Promise.resolve({ data: [], error: null }),
    );

    const pending = getDashboardHomeReadModel(["dashboard.view", "classes.view", "sessions.view"], executive, now);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.class_sessions.some(([method]) => method === "gt")).toBe(true);
    releaseRoster({ data: [], error: null });
    const model = await pending;
    expect(model.upcomingSession).toEqual({ status: "ready", value: expect.objectContaining({ id: "next" }) });
  });
});
