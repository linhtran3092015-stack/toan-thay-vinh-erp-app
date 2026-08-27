import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OwnerPayrollDashboardRoute from "@/app/(app)/payroll/dashboard/page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getOwnerPayrollDashboardResult: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/payroll/dashboard/data", () => ({
  getOwnerPayrollDashboardResult: dependencies.getOwnerPayrollDashboardResult,
}));
vi.mock("@/features/payroll/dashboard/payroll-dashboard-page", () => ({
  OwnerPayrollDashboardPage: ({ dashboard }: { dashboard: { filters: { selectedMonth: string; selectedPositionCode: string | null } } }) => (
    <p>dashboard:{dashboard.filters.selectedMonth}/{dashboard.filters.selectedPositionCode ?? "all"}</p>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Owner payroll dashboard route authority", () => {
  it("loads the owner-only RPC with normalized URL filters", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.dashboard.view"],
    });
    dependencies.getOwnerPayrollDashboardResult.mockResolvedValueOnce({
      data: { filters: { selectedMonth: "2026-08-01", selectedPositionCode: "teaching_assistant" } },
      ok: true,
    });

    render(await OwnerPayrollDashboardRoute({
      searchParams: Promise.resolve({ month: "2026-08", position: "teaching_assistant" }),
    }));

    expect(screen.getByText("dashboard:2026-08-01/teaching_assistant")).toBeInTheDocument();
    expect(dependencies.getOwnerPayrollDashboardResult).toHaveBeenCalledWith({
      positionCode: "teaching_assistant",
      selectedMonth: "2026-08-01",
    });
  });

  it("fails closed and does not query payroll for ordinary payroll viewers", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.view"],
    });

    render(await OwnerPayrollDashboardRoute({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Không có quyền xem Dashboard lương")).toBeInTheDocument();
    expect(dependencies.getOwnerPayrollDashboardResult).not.toHaveBeenCalled();
  });

  it("shows a stable error state when the dashboard RPC fails", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.dashboard.view"],
    });
    dependencies.getOwnerPayrollDashboardResult.mockResolvedValueOnce({ ok: false });

    render(await OwnerPayrollDashboardRoute({
      searchParams: Promise.resolve({ month: "2026-08" }),
    }));

    expect(screen.getByText("Không tải được Dashboard lương")).toBeInTheDocument();
    expect(screen.getByText("Không thể tải dữ liệu lương. Vui lòng thử lại.")).toBeInTheDocument();
  });
});
