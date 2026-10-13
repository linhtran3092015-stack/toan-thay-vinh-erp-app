// Value: protects=the database's composite-parent rejections (a class linked as "lớp ghép", future links included) reach the user as Vietnamese explanations from the schedule and single-session create actions;
// fails_when=COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE or COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION falls through to the generic "Dữ liệu chưa được thay đổi" message, or a rejected create revalidates routes;
// why_new=componentClasses now includes links that start later, and a link created after the page loaded still makes the triggers raise these codes;
// seam=none; no_claim=does not prove the triggers in 20260817090000_class_component_roster_foundation.sql raise for every overlapping date range
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

import { createClassScheduleAction } from "@/features/classes/actions/class-schedule-actions";
import { createSessionAction } from "@/features/sessions/actions/session-lifecycle-actions";

const classId = "4f8219f4-2f39-4833-b596-ad5137ed27a3";
const templateId = "11111111-1111-4111-8111-111111111111";

const scheduleTemplateMessage = "Lớp ghép không có lịch cố định riêng; lịch học nằm ở các lớp thành phần.";

function rejectRpcWith(message: string) {
  const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0001", message } }) };
  mocks.server.mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["classes.manage_schedule", "sessions.manage"] });
});

describe("composite parent rejections", () => {
  it.each([
    ["COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE", scheduleTemplateMessage],
    ["COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION", "Lớp ghép không có buổi học riêng. Hãy tạo buổi trên lớp thành phần."],
  ])("createClassScheduleAction explains %s", async (databaseMessage, userMessage) => {
    const client = rejectRpcWith(databaseMessage);

    const result = await createClassScheduleAction({
      classId,
      componentCode: "",
      effectiveFrom: "2026-10-13",
      endTime: "21:30",
      learningMode: "offline",
      meetingUrl: "",
      roomName: "P.101",
      startTime: "19:30",
      weekday: 2,
    });

    expect(client.rpc).toHaveBeenCalledWith("create_class_schedule_template", expect.objectContaining({ p_class_id: classId }));
    expect(result).toEqual({ fieldErrors: undefined, message: userMessage, status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    // One wording on every screen (compositeParentRpcMessages).
    ["COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION", "Lớp ghép không có buổi học riêng. Hãy tạo buổi trên lớp thành phần."],
    ["COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE", scheduleTemplateMessage],
  ])("createSessionAction explains %s", async (databaseMessage, userMessage) => {
    const client = rejectRpcWith(databaseMessage);

    const result = await createSessionAction({
      classId,
      scheduleTemplateId: templateId,
      sessionDate: "2026-10-20",
      sessionKind: "regular",
    });

    expect(client.rpc).toHaveBeenCalledWith("create_class_session", expect.objectContaining({ p_class_id: classId }));
    expect(result).toEqual({ fieldErrors: undefined, message: userMessage, status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
