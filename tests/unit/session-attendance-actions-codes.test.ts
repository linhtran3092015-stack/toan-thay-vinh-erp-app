import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
const permissionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/permissions/database-permissions", () => ({
  getDatabasePermissions: permissionsMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { markSessionAttendanceAction } from "@/features/sessions/actions/session-attendance-actions";

// Value: protects=the error codes the bulk "Có mặt cho tất cả" loop branches on (session-wide stop vs per-student failure);
// fails_when=the action drops `code` for a known RPC error or a missing attendance.mark, or invents one for an unknown error;
// seam=supabase client and permission lookup are mocked; no_claim=does not prove the database raises these messages
describe("markSessionAttendanceAction error codes", () => {
  const payload = {
    actualLearningMode: "offline" as const,
    attendanceStatus: "present" as const,
    classSessionId: "fa70d806-18e0-4b04-af6e-b045156a13fa",
    notes: null,
    studentId: "0b3c1a52-7d4e-4f1a-9a3b-2c5d6e7f8a90",
  };

  beforeEach(() => {
    rpcMock.mockReset();
    permissionsMock.mockReset();
    permissionsMock.mockResolvedValue({ ok: true, permissions: ["attendance.mark"] });
  });

  it("returns CLASS_SESSION_IS_LOCKED when the RPC error message contains it", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "P0001: CLASS_SESSION_IS_LOCKED" },
    });

    const result = await markSessionAttendanceAction(payload);

    expect(result.status).toBe("error");
    expect(result).toMatchObject({
      code: "CLASS_SESSION_IS_LOCKED",
      message: "Buổi học đã khóa nên không thể thay đổi điểm danh.",
    });
  });

  it("returns ATTENDANCE_MARK_PERMISSION_DENIED without calling the RPC when attendance.mark is missing", async () => {
    permissionsMock.mockResolvedValueOnce({ ok: true, permissions: ["sessions.view"] });

    const result = await markSessionAttendanceAction(payload);

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ code: "ATTENDANCE_MARK_PERMISSION_DENIED" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns no code for an unknown RPC error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "XX000: SOMETHING_UNEXPECTED" },
    });

    const result = await markSessionAttendanceAction(payload);

    expect(result.status).toBe("error");
    expect(result).not.toHaveProperty("code");
    expect(result.message).toBe("Không thể cập nhật điểm danh. Dữ liệu chưa được thay đổi.");
  });
});
