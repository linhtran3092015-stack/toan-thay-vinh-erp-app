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
    expect(globals).toMatch(/@container \(min-width: 1182px\)[\s\S]*\.staff-directory-table/);
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
