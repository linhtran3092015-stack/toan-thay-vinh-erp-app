import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffDetailRoute from "@/app/(app)/staff/[staffId]/page";
import StaffRoute from "@/app/(app)/staff/page";
import type { StaffDetailReadModel } from "@/features/staff/types";

const dependencies = vi.hoisted(() => ({
  getCurrentAuthUser: vi.fn(),
  getCachedDatabasePermissions: vi.fn(),
  getStaffDetail: vi.fn(),
  getStaffDirectory: vi.fn(),
}));

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

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Staff route authority", () => {
  it("retains staff.view as the directory route authority", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: [] });

    render(await StaffRoute());

    expect(screen.getByRole("heading", { name: "Không có quyền xem danh sách nhân sự" })).toBeInTheDocument();
    expect(dependencies.getStaffDirectory).not.toHaveBeenCalled();
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
});
