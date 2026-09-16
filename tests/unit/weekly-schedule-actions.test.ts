import { afterEach, describe, expect, it, vi } from "vitest";
import { saveWeeklyAssignmentAction } from "@/features/timekeeping/weekly-schedule-actions";
import { getTimekeepingSchedule } from "@/features/timekeeping/data";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), rpc: vi.fn(), client: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getDatabasePermissions: mocks.permission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
const input = { weekStart: "2026-09-14", weekday: 2, staffId: "11111111-1111-4111-8111-111111111111", workShiftId: "22222222-2222-4222-8222-222222222222", expectedAssignmentId: null, expectedUpdatedAt: null, reason: "Lịch tuần" };
function allow() {
  mocks.permission.mockResolvedValue({ ok: true, permissions: ["staff.manage"] });
  // Catch detached supabase.rpc regressions that ordinary mocks hide.
  const client = { rpc(this: unknown, ...args: unknown[]) { expect(this).toBe(client); return mocks.rpc(...args); } };
  mocks.client.mockResolvedValue(client);
}
afterEach(() => vi.resetAllMocks());
describe("weekly schedule server boundary", () => {
  it("does not write without management permission or valid input", async () => {
    mocks.permission.mockResolvedValue({ ok: true, permissions: [] });
    expect((await saveWeeklyAssignmentAction(input)).status).toBe("error");
    allow();
    expect((await saveWeeklyAssignmentAction({ ...input, weekStart: "bad" })).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves selected week and optimistic concurrency and invalidates on success", async () => {
    allow(); mocks.rpc.mockResolvedValue({ data: input.staffId, error: null });
    expect((await saveWeeklyAssignmentAction(input)).status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("save_weekly_shift_assignment", {
      p_week_start: "2026-09-14", p_weekday: 2, p_staff_id: input.staffId, p_work_shift_id: input.workShiftId,
      p_expected_assignment_id: null, p_expected_updated_at: null, p_reason: "Lịch tuần",
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/timekeeping");
  });
  it("cancellation sends null shift; stale saves and connection failures do not invalidate", async () => {
    allow(); mocks.rpc.mockResolvedValue({ data: null, error: { message: "WEEKLY_SCHEDULE_CONFLICT" } });
    expect((await saveWeeklyAssignmentAction({ ...input, workShiftId: null })).message).toContain("người khác");
    expect(mocks.rpc.mock.calls[0][1].p_work_shift_id).toBeNull();
    mocks.client.mockRejectedValue(new Error("offline"));
    expect((await saveWeeklyAssignmentAction(input)).status).toBe("error");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("distinguishes an empty week from missing migration, malformed response or network failure", async () => {
    allow(); mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await getTimekeepingSchedule("2026-09-21")).toEqual({ ok: true, entries: [] });
    expect(mocks.rpc).toHaveBeenCalledWith("get_weekly_shift_schedule", { p_week_start: "2026-09-21" });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "function not found" } });
    expect((await getTimekeepingSchedule("2026-09-21")).ok).toBe(false);
    mocks.rpc.mockResolvedValueOnce({ data: [{}], error: null });
    expect((await getTimekeepingSchedule("2026-09-21")).ok).toBe(false);
    mocks.client.mockRejectedValue(new Error("offline"));
    expect((await getTimekeepingSchedule("2026-09-21")).ok).toBe(false);
  });
});
