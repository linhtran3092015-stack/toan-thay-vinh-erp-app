// Value: protects=bulk cancel from the class page stays owner-only (sessions.manage AND classes.manage_schedule), only cancels scheduled, unlocked sessions of the given class, caps one call at 40 sessions, runs the same cancel_class_session RPC per session without stopping on a failure, maps the RPC's lock/status errors to Vietnamese, and revalidates once after the loop;
// fails_when=a permission check is dropped or a failed lookup falls through, bad input reaches the database, a component class's session or an in-progress/locked session reaches the RPC, the cap is raised, one failed RPC aborts the rest or is counted as cancelled, a real RPC error code falls back to the generic message, revalidatePath runs per session, or a refused-only call leaves the class page stale;
// why_new=new public server action replacing N client-side cancelSessionAction calls (owner decision D6); status pre-filter, 40 cap and error codes added after red-team review;
// seam=none; no_claim=does not prove cancel_class_session or RLS accept these calls, nor that a session cannot start between the lookup and the RPC
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getDatabasePermissions: vi.fn(),
  revalidatePath: vi.fn(),
  server: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: mocks.getCachedDatabasePermissions,
  getDatabasePermissions: mocks.getDatabasePermissions,
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));

import { cancelClassSessionsAction } from "@/features/sessions/actions/session-lifecycle-actions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";

const classId = "4f8219f4-2f39-4833-b596-ad5137ed27a3";
const sessionA = "11111111-1111-4111-8111-111111111111";
const sessionB = "22222222-2222-4222-8222-222222222222";
const sessionC = "33333333-3333-4333-8333-333333333333";
const otherClassSession = "44444444-4444-4444-8444-444444444444";
const owner = { ok: true, permissions: ["sessions.manage", "classes.manage_schedule"] };

type LookupRow = { id: string; locked_at?: string | null; status?: string };

/**
 * Supabase double: `ownIds` are the rows the class_sessions lookup returns (a bare id
 * is a scheduled, unlocked session); `rpc` answers per session.
 */
function mockClient({
  lookupError = null,
  ownIds,
  recheck,
  rpc,
}: {
  lookupError?: unknown;
  ownIds: Array<string | LookupRow>;
  /** Answer for the per-session re-read just before the RPC; defaults to the first lookup's row. */
  recheck?: (sessionId: string) => { data: LookupRow[] | null; error: unknown };
  rpc: (sessionId: string) => unknown;
}) {
  const lookup = { eq: vi.fn(), in: vi.fn(), select: vi.fn() };
  lookup.select.mockReturnValue(lookup);
  lookup.eq.mockReturnValue(lookup);
  const rows = ownIds.map((row) => ({ locked_at: null, status: "scheduled", ...(typeof row === "string" ? { id: row } : row) }));
  let firstLookup = true;
  lookup.in.mockImplementation(async (_column: string, ids: string[]) => {
    if (firstLookup) {
      firstLookup = false;
      return { data: lookupError ? null : rows, error: lookupError };
    }
    if (recheck) return recheck(ids[0]);
    return { data: rows.filter((row) => ids.includes(row.id)), error: null };
  });
  const client = {
    from: vi.fn().mockReturnValue(lookup),
    rpc: vi.fn().mockImplementation(async (_name: string, args: { p_class_session_id: string }) => rpc(args.p_class_session_id)),
  };
  mocks.server.mockResolvedValue(client);
  return { client, lookup };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cancelClassSessionsAction", () => {
  it("returns an error and calls nothing when the permission lookup fails", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue({ ok: false });
    const { client } = mockClient({ ownIds: [sessionA], rpc: () => ({ data: { id: sessionA }, error: null }) });

    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA] });

    expect(result.status).toBe("error");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [["classes.manage_schedule"], "sessions.manage"],
    [["sessions.manage"], "classes.manage_schedule"],
  ])("denies a role holding only %j", async (permissions, missing) => {
    mocks.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });
    const { client } = mockClient({ ownIds: [sessionA], rpc: () => ({ data: { id: sessionA }, error: null }) });

    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA] });

    expect(result).toEqual({ fieldErrors: undefined, message: permissionDeniedMessage(missing), status: "error" });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["no sessions", { classId, reason: "Trùng lịch thi", sessionIds: [] }, "Chọn ít nhất 1 buổi học cần hủy."],
    ["a duplicated session", { classId, reason: "Trùng lịch thi", sessionIds: [sessionA, sessionA] }, "Danh sách buổi học bị trùng."],
    ["more than 40 sessions", { classId, reason: "Trùng lịch thi", sessionIds: Array.from({ length: 41 }, (_, index) => `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`) }, "Mỗi lần chỉ hủy được tối đa 40 buổi."],
    ["a short reason", { classId, reason: "  ab ", sessionIds: [sessionA] }, "Lý do hủy phải có ít nhất 3 ký tự."],
    ["a non-uuid session", { classId, reason: "Trùng lịch thi", sessionIds: ["s-1"] }, "Mã buổi học không hợp lệ."],
  ])("rejects %s before touching the database", async (_label, input, message) => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    const { client } = mockClient({ ownIds: [sessionA], rpc: () => ({ data: { id: sessionA }, error: null }) });

    const result = await cancelClassSessionsAction(input);

    expect(result.status).toBe("error");
    expect(result.status === "error" ? JSON.stringify(result) : "").toContain(message);
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("cancels the class's sessions one by one, reports failures per session and revalidates once", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    const { client, lookup } = mockClient({
      ownIds: [sessionA, sessionB, sessionC],
      rpc: (sessionId) => {
        if (sessionId === sessionB) return { data: null, error: { message: "CLASS_SESSION_CANCEL_TRANSITION_INVALID" } };
        if (sessionId === sessionC) throw new Error("network down");
        return { data: { id: sessionId }, error: null };
      },
    });

    const result = await cancelClassSessionsAction({ classId, reason: "  Trùng lịch thi  ", sessionIds: [sessionA, sessionB, sessionC] });

    expect(result).toEqual({
      cancelled: 1,
      failed: [
        { message: "Trạng thái hiện tại không cho phép hủy buổi học.", sessionId: sessionB },
        { message: "Không thể kết nối tới hệ thống buổi học.", sessionId: sessionC },
      ],
      status: "success",
    });
    expect(lookup.select).toHaveBeenCalledWith("id, status, locked_at");
    expect(lookup.eq).toHaveBeenCalledWith("class_id", classId);
    expect(lookup.in).toHaveBeenCalledWith("id", [sessionA, sessionB, sessionC]);
    expect(client.rpc.mock.calls).toEqual([
      ["cancel_class_session", { p_class_session_id: sessionA, p_reason: "Trùng lịch thi" }],
      ["cancel_class_session", { p_class_session_id: sessionB, p_reason: "Trùng lịch thi" }],
      ["cancel_class_session", { p_class_session_id: sessionC, p_reason: "Trùng lịch thi" }],
    ]);
    // One revalidation pass after the loop, not one per session.
    expect(mocks.revalidatePath.mock.calls).toEqual([["/sessions"], ["/sessions/[sessionId]", "page"], [`/classes/${classId}`]]);
    const lastRpc = Math.max(...client.rpc.mock.invocationCallOrder);
    expect(Math.min(...mocks.revalidatePath.mock.invocationCallOrder)).toBeGreaterThan(lastRpc);
  });

  it("refuses sessions that do not belong to the class without calling the RPC for them", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    const { client } = mockClient({ ownIds: [sessionA], rpc: (sessionId) => ({ data: { id: sessionId }, error: null }) });

    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [otherClassSession, sessionA] });

    expect(result).toEqual({
      cancelled: 1,
      failed: [{ message: "Buổi học không thuộc lớp này nên không hủy ở đây.", sessionId: otherClassSession }],
      status: "success",
    });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("cancel_class_session", { p_class_session_id: sessionA, p_reason: "Trùng lịch thi" });
  });

  it("cancels nothing when the class lookup fails, and refreshes only the class page when nothing was cancelled", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    const failedLookup = mockClient({ lookupError: { message: "boom" }, ownIds: [], rpc: () => ({ data: null, error: null }) });

    const lookupResult = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA] });

    expect(lookupResult.status).toBe("error");
    expect(failedLookup.client.rpc).not.toHaveBeenCalled();

    const allFailed = mockClient({ ownIds: [sessionA], rpc: () => ({ data: null, error: { message: "LOCKED_CLASS_SESSION_IS_IMMUTABLE" } }) });
    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA] });

    expect(result).toEqual({ cancelled: 0, failed: [{ message: "Buổi học đã khóa nên không thể thay đổi.", sessionId: sessionA }], status: "success" });
    expect(allFailed.client.rpc).toHaveBeenCalledTimes(1);
    // The refused session's state was stale on the page: refresh the class page only, not the session routes.
    expect(mocks.revalidatePath.mock.calls).toEqual([[`/classes/${classId}`]]);
  });

  it("accepts exactly 40 sessions", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    const ids = Array.from({ length: 40 }, (_, index) => `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`);
    const { client } = mockClient({ ownIds: ids, rpc: (sessionId) => ({ data: { id: sessionId }, error: null }) });

    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: ids });

    expect(result).toEqual({ cancelled: 40, failed: [], status: "success" });
    expect(client.rpc).toHaveBeenCalledTimes(40);
  });

  it("never sends an in-progress, locked or already cancelled session to the RPC", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    const inProgress = sessionB;
    const lockedScheduled = sessionC;
    const { client } = mockClient({
      ownIds: [
        sessionA,
        { id: inProgress, status: "in_progress" },
        { id: lockedScheduled, locked_at: "2026-10-12T15:00:00Z", status: "scheduled" },
        { id: otherClassSession, status: "cancelled" },
      ],
      rpc: (sessionId) => ({ data: { id: sessionId }, error: null }),
    });

    const result = await cancelClassSessionsAction({
      classId,
      reason: "Trùng lịch thi",
      sessionIds: [sessionA, inProgress, lockedScheduled, otherClassSession],
    });

    const refused = "Buổi học đã bắt đầu, đã khóa hoặc đã hủy nên không hủy hàng loạt.";
    expect(result).toEqual({
      cancelled: 1,
      failed: [
        { message: refused, sessionId: inProgress },
        { message: refused, sessionId: lockedScheduled },
        { message: refused, sessionId: otherClassSession },
      ],
      status: "success",
    });
    expect(client.rpc.mock.calls).toEqual([["cancel_class_session", { p_class_session_id: sessionA, p_reason: "Trùng lịch thi" }]]);
  });

  // Value: protects=an RPC call that returns neither an error nor a row id is reported as a failed session, never counted as cancelled;
  // fails_when=the `!data?.id` branch is dropped or folded into the success path, so the owner reads "Đã hủy" for a session the database did not confirm and session routes are revalidated for it;
  // why_new=every existing RPC double returns `{ id }` or an error; the empty-result branch had no test;
  // seam=none; no_claim=does not prove cancel_class_session ever returns an empty row in production
  // Value: protects=a session that started (or was locked) after the batch lookup is re-read and refused just before its RPC, and a failed re-read never falls through to the RPC;
  // fails_when=the per-session re-read is removed (cancel_class_session would cancel an in_progress session) or a re-read error/empty result still calls the RPC or counts as cancelled;
  // why_new=the batch lookup alone left a window of up to 40 sequential RPCs in which a teacher could start a session (owner decision D9);
  // seam=none; no_claim=does not close the window between the re-read and the RPC; that needs a guard inside cancel_class_session
  it("re-reads each session just before its RPC and refuses one that started since the lookup", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    const { client } = mockClient({
      ownIds: [sessionA, sessionB, sessionC],
      recheck: (sessionId) => {
        if (sessionId === sessionA) return { data: [{ id: sessionA, locked_at: null, status: "in_progress" }], error: null };
        if (sessionId === sessionB) return { data: null, error: { message: "timeout" } };
        return { data: [{ id: sessionC, locked_at: null, status: "scheduled" }], error: null };
      },
      rpc: (sessionId) => ({ data: { id: sessionId }, error: null }),
    });

    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA, sessionB, sessionC] });

    expect(result).toEqual({
      cancelled: 1,
      failed: [
        { message: "Buổi học vừa được bắt đầu, khóa hoặc hủy nên không hủy hàng loạt.", sessionId: sessionA },
        { message: "Không thể kiểm tra lại buổi học nên chưa hủy.", sessionId: sessionB },
      ],
      status: "success",
    });
    expect(client.rpc.mock.calls.map(([, args]) => args.p_class_session_id)).toEqual([sessionC]);
  });

  it("counts a session as failed when the RPC returns no row id", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    mockClient({
      ownIds: [sessionA, sessionB],
      rpc: (sessionId) => (sessionId === sessionA ? { data: null, error: null } : { data: {}, error: null }),
    });

    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA, sessionB] });

    expect(result).toEqual({
      cancelled: 0,
      failed: [
        { message: "Database không trả về kết quả hủy buổi học.", sessionId: sessionA },
        { message: "Database không trả về kết quả hủy buổi học.", sessionId: sessionB },
      ],
      status: "success",
    });
    // Nothing confirmed: only the class page is refreshed, not the session routes.
    expect(mocks.revalidatePath.mock.calls).toEqual([[`/classes/${classId}`]]);
  });

  // Value: protects=a Supabase client that cannot be created returns a whole-batch error saying nothing was cancelled, without revalidating;
  // fails_when=the try/catch around createSupabaseServerClient is removed (the action throws and the dialog shows a generic network error) or the error is reported as a success with zero cancelled;
  // why_new=only a lookup error was tested; a throw while creating the client takes a different catch branch;
  // seam=none; no_claim=does not prove which failures make createSupabaseServerClient throw
  it("cancels nothing and says so when the database client cannot be created", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    mocks.server.mockRejectedValue(new Error("cookies unavailable"));

    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA] });

    expect(result).toEqual({
      fieldErrors: undefined,
      message: "Không thể kết nối tới hệ thống buổi học. Chưa hủy buổi nào.",
      status: "error",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  // Messages exactly as cancel_class_session raises them (20260725120000_session_lifecycle_workflows.sql).
  it.each([
    ["CLASS_SESSION_ALREADY_LOCKED", "Buổi học đã khóa nên không hủy được."],
    ["CLASS_SESSION_CANCEL_STATUS_INVALID", "Buổi học không còn ở trạng thái có thể hủy."],
    ["CLASS_SESSION_CANCEL_TRANSITION_INVALID", "Trạng thái hiện tại không cho phép hủy buổi học."],
  ])("maps the RPC error %s to its Vietnamese message", async (databaseMessage, userMessage) => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    mockClient({ ownIds: [sessionA], rpc: () => ({ data: null, error: { code: "23514", message: databaseMessage } }) });

    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA] });

    expect(result).toEqual({ cancelled: 0, failed: [{ message: userMessage, sessionId: sessionA }], status: "success" });
  });
});
