import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PayrollRoute from "@/app/(app)/payroll/page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getPayrollDashboardResult: vi.fn(),
  getPayrollPeriodsWithDetailsResult: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/payroll/data", () => ({
  getPayrollDashboardResult: dependencies.getPayrollDashboardResult,
  getPayrollPeriodsWithDetailsResult: dependencies.getPayrollPeriodsWithDetailsResult,
}));
vi.mock("@/features/payroll/payroll-page", () => ({
  PayrollPage: ({
    canApprove,
    canManage,
    canReconcile,
    periods,
  }: {
    canApprove: boolean;
    canManage: boolean;
    canReconcile: boolean;
    periods: readonly { id: string }[];
  }) => (
    <div>
      <p>canApprove:{String(canApprove)}</p>
      <p>canManage:{String(canManage)}</p>
      <p>canReconcile:{String(canReconcile)}</p>
      <p>periods:{periods.length}</p>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Payroll route authority", () => {
  it("loads the Payroll 0 detail reader for payroll.view without loading the legacy dashboard reader", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.view"],
    });
    dependencies.getPayrollPeriodsWithDetailsResult.mockResolvedValueOnce({
      data: [{ id: "period-1" }],
      ok: true,
    });

    render(await PayrollRoute());

    expect(screen.getByText("canApprove:false")).toBeInTheDocument();
    expect(screen.getByText("canManage:false")).toBeInTheDocument();
    expect(screen.getByText("canReconcile:false")).toBeInTheDocument();
    expect(screen.getByText("periods:1")).toBeInTheDocument();
    expect(dependencies.getPayrollPeriodsWithDetailsResult).toHaveBeenCalledOnce();
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });

  it("does not load either Payroll reader without payroll.view", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [],
    });

    render(await PayrollRoute());

    expect(screen.getByText("Không có quyền xem bảng lương")).toBeInTheDocument();
    expect(dependencies.getPayrollPeriodsWithDetailsResult).not.toHaveBeenCalled();
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });

  it("passes payroll.accountant_reconcile independently to Payroll 2 composition", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.view", "payroll.accountant_reconcile"],
    });
    dependencies.getPayrollPeriodsWithDetailsResult.mockResolvedValueOnce({
      data: [{ id: "period-1" }],
      ok: true,
    });

    render(await PayrollRoute());

    expect(screen.getByText("canApprove:false")).toBeInTheDocument();
    expect(screen.getByText("canManage:false")).toBeInTheDocument();
    expect(screen.getByText("canReconcile:true")).toBeInTheDocument();
    expect(screen.getByText("periods:1")).toBeInTheDocument();
    expect(dependencies.getPayrollPeriodsWithDetailsResult).toHaveBeenCalledOnce();
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });

  it("passes payroll.owner_approve independently without treating payroll.manage as transition authority", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.view", "payroll.manage", "payroll.owner_approve"],
    });
    dependencies.getPayrollPeriodsWithDetailsResult.mockResolvedValueOnce({
      data: [],
      ok: true,
    });

    render(await PayrollRoute());

    expect(screen.getByText("canApprove:true")).toBeInTheDocument();
    expect(screen.getByText("canManage:true")).toBeInTheDocument();
    expect(screen.getByText("canReconcile:false")).toBeInTheDocument();
    expect(dependencies.getPayrollPeriodsWithDetailsResult).toHaveBeenCalledOnce();
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });
});
