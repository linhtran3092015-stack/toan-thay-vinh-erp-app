import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZaloGroupBulkLinker } from "@/features/parent-messages/components/zalo-group-bulk-linker";
import type { ZaloLinkStudent } from "@/features/parent-messages/zalo-group-link-data";
import { matchStudentsToGroups, type MatchGroup } from "@/features/parent-messages/zalo-group-matching";

const actions = vi.hoisted(() => ({
  checkStudentZaloGroupAction: vi.fn(),
  linkStudentZaloGroupAction: vi.fn(),
  linkStudentZaloGroupsAction: vi.fn(),
  searchZaloGroupsAction: vi.fn(),
  unlinkStudentZaloGroupAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/parent-messages/actions", () => actions);

const ids = {
  an: "11111111-1111-4111-8111-111111111111",
  bao: "22222222-2222-4222-8222-222222222222",
  han: "33333333-3333-4333-8333-333333333333",
  minh: "44444444-4444-4444-8444-444444444444",
};

function linkStudent(id: string, fullName: string): ZaloLinkStudent {
  return { birthYear: 2015, classCodes: ["L5A"], fullName, guardianSummary: "Trần Thị Hoa · 0912345678", id, publicCode: `TV-${fullName.length}` };
}

const students = [
  linkStudent(ids.an, "Nguyễn Văn An"),
  linkStudent(ids.bao, "Phạm Gia Bảo"),
  linkStudent(ids.han, "Phạm Gia Hân"),
  linkStudent(ids.minh, "Lê Minh"),
];

const groups: MatchGroup[] = [
  { externalThreadId: "g-an", groupMembersCount: 4, groupName: "SLL Nguyễn Văn An", zaloAccountId: "acc-1" },
  { externalThreadId: "g-sib", groupMembersCount: 3, groupName: "PH Hoa 0912345678", zaloAccountId: "acc-1" },
];

function renderLinker() {
  const guardians = [{ fullName: "Trần Thị Hoa", phones: ["0912345678"] }];
  const matches = matchStudentsToGroups(
    students.map((student) => ({
      fullName: student.fullName,
      guardians: student.id === ids.bao || student.id === ids.han ? guardians : [],
      id: student.id,
      publicCode: student.publicCode,
    })),
    groups,
  );
  return render(<ZaloGroupBulkLinker centerAccountId="acc-1" matches={matches} students={students} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ZaloGroupBulkLinker", () => {
  it("shows sure matches first, ticked, with the reason", () => {
    renderLinker();
    expect(screen.getByRole("button", { name: /Chắc chắn/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Chọn Nguyễn Văn An" })).toBeChecked();
    expect(screen.getByText("Trùng tên học sinh")).toBeInTheDocument();
    expect(screen.queryByText("Phạm Gia Bảo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liên kết 1 học sinh" })).toBeEnabled();
  });

  it("blocks saving while one group is picked for two students", () => {
    renderLinker();
    fireEvent.click(screen.getByRole("button", { name: /Cần chọn/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nhóm Zalo cho Phạm Gia Bảo" }), { target: { value: "g-sib" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Nhóm Zalo cho Phạm Gia Hân" }), { target: { value: "g-sib" } });
    expect(screen.getAllByText("Nhóm này đang được chọn cho học sinh khác.")).toHaveLength(2);
    expect(screen.getByText(/1 nhóm đang được chọn cho nhiều học sinh/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liên kết 3 học sinh" })).toBeDisabled();
  });

  it("saves the ticked rows and reports rows that failed", async () => {
    actions.linkStudentZaloGroupsAction.mockResolvedValue({
      ok: true,
      results: [
        { message: "Đã liên kết.", ok: true, studentId: ids.an },
        { message: "Nhóm Zalo này đã được liên kết với một học sinh khác.", ok: false, studentId: ids.bao },
      ],
    });
    renderLinker();
    fireEvent.click(screen.getByRole("button", { name: /Cần chọn/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nhóm Zalo cho Phạm Gia Bảo" }), { target: { value: "g-sib" } });
    fireEvent.click(screen.getByRole("button", { name: "Liên kết 2 học sinh" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(actions.linkStudentZaloGroupsAction).toHaveBeenCalledWith({
      links: [
        { groupName: "SLL Nguyễn Văn An", studentId: ids.an, threadId: "g-an", zaloAccountId: "acc-1" },
        { groupName: "PH Hoa 0912345678", studentId: ids.bao, threadId: "g-sib", zaloAccountId: "acc-1" },
      ],
    });
    expect(screen.getByText(/Đã liên kết 1 học sinh; 1 học sinh chưa liên kết được/)).toBeInTheDocument();
    expect(screen.getByText("Nhóm Zalo này đã được liên kết với một học sinh khác.")).toBeInTheDocument();
  });

  it("offers the search dialog for students without a matching group", () => {
    renderLinker();
    fireEvent.click(screen.getByRole("button", { name: /Không tìm thấy/ }));
    expect(screen.getByText("Không có nhóm nào khớp tên.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tìm nhóm cho Lê Minh" })).toBeEnabled();
  });
});
