import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffDetailRoute from "@/app/(app)/staff/[staffId]/page";
import StaffRoute from "@/app/(app)/staff/page";
import type { StaffDetailReadModel, StaffDirectoryMember, StaffRoleOption } from "@/features/staff/types";

const dependencies = vi.hoisted(() => ({
  getCurrentAuthUser: vi.fn(),
  getCachedDatabasePermissions: vi.fn(),
  getStaffDetail: vi.fn(),
  getStaffDirectory: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/auth/current-user", () => ({
  getCurrentAuthUser: dependencies.getCurrentAuthUser,
}));
vi.mock("@/features/staff/data", () => ({
  getStaffDetail: dependencies.getStaffDetail,
  getStaffDirectory: dependencies.getStaffDirectory,
}));
vi.mock("@/features/staff/role-actions", () => ({ assignStaffRoleAction: vi.fn(), revokeStaffRoleAction: vi.fn() }));
vi.mock("@/features/staff/staff-actions", () => ({ createStaffRateVersionAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const selfStaffId = "11111111-1111-4111-8111-111111111111";
const selfDetail: StaffDetailReadModel = {
  avatarUrl: null,
  displayName: "Nguyễn Minh An",
  email: "an@example.com",
  employeeCode: "NS-001",
  employmentStatus: "active",
  id: selfStaffId,
  joinedAt: "2025-08-01",
  lastLoginAt: null,
  leftAt: null,
  phone: "0900000000",
  profileDisplayName: "Nguyễn Minh An",
  rateVersions: [{
    createdAt: "2025-08-01T00:00:00Z",
    effectiveFrom: "2025-08-01",
    id: "rate-1",
    note: "Mức khởi điểm",
    offlineHourlyRateVnd: 120_000,
    onlineHourlyRateVnd: 60_000,
  }],
  roles: null,
};

const directoryMember: StaffDirectoryMember = {
  ...selfDetail,
  roles: [{
    assignedAt: "2025-08-01T00:00:00Z",
    assignmentId: "22222222-2222-4222-8222-222222222222",
    code: "teacher",
    id: "33333333-3333-4333-8333-333333333333",
    name: "Giáo viên",
  }],
};

const roleOptions: StaffRoleOption[] = [{
  code: "teacher",
  description: "Giảng dạy",
  id: "33333333-3333-4333-8333-333333333333",
  isSystem: false,
  name: "Giáo viên",
}];

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Staff route authority", () => {
  it("retains staff.view as the directory route authority", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: [] });

    render(await StaffRoute());

    expect(screen.getByRole("heading", { name: "Không có quyền xem danh sách nhân sự" })).toBeInTheDocument();
    expect(dependencies.getStaffDirectory).not.toHaveBeenCalled();
  });

  it("requires the existing staff.roles.view plus staff.roles.manage composition before mounting role mutation", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["staff.view", "staff.roles.manage"],
    });
    dependencies.getStaffDirectory.mockResolvedValueOnce({
      members: [directoryMember],
      ok: true,
      roleOptions,
    });

    const noRoleView = render(await StaffRoute());

    expect(dependencies.getStaffDirectory).toHaveBeenCalledWith({ includeRoles: false });
    expect(screen.queryByRole("heading", { name: "Quản lý vai trò" })).not.toBeInTheDocument();
    noRoleView.unmount();

    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["staff.view", "staff.roles.view"],
    });
    dependencies.getStaffDirectory.mockResolvedValueOnce({
      members: [directoryMember],
      ok: true,
      roleOptions,
    });

    const roleViewer = render(await StaffRoute());

    expect(dependencies.getStaffDirectory).toHaveBeenLastCalledWith({ includeRoles: true });
    expect(screen.getAllByText("Giáo viên")).not.toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Quản lý vai trò" })).not.toBeInTheDocument();
    expect(screen.queryByText("Mở quản lý vai trò")).not.toBeInTheDocument();
    expect(screen.queryByText("Thu hồi: Giáo viên")).not.toBeInTheDocument();
    roleViewer.unmount();

    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["staff.view", "staff.roles.view", "staff.roles.manage"],
    });
    dependencies.getStaffDirectory.mockResolvedValueOnce({
      members: [directoryMember],
      ok: true,
      roleOptions,
    });

    render(await StaffRoute());

    expect(dependencies.getStaffDirectory).toHaveBeenLastCalledWith({ includeRoles: true });
    expect(screen.getAllByRole("heading", { name: "Quản lý vai trò" })).not.toHaveLength(0);
  });

  it("allows a staff member to view their own rate history without granting rate mutation", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["staff.view"],
    });
    dependencies.getCurrentAuthUser.mockResolvedValueOnce({
      ok: true,
      user: {
        avatarUrl: undefined,
        displayName: "Nguyễn Minh An",
        email: "an@example.com",
        id: selfStaffId,
        initials: "NA",
      },
    });
    dependencies.getStaffDetail.mockResolvedValueOnce({ ok: true, detail: selfDetail });

    render(await StaffDetailRoute({ params: Promise.resolve({ staffId: selfStaffId }) }));

    expect(dependencies.getStaffDetail).toHaveBeenCalledWith(selfStaffId, {
      includeRateVersions: true,
      includeRoles: false,
    });
    expect(screen.getByRole("heading", { name: "Lịch sử đơn giá theo phiên bản" })).toBeInTheDocument();
    expect(screen.getAllByText(/120\.000/)).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Thêm phiên bản đơn giá" })).not.toBeInTheDocument();
  });

  it("mounts rate history and the add-rate trigger only for staff.manage_rates", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["staff.view", "staff.manage_rates"],
    });
    dependencies.getCurrentAuthUser.mockResolvedValueOnce({
      ok: true,
      user: {
        avatarUrl: undefined,
        displayName: "Quản lý",
        email: "manager@example.com",
        id: "44444444-4444-4444-8444-444444444444",
        initials: "QL",
      },
    });
    dependencies.getStaffDetail.mockResolvedValueOnce({ ok: true, detail: selfDetail });

    render(await StaffDetailRoute({ params: Promise.resolve({ staffId: selfStaffId }) }));

    expect(dependencies.getStaffDetail).toHaveBeenCalledWith(selfStaffId, {
      includeRateVersions: true,
      includeRoles: false,
    });
    expect(screen.getByRole("heading", { name: "Lịch sử đơn giá theo phiên bản" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm phiên bản đơn giá" })).toBeInTheDocument();
  });

  it("does not load rate history for another staff member without staff.manage_rates", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["staff.view"],
    });
    dependencies.getCurrentAuthUser.mockResolvedValueOnce({
      ok: true,
      user: {
        avatarUrl: undefined,
        displayName: "Người xem",
        email: "viewer@example.com",
        id: "55555555-5555-4555-8555-555555555555",
        initials: "NX",
      },
    });
    dependencies.getStaffDetail.mockResolvedValueOnce({
      ok: true,
      detail: { ...selfDetail, rateVersions: null },
    });

    render(await StaffDetailRoute({ params: Promise.resolve({ staffId: selfStaffId }) }));

    expect(dependencies.getStaffDetail).toHaveBeenCalledWith(selfStaffId, {
      includeRateVersions: false,
      includeRoles: false,
    });
    expect(screen.queryByRole("heading", { name: "Lịch sử đơn giá theo phiên bản" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm phiên bản đơn giá" })).not.toBeInTheDocument();
  });
});
