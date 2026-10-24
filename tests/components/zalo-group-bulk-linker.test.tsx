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

function matchesFor(list: ZaloLinkStudent[], groupList: MatchGroup[] = groups) {
  const guardians = [{ fullName: "Trần Thị Hoa", phones: ["0912345678"] }];
  return matchStudentsToGroups(
    list.map((student) => ({
      fullName: student.fullName,
      guardians: student.id === ids.bao || student.id === ids.han ? guardians : [],
      id: student.id,
      publicCode: student.publicCode,
    })),
    groupList,
  );
}

function renderLinker({ showGuardians = true }: { showGuardians?: boolean } = {}) {
  return render(<ZaloGroupBulkLinker centerAccountId="acc-1" matches={matchesFor(students)} showGuardians={showGuardians} students={students} />);
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
        { groupName: "SLL Nguyễn Văn An", studentId: ids.an, threadId: "g-an" },
        { groupName: "PH Hoa 0912345678", studentId: ids.bao, threadId: "g-sib" },
      ],
    });
    expect(screen.getByText(/Đã liên kết 1 học sinh; 1 học sinh chưa liên kết được/)).toBeInTheDocument();
    expect(screen.getByText("Nhóm Zalo này đã được liên kết với một học sinh khác.")).toBeInTheDocument();
  });

  // Value: protects=a chunk the server never saved (network drop, refused action) marks each of its rows failed with the reason and keeps them ticked to retry;
  // fails_when=the .catch around the action is removed (rejection escapes the transition), ok:false is treated as success, or failed rows get unticked;
  // why_new=the existing save test only covers ok:true with per-row results, never a whole-chunk failure;
  // seam=none; no_claim=does not prove the server action or that the retry then succeeds
  it("keeps every row of a chunk the server did not save ticked, with the reason, for a retry", async () => {
    actions.linkStudentZaloGroupsAction.mockRejectedValueOnce(new Error("fetch failed")).mockResolvedValueOnce({
      message: "Tài khoản hiện tại không có quyền cập nhật hồ sơ học sinh.",
      ok: false,
    });
    renderLinker();

    fireEvent.click(screen.getByRole("button", { name: "Liên kết 1 học sinh" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Đã liên kết 0 học sinh; 1 học sinh chưa liên kết được (xem lý do ở từng dòng).")).toBeInTheDocument();
    expect(screen.getByText("Mất kết nối tới máy chủ. Kiểm tra mạng rồi bấm Liên kết lại.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Chọn Nguyễn Văn An" })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Liên kết 1 học sinh" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Tài khoản hiện tại không có quyền cập nhật hồ sơ học sinh.")).toBeInTheDocument();
    expect(screen.queryByText("Mất kết nối tới máy chủ. Kiểm tra mạng rồi bấm Liên kết lại.")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Chọn Nguyễn Văn An" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Liên kết 1 học sinh" })).toBeEnabled();
    expect(actions.linkStudentZaloGroupsAction).toHaveBeenCalledTimes(2);
  });

  it("offers the search dialog for students without a matching group", () => {
    renderLinker();
    fireEvent.click(screen.getByRole("button", { name: /Không tìm thấy/ }));
    expect(screen.getByText("Không có nhóm nào khớp tên.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tìm nhóm cho Lê Minh" })).toBeEnabled();
  });

  // Value: protects=more than 25 ticked rows go to the server in chunks of 25 and the totals add up across chunks;
  // fails_when=the client sends one oversized call (the server refuses 26+ rows) or loses a chunk's results; why_new=every save test used 1-2 rows;
  // seam=none; no_claim=server-side chunk handling (actions test)
  it("saves more than 25 ticked rows in chunks of 25", async () => {
    const many = Array.from({ length: 26 }, (_, index) =>
      linkStudent(`50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, `Học Sinh Mẫu Số ${index + 1}`),
    );
    const manyGroups = many.map((student, index) => ({ externalThreadId: `g-${index + 1}`, groupMembersCount: 3, groupName: `SLL ${student.fullName}`, zaloAccountId: "acc-1" }));
    actions.linkStudentZaloGroupsAction.mockImplementation(async ({ links }: { links: { studentId: string }[] }) => ({
      ok: true,
      results: links.map((link) => ({ message: "Đã liên kết.", ok: true, studentId: link.studentId })),
    }));
    render(<ZaloGroupBulkLinker centerAccountId="acc-1" matches={matchesFor(many, manyGroups)} showGuardians students={many} />);

    fireEvent.click(screen.getByRole("button", { name: "Liên kết 26 học sinh" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(actions.linkStudentZaloGroupsAction.mock.calls.map(([input]) => input.links.length)).toEqual([25, 1]);
    expect(screen.getByText("Đã liên kết 26 học sinh với nhóm sổ liên lạc.")).toBeInTheDocument();
  });

  it("selects only visible rows, keeps hidden ticks counted, and drops a row whose group is cleared", () => {
    renderLinker();
    fireEvent.click(screen.getByRole("button", { name: /Cần chọn/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nhóm Zalo cho Phạm Gia Bảo" }), { target: { value: "g-sib" } });
    // An (sure, ticked) is hidden by the filter but still counted, and the bar says so.
    expect(screen.getByText(/Đã chọn/)).toHaveTextContent("Đã chọn 2 học sinh có nhóm (1 đang hiển thị, 1 bị ẩn bởi bộ lọc)");
    const selectAll = screen.getByRole("checkbox", { name: "Chọn tất cả học sinh đang hiển thị có nhóm" });
    expect((selectAll as HTMLInputElement).indeterminate).toBe(false);
    expect(selectAll).toBeChecked();

    fireEvent.click(selectAll);
    expect(screen.getByRole("checkbox", { name: "Chọn Phạm Gia Bảo" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Liên kết 1 học sinh" })).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Phạm Gia Bảo" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nhóm Zalo cho Phạm Gia Hân" }), { target: { value: "g-sib" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Nhóm Zalo cho Phạm Gia Hân" }), { target: { value: "" } });
    expect(screen.getByRole("checkbox", { name: "Chọn Phạm Gia Hân" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Liên kết 2 học sinh" })).toBeEnabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Tìm học sinh" }), { target: { value: "han" } });
    expect(screen.queryByText("Phạm Gia Bảo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liên kết 2 học sinh" })).toBeEnabled();
  });

  // Value: protects=a pick whose student left the page (linked from the dialog or another tab) or whose group is no longer a candidate is never sent;
  // fails_when=ready is built from client state alone again; why_new=red-team: a stale pick could replace a group just linked from the dialog;
  // seam=none; no_claim=server-side already-linked check (actions test)
  it("never sends a pick for a student who left the page or a group no longer offered", async () => {
    actions.linkStudentZaloGroupsAction.mockResolvedValue({ ok: true, results: [] });
    const view = renderLinker();
    fireEvent.click(screen.getByRole("button", { name: /Cần chọn/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nhóm Zalo cho Phạm Gia Bảo" }), { target: { value: "g-sib" } });
    expect(screen.getByRole("button", { name: "Liên kết 2 học sinh" })).toBeEnabled();

    // After a refresh: Bảo was linked from the dialog, and An's group was taken elsewhere.
    const remaining = students.filter((student) => student.id !== ids.bao);
    view.rerender(
      <ZaloGroupBulkLinker centerAccountId="acc-1" matches={matchesFor(remaining, groups.filter((group) => group.externalThreadId !== "g-an"))} showGuardians students={remaining} />,
    );
    expect(screen.getByRole("button", { name: "Liên kết 0 học sinh" })).toBeDisabled();
  });

  it("opens on the first non-empty chip and leaves guardians out without guardians.view", () => {
    const noSure = [linkStudent(ids.minh, "Lê Minh")];
    render(<ZaloGroupBulkLinker centerAccountId="acc-1" matches={matchesFor(noSure)} showGuardians={false} students={noSure} />);
    expect(screen.getByRole("button", { name: /Không tìm thấy/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Lê Minh")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Phụ huynh" })).not.toBeInTheDocument();
    expect(screen.queryByText("Trần Thị Hoa · 0912345678")).not.toBeInTheDocument();
  });
});
