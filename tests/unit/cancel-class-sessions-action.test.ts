// Value: protects=bulk cancel from the class page stays owner-only (sessions.manage AND classes.manage_schedule), only cancels sessions of the given class, runs the same cancel_class_session RPC per session without stopping on a failure, and revalidates once after the loop;
// fails_when=a permission check is dropped or a failed lookup falls through, bad input reaches the database, a component class's session is cancelled from a parent page, one failed RPC aborts the rest or is counted as cancelled, or revalidatePath runs per session;
// why_new=new public server action replacing N client-side cancelSessionAction calls (owner decision D6);
// seam=none; no_claim=does not prove cancel_class_session or RLS accept these calls
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

/** Supabase double: `ownIds` are the rows the class_sessions lookup returns; `rpc` answers per session. */
function mockClient({ lookupError = null, ownIds, rpc }: { lookupError?: unknown; ownIds: string[]; rpc: (sessionId: string) => unknown }) {
  const lookup = { eq: vi.fn(), in: vi.fn(), select: vi.fn() };
  lookup.select.mockReturnValue(lookup);
  lookup.eq.mockReturnValue(lookup);
  lookup.in.mockResolvedValue({ data: lookupError ? null : ownIds.map((id) => ({ id })), error: lookupError });
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
    ["more than 100 sessions", { classId, reason: "Trùng lịch thi", sessionIds: Array.from({ length: 101 }, (_, index) => `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`) }, "Mỗi lần chỉ hủy được tối đa 100 buổi."],
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

  it("cancels nothing when the class lookup fails, and skips revalidation when nothing was cancelled", async () => {
    mocks.getCachedDatabasePermissions.mockResolvedValue(owner);
    const failedLookup = mockClient({ lookupError: { message: "boom" }, ownIds: [], rpc: () => ({ data: null, error: null }) });

    const lookupResult = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA] });

    expect(lookupResult.status).toBe("error");
    expect(failedLookup.client.rpc).not.toHaveBeenCalled();

    const allFailed = mockClient({ ownIds: [sessionA], rpc: () => ({ data: null, error: { message: "LOCKED_CLASS_SESSION_IS_IMMUTABLE" } }) });
    const result = await cancelClassSessionsAction({ classId, reason: "Trùng lịch thi", sessionIds: [sessionA] });

    expect(result).toEqual({ cancelled: 0, failed: [{ message: "Buổi học đã khóa nên không thể thay đổi.", sessionId: sessionA }], status: "success" });
    expect(allFailed.client.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
