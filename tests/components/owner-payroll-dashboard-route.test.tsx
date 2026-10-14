import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OwnerPayrollDashboardRoute from "@/app/(app)/payroll/dashboard/page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getOwnerPayrollDashboardResult: vi.fn(),
  getOwnerPayrollEstimateResult: vi.fn(async () => ({ ok: false as const })),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/payroll/dashboard/data", () => ({
  getOwnerPayrollDashboardResult: dependencies.getOwnerPayrollDashboardResult,
}));
vi.mock("@/features/payroll/estimate/data", () => ({
  getOwnerPayrollEstimateResult: dependencies.getOwnerPayrollEstimateResult,
}));
vi.mock("@/features/payroll/dashboard/payroll-dashboard-page", () => ({
  OwnerPayrollDashboardPage: ({
    canApprove,
    dashboard,
  }: {
    canApprove?: boolean;
    dashboard: { filters: { selectedMonth: string; selectedPositionCode: string | null } };
  }) => (
    <>
      <p>dashboard:{dashboard.filters.selectedMonth}/{dashboard.filters.selectedPositionCode ?? "all"}</p>
      <p>canApprove:{String(canApprove)}</p>
    </>
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

  // Value: protects=the dashboard's only primary ("Xem kỳ MM/YYYY chờ duyệt") is offered only to viewers who hold payroll.owner_approve;
  // fails_when=the route stops passing canApprove, passes it unconditionally, or reads a different permission code;
  // why_new=review fix T1: step 8 added the canApprove prop to the route without a route-level test;
  // seam=permissions, both loaders and the page component are mocked; the page mock prints the prop it receives; no_claim=does not prove the RPC enforces approval (the approve action checks it server-side)
  it("passes canApprove only with payroll.owner_approve", async () => {
    dependencies.getOwnerPayrollDashboardResult.mockResolvedValue({
      data: { filters: { selectedMonth: "2026-10-01", selectedPositionCode: null } },
      ok: true,
    });

    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.dashboard.view", "payroll.owner_approve"],
    });
    render(await OwnerPayrollDashboardRoute({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("canApprove:true")).toBeInTheDocument();
    cleanup();

    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.dashboard.view"],
    });
    render(await OwnerPayrollDashboardRoute({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("canApprove:false")).toBeInTheDocument();
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
