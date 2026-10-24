// Value: protects=bulk Zalo link and group check actions refuse callers without students.update, and bulk link refuses malformed or duplicate batches before any RPC;
// fails_when=a permission gate is dropped (check reads ZaloCRM with the server key, no DB gate), or duplicates are checked on untrimmed input or not at all;
// why_new=no test exercised parent-messages server actions, and the DB link check is select-then-update so two parallel RPCs on one thread can both pass;
// seam=none; no_claim=does not prove the DB RPC itself, the ZaloCRM client, or the client-side duplicate warning
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getZaloGroupByThread: vi.fn(),
  permissions: vi.fn(),
  revalidate: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({ getDatabasePermissions: mocks.permissions }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/zalo-crm", () => ({
  getZaloGroupByThread: mocks.getZaloGroupByThread,
  getZaloGroupMembers: vi.fn(),
  listZaloAccounts: vi.fn(),
  searchZaloGroups: vi.fn(),
  sendZaloMessage: vi.fn(),
}));

import { checkStudentZaloGroupAction, linkStudentZaloGroupsAction } from "@/features/parent-messages/actions";

function studentId(index: number): string {
  return `90000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

type LinkInput = Parameters<typeof linkStudentZaloGroupsAction>[0]["links"][number];

function link(index: number, threadId = `thread-${index}`): LinkInput {
  return { groupName: `SLL Hoc Sinh Mau ${index}`, studentId: studentId(index), threadId, zaloAccountId: "acc-test" };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.update"] });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.getZaloGroupByThread.mockResolvedValue({
    data: { groupMembersCount: 3, groupName: "SLL Hoc Sinh Mau", zaloAccount: { status: "connected" } },
    ok: true,
  });
});

describe("Zalo group link actions", () => {
  it("requires students.update before reading a group from ZaloCRM or linking", async () => {
    const check = { threadId: "thread-1", zaloAccountId: "acc-test" };

    mocks.permissions.mockResolvedValue({ ok: true, permissions: ["students.view", "attendance.mark"] });
    const deniedCheck = await checkStudentZaloGroupAction(check);
    const deniedLink = await linkStudentZaloGroupsAction({ links: [link(1)] });
    expect(deniedCheck).toEqual({ message: "Tài khoản hiện tại không có quyền cập nhật hồ sơ học sinh.", ok: false });
    expect(deniedLink).toEqual({ message: "Tài khoản hiện tại không có quyền cập nhật hồ sơ học sinh.", ok: false });

    mocks.permissions.mockResolvedValue({ ok: false });
    expect((await checkStudentZaloGroupAction(check)).ok).toBe(false);
    expect((await linkStudentZaloGroupsAction({ links: [link(1)] })).ok).toBe(false);

    expect(mocks.getZaloGroupByThread).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.permissions.mockResolvedValue({ ok: true, permissions: ["students.update"] });
    expect(await checkStudentZaloGroupAction(check)).toEqual({
      accountStatus: "connected",
      groupName: "SLL Hoc Sinh Mau",
      membersCount: 3,
      ok: true,
      present: true,
    });
    expect(mocks.getZaloGroupByThread).toHaveBeenCalledWith("thread-1", "acc-test");
  });

  it("rejects malformed and duplicate batches before any RPC", async () => {
    const duplicateThread = "Một nhóm Zalo chỉ liên kết được với một học sinh. Bỏ chọn nhóm bị trùng rồi thử lại.";
    // The RPC trims the thread id, so " thread-1 " and "thread-1" are the same group.
    expect(await linkStudentZaloGroupsAction({ links: [link(1, "thread-1"), link(2, " thread-1 ")] })).toEqual({
      message: duplicateThread,
      ok: false,
    });
    expect(await linkStudentZaloGroupsAction({ links: [link(1, "thread-1"), { ...link(2), studentId: studentId(1) }] })).toEqual({
      message: "Mỗi học sinh chỉ chọn một nhóm.",
      ok: false,
    });

    const malformed = [
      [],
      Array.from({ length: 26 }, (_, index) => link(index + 1)),
      [{ ...link(1), studentId: "not-a-uuid" }],
      [{ ...link(1), threadId: "   " }],
      [{ ...link(1), zaloAccountId: "" }],
    ];
    for (const links of malformed) {
      expect(await linkStudentZaloGroupsAction({ links })).toEqual({ message: "Danh sách liên kết không hợp lệ.", ok: false });
    }

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("links every row, mapping each RPC error to its own student while the rest still link", async () => {
    mocks.rpc.mockImplementation(async (_name: string, args: { p_student_id: string }) => {
      if (args.p_student_id === studentId(3)) {
        return { data: null, error: { message: "ZALO_GROUP_ALREADY_LINKED_TO_ANOTHER_STUDENT" } };
      }
      if (args.p_student_id === studentId(7)) return { data: null, error: { message: "connection reset" } };
      return { data: null, error: null };
    });
    // Seven rows span two batches of parallel RPCs.
    const links = Array.from({ length: 7 }, (_, index) => link(index + 1));
    links[0] = { ...links[0], groupName: null, threadId: "  thread-1  " };

    const result = await linkStudentZaloGroupsAction({ links });

    expect(result).toEqual({
      ok: true,
      results: [
        { message: "Đã liên kết.", ok: true, studentId: studentId(1) },
        { message: "Đã liên kết.", ok: true, studentId: studentId(2) },
        { message: "Nhóm Zalo này đã được liên kết với một học sinh khác.", ok: false, studentId: studentId(3) },
        { message: "Đã liên kết.", ok: true, studentId: studentId(4) },
        { message: "Đã liên kết.", ok: true, studentId: studentId(5) },
        { message: "Đã liên kết.", ok: true, studentId: studentId(6) },
        { message: "Không thể thực hiện thao tác. Vui lòng thử lại.", ok: false, studentId: studentId(7) },
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(7);
    expect(mocks.rpc).toHaveBeenCalledWith("link_student_zalo_group", {
      p_group_name: "",
      p_student_id: studentId(1),
      p_thread_id: "thread-1",
      p_zalo_account_id: "acc-test",
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/parent-messages/groups");
  });
});
