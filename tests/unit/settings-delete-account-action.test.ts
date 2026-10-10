import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccountAction } from "@/features/settings/actions";

const mocks = vi.hoisted(() => ({
  ownerStatus: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/settings/data", () => ({
  getCurrentOwnerStatus: mocks.ownerStatus,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({ rpc: mocks.rpc }),
}));

const userId = "d1000000-0000-4000-8000-000000000003";

describe("deleteAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ownerStatus.mockResolvedValue({ isOwner: true, ok: true });
  });

  it("requires a reason before touching the database", async () => {
    const result = await deleteAccountAction({ reason: "   ", userId });

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.reason?.[0]).toBe("Bắt buộc nhập lý do thay đổi.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses non-owners", async () => {
    mocks.ownerStatus.mockResolvedValue({ isOwner: false, ok: true });

    const result = await deleteAccountAction({ reason: "Nghỉ việc", userId });

    expect(result.status).toBe("error");
    expect(result.message).toBe("Chỉ Owner đang hoạt động được thực hiện thao tác này.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports a soft delete and refreshes the affected pages", async () => {
    mocks.rpc.mockResolvedValue({
      data: { hardDeleted: false, revokedInvitationCount: 0, revokedRoleCount: 1 },
      error: null,
    });

    const result = await deleteAccountAction({ reason: "Nghỉ việc", userId });

    expect(mocks.rpc).toHaveBeenCalledWith("delete_staff_account", {
      deletion_reason: "Nghỉ việc",
      target_user_id: userId,
    });
    expect(result.status).toBe("success");
    expect(result.message).toContain("Đã vô hiệu hóa");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/users");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/staff");
  });

  it("reports a hard delete for accounts without history", async () => {
    mocks.rpc.mockResolvedValue({
      data: { hardDeleted: true, revokedInvitationCount: 0, revokedRoleCount: 0 },
      error: null,
    });

    const result = await deleteAccountAction({ reason: "Đăng nhập nhầm", userId });

    expect(result.status).toBe("success");
    expect(result.message).toContain("Đã xóa hẳn");
  });

  it("maps database rejections to Vietnamese messages", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "CANNOT_DELETE_OWNER_ACCOUNT" },
    });

    const result = await deleteAccountAction({ reason: "Thử xóa owner", userId });

    expect(result.status).toBe("error");
    expect(result.message).toContain("vai trò Owner");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
