import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffProfileEditDialog } from "@/features/staff/components/staff-profile-edit-dialog";
import { StaffDetailPage } from "@/features/staff/staff-detail-page";
import { StaffDirectoryPage } from "@/features/staff/staff-directory-page";
import type { StaffDetailReadModel, StaffDirectoryMember } from "@/features/staff/types";

const actions = vi.hoisted(() => ({ updateStaffProfileAction: vi.fn() }));
const roleActions = vi.hoisted(() => ({ assignStaffRoleAction: vi.fn(), revokeStaffRoleAction: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/staff/staff-actions", () => actions);
vi.mock("@/features/staff/role-actions", () => roleActions);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const activeMember: StaffDirectoryMember = {
  avatarUrl: null,
  displayName: "Nguyễn Minh An",
  email: "an@example.com",
  employeeCode: "NS-001",
  employmentStatus: "active",
  id: "staff-1",
  joinedAt: "2025-08-01",
  lastLoginAt: "2026-08-10T01:30:00Z",
  leftAt: null,
  phone: "0900000000",
  roles: [{ assignedAt: "2025-08-01T00:00:00Z", assignmentId: "assignment-1", code: "teacher", id: "role-1", name: "Giáo viên" }],
};

const detail: StaffDetailReadModel = { ...activeMember, profileDisplayName: "Nguyễn Minh An", rateVersions: [{ createdAt: "2025-08-01T00:00:00Z", effectiveFrom: "2025-08-01", id: "rate-1", note: "Mức khởi điểm", offlineHourlyRateVnd: 120_000, onlineHourlyRateVnd: 60_000 }] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("Staff 1 presentation", () => {
  it("renders supplied staff in both operational variants with all real employment states and no invented directory controls", () => {
    render(<StaffDirectoryPage canManageRoles={false} canViewRoles members={[activeMember, { ...activeMember, displayName: "Trần Bình", employmentStatus: "inactive", id: "staff-2" }, { ...activeMember, displayName: "Lê Chi", employmentStatus: "suspended", id: "staff-3" }]} roleOptions={[]} />);

    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Nguyễn Minh An");
    expect(rows[2]).toHaveTextContent("Trần Bình");
    expect(rows[3]).toHaveTextContent("Lê Chi");
    expect(screen.getByRole("list", { name: "Danh sách nhân sự" })).toBeInTheDocument();
    expect(screen.getAllByText("Đang làm việc")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã nghỉ")).not.toHaveLength(0);
    expect(screen.getAllByText("Tạm khóa")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /thêm nhân sự|bộ lọc|trước|sau/i })).not.toBeInTheDocument();
  });

  it("uses the zero-padding directory work area and keeps rate history independently responsive", () => {
    const view = render(<StaffDirectoryPage canManageRoles={false} canViewRoles members={[activeMember]} roleOptions={[]} />);
    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
    const list = screen.getByRole("list", { name: "Danh sách nhân sự" });
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(table.closest(".staff-directory-work-area")).not.toBeNull();
    expect(list.closest(".staff-directory-work-area")).not.toBeNull();
    expect(globals).toMatch(/\.staff-directory-work-area,[\s\S]*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1042px\)[\s\S]*\.staff-directory-table/);
    view.unmount();

    render(<StaffDetailPage canManageProfile={false} canManageRateVersions={false} canViewRateVersions canViewRoles detail={detail} />);
    expect(screen.getByRole("table", { name: "Lịch sử đơn giá theo phiên bản" }).closest(".staff-rate-history-work-area")).not.toBeNull();
    expect(screen.getByRole("list", { name: "Lịch sử đơn giá theo phiên bản" }).closest(".staff-rate-history-work-area")).not.toBeNull();
    expect(globals).toMatch(/@container \(min-width: 762px\)[\s\S]*\.staff-rate-history-table/);
  });

  it("keeps role visibility and self-equivalent rate viewing separate from rate mutation", () => {
    render(<StaffDetailPage canManageProfile={false} canManageRateVersions={false} canViewRateVersions canViewRoles={false} detail={detail} />);

    expect(screen.getByText("Tài khoản hiện tại không có quyền staff.roles.view.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lịch sử đơn giá theo phiên bản" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm phiên bản đơn giá" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chỉnh sửa hồ sơ" })).not.toBeInTheDocument();
  });

  it("keeps rate-history rows immutable and separate from payroll interpretation", () => {
    render(<StaffDetailPage canManageProfile={false} canManageRateVersions={false} canViewRateVersions canViewRoles={false} detail={detail} />);

    expect(screen.getAllByText(/120\.000/)).not.toHaveLength(0);
    expect(screen.getAllByText(/60\.000/)).not.toHaveLength(0);
    expect(screen.getAllByText("Mức khởi điểm")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /chỉnh sửa đơn giá|xóa đơn giá|kích hoạt|chọn đơn giá|tính lương/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/lương tháng|giờ × đơn giá|gross|net/i)).not.toBeInTheDocument();
  });

  it("exposes the existing profile-edit trigger only for the permitted detail presentation", () => {
    render(<StaffDetailPage canManageProfile canManageRateVersions={false} canViewRateVersions={false} canViewRoles detail={detail} />);

    expect(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" })).toBeInTheDocument();
  });

  it("keeps the profile-update reason visibly required and blocks an empty direct submission", () => {
    render(<StaffProfileEditDialog detail={detail} />);

    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    const reason = screen.getByLabelText("Lý do cập nhật");
    const submit = screen.getByRole("button", { name: "Lưu hồ sơ" });

    expect(reason).toBeRequired();
    fireEvent.click(submit);
    expect(actions.updateStaffProfileAction).not.toHaveBeenCalled();
  });

  it("keeps the existing profile payload, labelled validation, and pending-safe dialog behavior", async () => {
    const pending = deferred<{ fieldErrors: { reason: string[] }; message: string; status: "error" }>();
    actions.updateStaffProfileAction.mockReturnValueOnce(pending.promise);
    render(<StaffProfileEditDialog detail={detail} />);

    const trigger = screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Chỉnh sửa hồ sơ nhân sự" });
    await waitFor(() => expect(screen.getByLabelText("Tên hiển thị")).toHaveFocus());
    fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "Nguyễn Minh An mới" } });
    fireEvent.change(screen.getByLabelText("Lý do cập nhật"), { target: { value: "Cập nhật thông tin liên hệ." } });
    const submit = within(dialog).getByRole("button", { name: "Lưu hồ sơ" });
    fireEvent.click(submit);

    await waitFor(() => expect(actions.updateStaffProfileAction).toHaveBeenCalledWith({ displayName: "Nguyễn Minh An mới", employeeCode: "NS-001", employmentStatus: "active", joinedAt: "2025-08-01", leftAt: "", phone: "0900000000", reason: "Cập nhật thông tin liên hệ.", staffId: "staff-1" }));
    expect(submit).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(submit);
    expect(screen.getByRole("dialog", { name: "Chỉnh sửa hồ sơ nhân sự" })).toBeInTheDocument();
    expect(actions.updateStaffProfileAction).toHaveBeenCalledOnce();

    pending.resolve({ fieldErrors: { reason: ["Cần nêu lý do cập nhật."] }, message: "Không thể cập nhật hồ sơ.", status: "error" });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể cập nhật hồ sơ."));
    const reason = screen.getByLabelText("Lý do cập nhật");
    const error = screen.getByText("Cần nêu lý do cập nhật.");
    expect(reason).toHaveAttribute("aria-describedby", error.id);
    expect(error.closest("label")).toBeNull();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe("Staff directory list (design 16a)", () => {
  const directory = [
    activeMember,
    { ...activeMember, displayName: "Trần Bình", email: "binh@example.com", employmentStatus: "inactive" as const, id: "staff-2", leftAt: "2026-09-30" },
    { ...activeMember, displayName: "Lê Chi", email: "chi@example.com", employmentStatus: "suspended" as const, id: "staff-3" },
  ];

  function chips() {
    return screen.getByRole("group", { name: "Lọc nhanh nhân sự" });
  }

  it("shows the header facts, the accounts link and the design columns without the never-written last login", () => {
    render(<StaffDirectoryPage canManageRoles={false} canOpenAccounts canViewRoles members={directory} roleOptions={[]} />);

    expect(screen.getByRole("heading", { level: 1, name: "Nhân sự" })).toBeInTheDocument();
    expect(screen.getByText("3 nhân sự · 1 đang làm việc")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tài khoản và lời mời" })).toHaveAttribute("href", "/settings/users");

    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Nhân sự", "Vai trò", "Trạng thái", "Vào làm", "SĐT", "Thao tác"]);
    expect(screen.queryByText(/Đăng nhập gần nhất|Chưa ghi nhận/)).not.toBeInTheDocument();
    expect(table.className).toContain("min-w-[1040px]");
    expect(within(table).getByRole("link", { name: "Mở hồ sơ nhân sự Nguyễn Minh An" })).toHaveAttribute("href", "/staff/staff-1");
    expect(screen.getAllByRole("link", { name: "Mở hồ sơ nhân sự Nguyễn Minh An" })).toHaveLength(2);
    expect(within(table).getByText("NS-001 · an@example.com")).toBeInTheDocument();
    expect(within(table).getAllByText("Giáo viên")[0]).toHaveAttribute("title", "Mã vai trò: teacher");
    expect(within(table).getByText("nghỉ từ 30/09/2026")).toBeInTheDocument();
    expect(within(table).getAllByText("01/08/2025")).toHaveLength(3);
    expect(within(table).getByText("Đang làm việc").className).toContain("rounded-sm");
    // One page: the frame summary only, no pager buttons.
    expect(screen.getByText("1–3 trong 3 nhân sự")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /Phân trang nhân sự/ })).not.toBeInTheDocument();
  });

  // Value: protects=the "Tài khoản và lời mời" link only shows to viewers who can open /settings/users (its settings layout also requires settings.view); fails_when=the link renders without canOpenAccounts, or the prop stops defaulting to false; why_new=the link was unconditional and dead-ended staff.view-only viewers on a permission-denied screen; seam=none (prop); no_claim=the route's permission read (staff-route.test.tsx)
  it("shows the accounts link only when the viewer can open settings", () => {
    const view = render(<StaffDirectoryPage canManageRoles={false} canViewRoles members={directory} roleOptions={[]} />);
    expect(screen.getByRole("heading", { level: 1, name: "Nhân sự" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tài khoản và lời mời" })).not.toBeInTheDocument();
    view.unmount();

    render(<StaffDirectoryPage canManageRoles={false} canOpenAccounts canViewRoles members={directory} roleOptions={[]} />);
    expect(screen.getByRole("link", { name: "Tài khoản và lời mời" })).toHaveAttribute("href", "/settings/users");
  });

  it("filters by accent-insensitive search and status chips, keeps zero chips hidden and empties inside the frame", () => {
    render(<StaffDirectoryPage canManageRoles={false} canViewRoles members={directory} roleOptions={[]} />);

    expect(within(chips()).getByRole("button", { name: /^Tất cả\s?3$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips()).getByRole("button", { name: /^Đang làm việc\s?1$/ })).toBeInTheDocument();
    expect(within(chips()).getByRole("button", { name: /^Tạm khóa\s?1$/ })).toBeInTheDocument();
    expect(within(chips()).getByRole("button", { name: /^Đã nghỉ\s?1$/ })).toBeInTheDocument();
    expect(within(chips()).queryByRole("button", { name: /Chưa xác định/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Xóa lọc/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân sự" }), { target: { value: "TRAN binh" } });
    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Trần Bình")).toBeInTheDocument();
    expect(within(chips()).getByRole("button", { name: /^Tất cả\s?1$/ })).toBeInTheDocument();
    expect(within(chips()).queryByRole("button", { name: /^Đang làm việc/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa lọc (1)" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân sự" }), { target: { value: "" } });
    fireEvent.click(within(chips()).getByRole("button", { name: /^Tạm khóa/ }));
    expect(within(chips()).getByRole("button", { name: /^Tạm khóa/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Lê Chi")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân sự" }), { target: { value: "không ai" } });
    expect(within(table).getAllByRole("row")).toHaveLength(1);
    expect(screen.getAllByText("Không có nhân sự khớp bộ lọc")).toHaveLength(2);
    // The active chip stays visible at zero so it can be switched off.
    expect(within(chips()).getByRole("button", { name: /^Tạm khóa\s?0$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("list", { name: "Danh sách nhân sự" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc (2)" }));
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("searchbox", { name: "Tìm nhân sự" })).toHaveValue("");
  });

  it("offers the role filter only with roles view, from role options and members' roles", () => {
    const view = render(<StaffDirectoryPage canManageRoles={false} canViewRoles members={directory} roleOptions={[{ code: "manager", description: null, id: "role-2", isSystem: false, name: "Quản lý" }]} />);

    const roleSelect = screen.getByLabelText("Vai trò");
    expect(within(roleSelect).getAllByRole("option").map((entry) => entry.textContent)).toEqual(["Tất cả vai trò", "Giáo viên", "Quản lý"]);
    fireEvent.change(roleSelect, { target: { value: "manager" } });
    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
    expect(within(table).getAllByRole("row")).toHaveLength(1);
    fireEvent.change(roleSelect, { target: { value: "teacher" } });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    view.unmount();

    render(<StaffDirectoryPage canManageRoles={false} canViewRoles={false} members={directory.map((entry) => ({ ...entry, roles: null }))} roleOptions={[]} />);
    expect(screen.queryByLabelText("Vai trò")).not.toBeInTheDocument();
    expect(screen.getByText("3 nhân sự · 1 đang làm việc · vai trò ẩn theo quyền hiện tại")).toBeInTheDocument();
    expect(screen.getAllByText("Ẩn theo phân quyền")).toHaveLength(6);
  });

  it("pages 20 members at a time in both layouts", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ ...activeMember, displayName: `Nhân sự ${String(index + 1).padStart(2, "0")}`, id: `staff-${index + 1}` }));
    render(<StaffDirectoryPage canManageRoles={false} canViewRoles members={many} roleOptions={[]} />);

    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
    expect(within(table).getAllByRole("row")).toHaveLength(21);
    expect(screen.getAllByText("1–20 trong 25 nhân sự")).toHaveLength(2);
    expect(screen.getByRole("navigation", { name: "Phân trang nhân sự (danh sách gọn)" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang nhân sự" })).getByRole("button", { name: "Sau" }));
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Nhân sự 21");
    expect(screen.getAllByText("21–25 trong 25 nhân sự")).toHaveLength(2);
  });

  // Value: protects=a filter change from page 2 sends the staff list back to page 1, and a role filter whose role the refreshed data no longer offers falls back to every member instead of an empty list; fails_when=updateFilters stops resetting the page, or the page filters with the raw requested role instead of resolveStaffDirectoryFilters' result; why_new=paging and the role fallback were only unit-tested, never through the page; seam=none (rerender with new props stands in for router.refresh); no_claim=the role server actions or the loader's active-role list
  it("returns to page 1 on a filter change and drops a role the refreshed data no longer offers", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ ...activeMember, displayName: `Nhân sự ${String(index + 1).padStart(2, "0")}`, id: `staff-${index + 1}` }));
    const manager = { code: "manager", description: null, id: "role-2", isSystem: false, name: "Quản lý" };
    const { rerender } = render(<StaffDirectoryPage canManageRoles={false} canViewRoles members={many} roleOptions={[manager]} />);
    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });

    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang nhân sự" })).getByRole("button", { name: "Sau" }));
    expect(screen.getAllByText("21–25 trong 25 nhân sự")).toHaveLength(2);
    // Every member still matches, but a new search starts at the top.
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân sự" }), { target: { value: "nhan su" } });
    expect(screen.getAllByText("1–20 trong 25 nhân sự")).toHaveLength(2);
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Nhân sự 01");

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân sự" }), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Vai trò"), { target: { value: "manager" } });
    expect(within(table).getAllByRole("row")).toHaveLength(1);

    // The "Quản lý" role was deactivated and nobody holds it: the refreshed data no longer offers it.
    rerender(<StaffDirectoryPage canManageRoles={false} canViewRoles members={many} roleOptions={[]} />);
    expect(screen.getByLabelText("Vai trò")).toHaveValue("all");
    expect(within(table).getAllByRole("row")).toHaveLength(21);
    expect(screen.queryByText("Không có nhân sự khớp bộ lọc")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Xóa lọc/ })).not.toBeInTheDocument();
  });

  it("keeps role management mounted inline for every member in both layouts for managers", () => {
    render(<StaffDirectoryPage canManageRoles canViewRoles members={directory} roleOptions={[]} />);

    // One active member x (table + card); the others get the component's own active-only notice.
    expect(screen.getAllByRole("heading", { name: "Quản lý vai trò" })).toHaveLength(2);
    expect(screen.getAllByText("Chỉ có thể cấp vai trò cho nhân sự đang hoạt động.")).toHaveLength(4);
    expect(within(screen.getByRole("table", { name: "Danh sách nhân sự" })).getByRole("heading", { name: "Quản lý vai trò" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Danh sách nhân sự" })).getByRole("heading", { name: "Quản lý vai trò" })).toBeInTheDocument();
  });

  it("names missing profile facts instead of leaving cells blank", () => {
    render(<StaffDirectoryPage canManageRoles={false} canViewRoles members={[{ ...activeMember, employeeCode: null, joinedAt: null, phone: null, roles: [] }]} roleOptions={[]} />);

    expect(screen.getAllByText("Chưa có mã nhân sự · an@example.com")).toHaveLength(2);
    expect(screen.getAllByText("Chưa cập nhật")).toHaveLength(2);
    expect(screen.getAllByText("Chưa có số điện thoại")).toHaveLength(2);
    expect(screen.getAllByText("Chưa được cấp vai trò")).toHaveLength(2);
  });

  it("renders the in-frame empty state when no member is loaded", () => {
    render(<StaffDirectoryPage canManageRoles canViewRoles members={[]} roleOptions={[]} />);

    expect(within(screen.getByRole("table", { name: "Danh sách nhân sự" })).getAllByRole("row")).toHaveLength(1);
    expect(screen.getAllByText("Chưa có hồ sơ nhân sự")).toHaveLength(2);
    expect(screen.getByText("0 nhân sự · 0 đang làm việc")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Tìm nhân sự" })).toBeDisabled();
    expect(screen.queryByRole("list", { name: "Danh sách nhân sự" })).not.toBeInTheDocument();
  });
});
