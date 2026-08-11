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
  PayrollPage: ({ canManage, periods }: { canManage: boolean; periods: readonly { id: string }[] }) => (
    <div>
      <p>canManage:{String(canManage)}</p>
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

    expect(screen.getByText("canManage:false")).toBeInTheDocument();
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

  it("passes payroll.manage to Payroll 1 composition while retaining the same detail reader", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.view", "payroll.manage"],
    });
    dependencies.getPayrollPeriodsWithDetailsResult.mockResolvedValueOnce({
      data: [],
      ok: true,
    });

    render(await PayrollRoute());

    expect(screen.getByText("canManage:true")).toBeInTheDocument();
    expect(screen.getByText("periods:0")).toBeInTheDocument();
    expect(dependencies.getPayrollPeriodsWithDetailsResult).toHaveBeenCalledOnce();
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });
});
