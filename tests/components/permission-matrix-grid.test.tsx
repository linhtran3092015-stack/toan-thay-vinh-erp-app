// Value: protects=the permission matrix (design 9b): a roles × permissions grid with the Owner column locked; toggling cells builds one draft across roles counted in the save bar with a per-role summary; "Lưu phân quyền" asks for a required reason, then calls the existing setRolePermissionsAction once per changed role, in order, with that role's full permission set; a role that fails keeps its draft and is named in a danger banner while saved roles clear; Hủy drops the draft and the reason typed for it; read-only viewers get disabled cells and no bar;
// fails_when=Owner cells become editable, a toggle is lost or double-counted, the save skips the reason, batches roles into one call, runs them out of order or sends only the delta, a failed role loses its draft, a saved role keeps its draft, Hủy keeps the typed reason for the next change, or viewers can edit;
// why_new=step 9 replaces the per-role editor with a multi-role grid and a batched, per-role save;
// seam=the settings actions module and next/navigation are mocked; the grid is the lg+ table (jsdom ignores the CSS that hides it below lg); no_claim=does not prove the RPC result (settings action tests) nor the sticky header/column visually (checked in /dev/settings)
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeaveGuardProvider } from "@/features/settings/components/leave-guard";
import { SettingsToc } from "@/features/settings/components/settings-toc";
import { PermissionMatrixPage } from "@/features/settings/permission-matrix-page";
import type { SettingsPermissionMatrix } from "@/features/settings/types";

const actions = vi.hoisted(() => ({ setRolePermissionsAction: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/features/settings/actions", () => actions);
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/permissions", useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const role = (id: string, code: string, name: string) => ({ code, description: null, id, isActive: true, isSystem: true, name });
const permission = (id: string, module: string, code: string, name: string) => ({ code, description: null, id, isActive: true, module, name });

const matrix: SettingsPermissionMatrix = {
  grants: [
    { permissionId: "p-attendance", roleId: "r-owner" },
    { permissionId: "p-lock", roleId: "r-owner" },
    { permissionId: "p-allocate", roleId: "r-owner" },
    { permissionId: "p-allocate", roleId: "r-accountant" },
    { permissionId: "p-attendance", roleId: "r-ta" },
  ],
  permissions: [
    permission("p-attendance", "attendance", "attendance.mark", "Điểm danh"),
    permission("p-lock", "sessions", "sessions.lock", "Khóa buổi học"),
    permission("p-allocate", "sepay", "sepay.allocate", "Phân bổ SePay thủ công"),
  ],
  // Data order is by name; the page puts Owner first.
  roles: [role("r-accountant", "accountant", "Kế toán"), role("r-owner", "owner", "Chủ trung tâm"), role("r-ta", "teaching_assistant", "Trợ giảng")],
};

function grid() {
  return screen.getByRole("table", { name: "Ma trận quyền theo vai trò" });
}

function cell(roleName: string, permissionName: string) {
  return within(grid()).getByRole("checkbox", { name: new RegExp(`^${roleName}: ${permissionName}`) });
}

function bar() {
  return screen.getByRole("region", { name: "Thanh lưu thay đổi" });
}

/** Fires a cancelable beforeunload; true when the page asked the browser to confirm leaving. */
function beforeUnloadIsPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

/** Clicks a link; true when the app held the click (leave dialog), false when the link was left to navigate. */
function clickIsHeld(link: HTMLElement): boolean {
  const seen = { held: false };
  // Runs after React's handlers (window is last in the bubble path); then stops jsdom's document navigation.
  const record = (event: MouseEvent) => {
    seen.held = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener("click", record);
  fireEvent.click(link);
  window.removeEventListener("click", record);
  return seen.held;
}

describe("PermissionMatrixPage grid", () => {
  it("shows roles as columns with Owner first and locked", () => {
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    expect(within(grid().querySelector("thead")!).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Quyền",
      "Chủ TTChủ trung tâm (khóa)",
      "Kế toánKế toán",
      "Trợ giảngTrợ giảng",
    ]);
    expect(cell("Chủ trung tâm", "Điểm danh")).toBeChecked();
    expect(cell("Chủ trung tâm", "Điểm danh")).toBeDisabled();
    // One group row per module (in data order; the loader sorts by module), then its permissions.
    expect(within(grid()).getAllByRole("rowheader").map((header) => header.textContent)).toEqual([
      "Điểm danh",
      "Điểm danhattendance.mark",
      "Buổi học",
      "Khóa buổi họcsessions.lock",
      "SePay",
      "Phân bổ SePay thủ côngsepay.allocate",
    ]);
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
  });

  it("builds one draft across roles with a per-role summary and Hủy drops it", () => {
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    fireEvent.click(cell("Kế toán", "Phân bổ SePay thủ công"));
    fireEvent.click(cell("Kế toán", "Khóa buổi học"));
    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));

    expect(bar()).toHaveTextContent("4 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Kế toán +2 −1, Trợ giảng +1");

    // Toggling back removes the change instead of counting it twice.
    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));
    expect(bar()).toHaveTextContent("3 thay đổi chưa lưu");

    // A reason typed and left in the closed dialog belongs to the draft Hủy drops.
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    fireEvent.change(within(screen.getByRole("dialog", { name: "Lưu phân quyền" })).getByLabelText("Lý do thay đổi"), { target: { value: "Nháp lý do" } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Lưu phân quyền" })).getByRole("button", { name: "Hủy" }));

    fireEvent.click(within(bar()).getByRole("button", { name: "Hủy" }));
    expect(cell("Kế toán", "Điểm danh")).not.toBeChecked();
    expect(cell("Kế toán", "Phân bổ SePay thủ công")).toBeChecked();
    expect(bar()).toHaveTextContent("Chưa có thay đổi");

    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    expect(within(screen.getByRole("dialog", { name: "Lưu phân quyền" })).getByLabelText("Lý do thay đổi")).toHaveValue("");
  });

  it("requires a reason, saves each changed role in order and keeps only the failed draft", async () => {
    let releaseFirst: (() => void) | undefined;
    actions.setRolePermissionsAction
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseFirst = () => resolve({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
      }))
      .mockResolvedValueOnce({ message: "Danh sách quyền có mục không hợp lệ hoặc đã ngừng hoạt động.", status: "error" });
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));

    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    const dialog = screen.getByRole("dialog", { name: "Lưu phân quyền" });
    expect(within(dialog).getByText("Kế toán")).toBeInTheDocument();
    expect(within(dialog).getByText("Trợ giảng")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Xác nhận lưu" })).toBeDisabled();
    expect(within(dialog).getByLabelText("Lý do thay đổi")).toHaveAttribute("maxLength", "2000");

    fireEvent.change(within(dialog).getByLabelText("Lý do thay đổi"), { target: { value: "  Phân công tháng 10.  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận lưu" }));

    // The grid is locked while saving and the second role waits for the first.
    await waitFor(() => expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(1));
    expect(cell("Kế toán", "Điểm danh")).toBeDisabled();
    expect(actions.setRolePermissionsAction).toHaveBeenNthCalledWith(1, {
      permissionIds: expect.arrayContaining(["p-allocate", "p-attendance"]),
      reason: "Phân công tháng 10.",
      roleId: "r-accountant",
    });
    expect(actions.setRolePermissionsAction.mock.calls[0][0].permissionIds).toHaveLength(2);
    releaseFirst?.();

    await waitFor(() => expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(2));
    expect(actions.setRolePermissionsAction).toHaveBeenNthCalledWith(2, {
      permissionIds: expect.arrayContaining(["p-attendance", "p-lock"]),
      reason: "Phân công tháng 10.",
      roleId: "r-ta",
    });

    const banner = await within(bar()).findByRole("alert");
    expect(banner).toHaveTextContent("Chưa lưu được quyền cho Trợ giảng.");
    expect(banner).toHaveTextContent("Danh sách quyền có mục không hợp lệ hoặc đã ngừng hoạt động.");
    expect(banner).toHaveTextContent("Đã lưu: Kế toán.");
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Trợ giảng +1");
    expect(cell("Kế toán", "Điểm danh")).toBeChecked();
    expect(cell("Trợ giảng", "Khóa buổi học")).toBeChecked();
    expect(cell("Trợ giảng", "Khóa buổi học")).toBeEnabled();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  // Value: protects=when the per-role action throws (network/server crash) the save ends: a connection banner names the role, the grid unlocks, the draft is kept for retry and nothing refreshes;
  // fails_when=the try/catch around setRolePermissionsAction is removed or isSaving is not reset, leaving the grid locked with no message, or the failed role's draft is dropped;
  // why_new=permission-matrix-grid covers resolved error results only, not a rejected call; seam=none; no_claim=the real RPC failure mode (mocked action; unit only)
  it("unlocks the grid and keeps the draft when the save call throws", async () => {
    actions.setRolePermissionsAction.mockRejectedValueOnce(new Error("fetch failed"));
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Kế toán", "Khóa buổi học"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    const dialog = screen.getByRole("dialog", { name: "Lưu phân quyền" });
    fireEvent.change(within(dialog).getByLabelText("Lý do thay đổi"), { target: { value: "Thử lại" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận lưu" }));

    const banner = await within(bar()).findByRole("alert");
    expect(banner).toHaveTextContent("Chưa lưu được quyền cho Kế toán.");
    expect(banner).toHaveTextContent("Không thể kết nối hệ thống phân quyền.");
    expect(cell("Kế toán", "Khóa buổi học")).toBeChecked();
    expect(cell("Kế toán", "Khóa buổi học")).toBeEnabled();
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(within(bar()).getByRole("button", { name: "Lưu phân quyền" })).toBeEnabled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  // Value: protects=the draft is stored as per-cell changes on top of the current saved grants: after a refresh brings new grants, untouched cells follow them, toggled cells stay changed, a change the new grants already contain disappears, and saving sends the new grants plus the changes;
  // fails_when=the draft goes back to whole-role snapshots (a refresh is overwritten by stale grants on save), a matched change keeps counting, or saving sends the old baseline;
  // why_new=red-team finding: a refresh while editing silently reverted grants made elsewhere; seam=rerender with a new matrix.grants array stands in for router.refresh; no_claim=the server's own conflict handling
  it("applies the draft on top of refreshed grants", async () => {
    actions.setRolePermissionsAction.mockResolvedValue({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
    const { rerender } = render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    expect(bar()).toHaveTextContent("Kế toán +1");

    // Elsewhere: Kế toán gained sessions.lock, Trợ giảng lost attendance.mark.
    const refreshed: SettingsPermissionMatrix = {
      ...matrix,
      grants: [
        ...matrix.grants.filter((grant) => !(grant.roleId === "r-ta" && grant.permissionId === "p-attendance")),
        { permissionId: "p-lock", roleId: "r-accountant" },
      ],
    };
    rerender(<PermissionMatrixPage canManage matrix={refreshed} />);
    expect(cell("Kế toán", "Khóa buổi học")).toBeChecked();
    expect(cell("Trợ giảng", "Điểm danh")).not.toBeChecked();
    expect(cell("Kế toán", "Điểm danh")).toBeChecked();
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Kế toán +1");

    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    const dialog = screen.getByRole("dialog", { name: "Lưu phân quyền" });
    fireEvent.change(within(dialog).getByLabelText("Lý do thay đổi"), { target: { value: "Bổ sung" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận lưu" }));
    await waitFor(() => expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(1));
    const sent = actions.setRolePermissionsAction.mock.calls[0][0];
    expect(sent.roleId).toBe("r-accountant");
    expect([...sent.permissionIds].sort()).toEqual(["p-allocate", "p-attendance", "p-lock"]);
  });

  it("drops a change once refreshed grants already contain it", () => {
    const { rerender } = render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    rerender(<PermissionMatrixPage canManage matrix={{ ...matrix, grants: [...matrix.grants, { permissionId: "p-attendance", roleId: "r-accountant" }] }} />);
    expect(cell("Kế toán", "Điểm danh")).toBeChecked();
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
  });

  // Value: protects=when a refresh empties the change list while the reason dialog is open, "Xác nhận lưu" is disabled with the reason "Không còn thay đổi để lưu" instead of silently doing nothing;
  // fails_when=the confirm stays enabled with an empty list (a click closes the dialog with no save and no message) or loses its text reason;
  // why_new=the confirm used to stay enabled and do nothing; seam=rerender with new grants; no_claim=none
  it("disables the confirm with a reason when no change is left", () => {
    const { rerender } = render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Lý do thay đổi"), { target: { value: "Bổ sung" } });
    rerender(<PermissionMatrixPage canManage matrix={{ ...matrix, grants: [...matrix.grants, { permissionId: "p-attendance", roleId: "r-accountant" }] }} />);

    const confirm = within(screen.getByRole("dialog", { name: "Lưu phân quyền" })).getByRole("button", { name: "Xác nhận lưu" });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription("Không còn thay đổi để lưu");
    expect(actions.setRolePermissionsAction).not.toHaveBeenCalled();
  });

  // Value: protects=changed cells carry a non-colour cue: a marker with "chưa lưu" text and " (thay đổi chưa lưu)" in the checkbox name; the legend says "Ô nền vàng = thay đổi chưa lưu";
  // fails_when=the only cue is the yellow fill again, the name suffix stays after toggling back, or the legend copy regresses;
  // why_new=accessibility finding (colour-only cue); seam=none; no_claim=the visual size of the marker
  it("marks changed cells without relying on colour", () => {
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    const changed = cell("Kế toán", "Điểm danh");
    expect(changed).toHaveAccessibleName("Kế toán: Điểm danh (thay đổi chưa lưu)");
    expect(changed.closest("td")).toHaveTextContent("chưa lưu");
    expect(cell("Trợ giảng", "Điểm danh")).toHaveAccessibleName("Trợ giảng: Điểm danh");
    expect(screen.getByText("Ô nền vàng = thay đổi chưa lưu")).toBeInTheDocument();

    fireEvent.click(changed);
    expect(cell("Kế toán", "Điểm danh")).toHaveAccessibleName("Kế toán: Điểm danh");
  });

  // Value: protects=below lg the per-role list edits only the selected role: "Chọn cả nhóm" grants the module to that role and "Bỏ chọn nhóm" revokes it, both counted in the same draft; Owner can be viewed but not edited (no group buttons, disabled checkboxes);
  // fails_when=a group action touches another role, the list edits Owner, or list edits bypass the shared draft;
  // why_new=the below-lg list had no test after the grid rewrite; seam=jsdom renders both layouts (CSS hides one), so the list is scoped by its role heading; no_claim=which layout shows at a given width
  it("edits only the selected role in the below-lg list, never Owner", () => {
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    const roleSelect = screen.getByLabelText("Vai trò cần cấu hình");
    expect(roleSelect).toHaveValue("r-accountant");
    const list = () => screen.getByRole("heading", { level: 3 }).closest("section")!;

    const group = (module: string) => within(within(list()).getByRole("heading", { level: 4, name: module }).closest("section")!);

    // Kế toán: the Điểm danh group is empty, the SePay group is full.
    fireEvent.click(group("Điểm danh").getByRole("button", { name: "Chọn cả nhóm" }));
    fireEvent.click(group("SePay").getByRole("button", { name: "Bỏ chọn nhóm" }));
    expect(group("Điểm danh").getByRole("button", { name: "Bỏ chọn nhóm" })).toBeInTheDocument();
    expect(cell("Kế toán", "Điểm danh")).toBeChecked();
    expect(cell("Kế toán", "Phân bổ SePay thủ công")).not.toBeChecked();
    expect(cell("Trợ giảng", "Khóa buổi học")).not.toBeChecked();
    expect(cell("Trợ giảng", "Điểm danh")).toBeChecked();
    expect(bar()).toHaveTextContent("2 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Kế toán +1 −1");

    fireEvent.change(roleSelect, { target: { value: "r-owner" } });
    expect(within(list()).getByRole("heading", { level: 3 })).toHaveTextContent("Chủ trung tâm");
    expect(within(list()).queryByRole("button", { name: /Chọn cả nhóm|Bỏ chọn nhóm/ })).not.toBeInTheDocument();
    for (const checkbox of within(list()).getAllByRole("checkbox")) expect(checkbox).toBeDisabled();
    expect(within(list()).getByText(/Owner luôn có toàn bộ quyền đang hoạt động/)).toBeInTheDocument();
  });

  // Value: protects=search ignores Vietnamese diacritics and combines with the module filter; no match shows "Không tìm thấy quyền" and "Xóa bộ lọc" restores every row;
  // fails_when=normalizeSearch stops stripping combining marks (the escaped range regressed to raw characters once), the filters stop combining, or the empty state/clear action disappears;
  // why_new=the diacritics regex once regressed to raw characters and the filters had no test; seam=none; no_claim=đ/Đ folding (NFD does not decompose đ; not implemented)
  it("searches without diacritics, filters by module and clears the filters", () => {
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    const rowNames = () => within(grid()).queryAllByRole("rowheader").map((header) => header.textContent);

    fireEvent.change(screen.getByLabelText("Tìm quyền"), { target: { value: "khoa buoi" } });
    expect(rowNames()).toEqual(["Buổi học", "Khóa buổi họcsessions.lock"]);
    fireEvent.change(screen.getByLabelText("Tìm quyền"), { target: { value: "PHAN BO" } });
    expect(rowNames()).toEqual(["SePay", "Phân bổ SePay thủ côngsepay.allocate"]);

    fireEvent.change(screen.getByLabelText("Nhóm chức năng"), { target: { value: "attendance" } });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Không tìm thấy quyền")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(screen.getByLabelText("Tìm quyền")).toHaveValue("");
    expect(screen.getByLabelText("Nhóm chức năng")).toHaveValue("");
    expect(rowNames()).toHaveLength(6);
  });

  // Value: protects=a whitespace-only reason keeps "Xác nhận lưu" disabled (the RPC needs a real reason), and Hủy closes the dialog without touching the draft;
  // fails_when=the reason check stops trimming, or Hủy drops the draft or saves;
  // why_new=the reason dialog's blank-reason and cancel paths had no test; seam=none; no_claim=the RPC's own reason validation
  it("keeps confirm disabled for a blank reason and keeps the draft on Hủy", () => {
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    const dialog = screen.getByRole("dialog", { name: "Lưu phân quyền" });
    fireEvent.change(within(dialog).getByLabelText("Lý do thay đổi"), { target: { value: "   \n  " } });
    const confirm = within(dialog).getByRole("button", { name: "Xác nhận lưu" });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription("Nhập lý do để lưu.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cell("Trợ giảng", "Khóa buổi học")).toBeChecked();
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(actions.setRolePermissionsAction).not.toHaveBeenCalled();
  });

  it("gives read-only viewers disabled cells and no save bar", () => {
    render(<PermissionMatrixPage canManage={false} matrix={matrix} />);
    expect(cell("Kế toán", "Phân bổ SePay thủ công")).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Thanh lưu thay đổi" })).not.toBeInTheDocument();
    expect(screen.getByText("Chỉ đọc")).toBeInTheDocument();
  });
  // Value: protects=an all-success save ends cleanly: the status line "Đã lưu quyền cho …" names every saved role, the bar is clean, the page refreshes exactly once, and the next reason dialog starts with an empty reason;
  // fails_when=success leaves cells counted as changed, refreshes per role or not at all, drops the status line, or the old reason is pre-filled for the next, unrelated change;
  // why_new=testing review: only partial-failure and thrown paths were covered; seam=settings actions and next/navigation mocked; no_claim=the audit entries written by the RPC
  it("ends an all-success save with a status line, a clean bar and an empty reason", async () => {
    actions.setRolePermissionsAction.mockResolvedValue({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
    render(<PermissionMatrixPage canManage matrix={matrix} />);
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Lý do thay đổi"), { target: { value: "Phân công mới" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận lưu" }));

    expect(await within(bar()).findByRole("status")).toHaveTextContent("Đã lưu quyền cho Kế toán, Trợ giảng.");
    expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(2);
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(router.refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(cell("Kế toán", "Khóa buổi học"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Lý do thay đổi")).toHaveValue("");
  });

  // Value: protects=each role's permission set is built right before its own call from the latest saved grants: a refresh that lands while an earlier role is saving is respected by the later role (its untouched cells follow the refresh), and a role whose change the refresh already contains is skipped;
  // fails_when=saveAll captures every role's set up front (a later role overwrites the refreshed grants with stale ones) or still calls the RPC for a role with no change left;
  // why_new=api-contract review: the batched save used the baseline from when the dialog was confirmed; seam=the first call is a deferred promise; rerender with new grants stands in for router.refresh; no_claim=the server's own ordering
  it("builds later roles from grants refreshed during the save", async () => {
    let releaseFirst: (() => void) | undefined;
    actions.setRolePermissionsAction
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseFirst = () => resolve({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
      }))
      .mockResolvedValue({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
    const withOps = { ...matrix, roles: [...matrix.roles, role("r-ops", "operations_manager", "Quản lý vận hành")] };
    const { rerender } = render(<PermissionMatrixPage canManage matrix={withOps} />);
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));
    fireEvent.click(cell("Quản lý vận hành", "Điểm danh"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Lý do thay đổi"), { target: { value: "Đợt 2" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận lưu" }));
    await waitFor(() => expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(1));

    // Elsewhere, meanwhile: Trợ giảng gained sepay.allocate; Quản lý vận hành already got attendance.mark.
    rerender(
      <PermissionMatrixPage
        canManage
        matrix={{
          ...withOps,
          grants: [...withOps.grants, { permissionId: "p-allocate", roleId: "r-ta" }, { permissionId: "p-attendance", roleId: "r-ops" }],
        }}
      />,
    );
    await act(async () => releaseFirst?.());

    await waitFor(() => expect(within(bar()).getByRole("status")).toHaveTextContent("Đã lưu quyền cho Kế toán, Trợ giảng."));
    expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(2);
    const second = actions.setRolePermissionsAction.mock.calls[1][0];
    expect(second.roleId).toBe("r-ta");
    expect([...second.permissionIds].sort()).toEqual(["p-allocate", "p-attendance", "p-lock"]);
  });

  // Value: protects="Rời trang" in the hub's leave dialog drops the permission draft and the typed reason before navigating, so a hidden copy of the route cannot bring them back;
  // fails_when=the page stops passing a discard to useLeaveGuard or the provider navigates without calling it;
  // why_new=red-team review: leaving kept the draft alive in Next's hidden route copy; seam=next/navigation mocked (router.push observable); the real SettingsToc provides the link; no_claim=Next's route cache itself
  it("discards the draft and the reason on Rời trang", () => {
    render(
      <LeaveGuardProvider>
        <SettingsToc canViewAudit canViewUsers />
        <PermissionMatrixPage canManage matrix={matrix} />
      </LeaveGuardProvider>,
    );
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    fireEvent.change(within(screen.getByRole("dialog", { name: "Lưu phân quyền" })).getByLabelText("Lý do thay đổi"), { target: { value: "Nháp" } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Lưu phân quyền" })).getByRole("button", { name: "Hủy" }));

    fireEvent.click(screen.getByRole("link", { name: "Chung" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" })).getByRole("button", { name: "Rời trang" }));

    expect(router.push).toHaveBeenCalledWith("/settings/general");
    expect(cell("Kế toán", "Điểm danh")).not.toBeChecked();
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    fireEvent.click(cell("Kế toán", "Khóa buổi học"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    expect(within(screen.getByRole("dialog", { name: "Lưu phân quyền" })).getByLabelText("Lý do thay đổi")).toHaveValue("");
  });

  // Value: protects=leaving during an in-flight multi-role save never truncates it, and the person is told first: with two roles confirmed and the first call still pending, a TOC link opens "Đang lưu phân quyền" (not the discard dialog); "Ở lại" keeps the page; "Vẫn rời trang" navigates without dropping the draft, and the second role's setRolePermissionsAction is still called once the first resolves; the save ends clean with its status line;
  // fails_when=the page stops registering the "saving" guard (the link leaves silently), the saving dialog runs the discard (the loop skips the second role or the cells clear), "Ở lại" navigates, or the loop reads the live draft instead of what was confirmed;
  // why_new=four reviewers found that leaving during a save skipped the roles not yet sent; adversarial review then found the silent leave hid any later role failure; seam=the first call is a deferred promise; next/navigation mocked (router.push observable); no_claim=Next's real navigation or route cache
  it("still saves every confirmed role when a hub link is followed during the save", async () => {
    let releaseFirst: (() => void) | undefined;
    actions.setRolePermissionsAction
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseFirst = () => resolve({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
      }))
      .mockResolvedValue({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
    render(
      <LeaveGuardProvider>
        <SettingsToc canViewAudit canViewUsers />
        <PermissionMatrixPage canManage matrix={matrix} />
      </LeaveGuardProvider>,
    );
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Lý do thay đổi"), { target: { value: "Phân công tháng 11" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận lưu" }));
    await waitFor(() => expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(1));

    expect(clickIsHeld(screen.getByRole("link", { name: "Chung" }))).toBe(true);
    const saving = screen.getByRole("dialog", { name: "Đang lưu phân quyền" });
    expect(saving).toHaveAccessibleDescription(
      "Phân quyền đang được lưu lần lượt cho từng vai trò. Rời trang lúc này thì nếu một vai trò lưu lỗi, trang sẽ không báo được. Nên đợi lưu xong.",
    );
    expect(within(saving).queryByRole("button", { name: "Rời trang" })).not.toBeInTheDocument();
    fireEvent.click(within(saving).getByRole("button", { name: "Ở lại" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    expect(clickIsHeld(screen.getByRole("link", { name: "Chung" }))).toBe(true);
    fireEvent.click(within(screen.getByRole("dialog", { name: "Đang lưu phân quyền" })).getByRole("button", { name: "Vẫn rời trang" }));
    expect(router.push).toHaveBeenCalledWith("/settings/general");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cell("Trợ giảng", "Khóa buổi học")).toBeChecked();

    await act(async () => releaseFirst?.());
    await waitFor(() => expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(2));
    const second = actions.setRolePermissionsAction.mock.calls[1][0];
    expect(second.roleId).toBe("r-ta");
    expect([...second.permissionIds].sort()).toEqual(["p-attendance", "p-lock"]);
    expect(second.reason).toBe("Phân công tháng 11");
    await waitFor(() => expect(within(bar()).getByRole("status")).toHaveTextContent("Đã lưu quyền cho Kế toán, Trợ giảng."));
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
  });

  // Value: protects=a reload or tab close during the multi-role save asks first (beforeunload is prevented while the roles are being saved one by one) and stops asking once the save settles; asking never drops the draft, so the second role is still saved;
  // fails_when=the page stops guarding beforeunload while saving (a reload silently cuts the loop after the first role), the guard runs the discard, or the listener stays after the save so every later reload prompts;
  // why_new=adversarial review: the leave guard is off while saving, which also removed the reload/close prompt exactly when a reload would truncate the save; seam=the first call is a deferred promise; a synthetic cancelable beforeunload event stands in for the browser; no_claim=the browser's native prompt itself
  it("asks before a reload or close while the roles are being saved", async () => {
    let releaseFirst: (() => void) | undefined;
    actions.setRolePermissionsAction
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseFirst = () => resolve({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
      }))
      .mockResolvedValue({ message: "Đã cập nhật quyền của vai trò.", status: "success" });
    render(
      <LeaveGuardProvider>
        <PermissionMatrixPage canManage matrix={matrix} />
      </LeaveGuardProvider>,
    );
    fireEvent.click(cell("Kế toán", "Điểm danh"));
    fireEvent.click(cell("Trợ giảng", "Khóa buổi học"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Lý do thay đổi"), { target: { value: "Phân công tháng 11" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận lưu" }));
    await waitFor(() => expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(1));

    expect(beforeUnloadIsPrevented()).toBe(true);
    expect(cell("Trợ giảng", "Khóa buổi học")).toBeChecked();

    await act(async () => releaseFirst?.());
    await waitFor(() => expect(within(bar()).getByRole("status")).toHaveTextContent("Đã lưu quyền cho Kế toán, Trợ giảng."));
    expect(actions.setRolePermissionsAction).toHaveBeenCalledTimes(2);
    expect(beforeUnloadIsPrevented()).toBe(false);
  });
});
