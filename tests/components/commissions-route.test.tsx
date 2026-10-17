import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CommissionsRoute from "@/app/(app)/commissions/page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getSalesCommissionAccrualsDashboardResult: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/commissions/data", () => ({
  getSalesCommissionAccrualsDashboardResult: dependencies.getSalesCommissionAccrualsDashboardResult,
}));
vi.mock("@/features/commissions/commission-list-page", () => ({
  CommissionListPage: ({ canManage, entries, limit }: { canManage: boolean; entries: readonly { id: string }[]; limit?: number }) => (
    <div>
      <p>canManage:{String(canManage)}</p>
      <p>entries:{entries.length}</p>
      <p>limit:{String(limit)}</p>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Commissions route authority", () => {
  it("loads the authoritative reader for commissions.view and passes commissions.manage independently", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["commissions.view", "commissions.manage"],
    });
    dependencies.getSalesCommissionAccrualsDashboardResult.mockResolvedValueOnce({
      data: [{ id: "accrual-1" }],
      ok: true,
    });

    render(await CommissionsRoute());

    expect(screen.getByText("canManage:true")).toBeInTheDocument();
    expect(screen.getByText("entries:1")).toBeInTheDocument();
    expect(dependencies.getSalesCommissionAccrualsDashboardResult).toHaveBeenCalledOnce();
  });

  it("does not load the reader without commissions.view", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["commissions.manage", "commissions.owner_adjust"],
    });

    render(await CommissionsRoute());

    expect(screen.getByText("Không có quyền xem hoa hồng Sale")).toBeInTheDocument();
    expect(dependencies.getSalesCommissionAccrualsDashboardResult).not.toHaveBeenCalled();
  });

  it("does not treat the reserved owner-adjust permission as management or an action authority", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["commissions.view", "commissions.owner_adjust"],
    });
    dependencies.getSalesCommissionAccrualsDashboardResult.mockResolvedValueOnce({
      data: [{ id: "accrual-2" }],
      ok: true,
    });

    render(await CommissionsRoute());

    expect(screen.getByText("canManage:false")).toBeInTheDocument();
    expect(dependencies.getSalesCommissionAccrualsDashboardResult).toHaveBeenCalledOnce();
  });

  // Value: protects=the route asks the reader for the RPC maximum (500) and tells the page the same cap, so the "có thể chưa đủ" notice names the number actually loaded; fails_when=the route falls back to the 200 default or passes a different limit to the page than to the reader; seam=reader and page are mocked; no_claim=the RPC's own 1-500 range check
  it("reads the newest 500 rows and passes that cap to the page", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["commissions.view"],
    });
    dependencies.getSalesCommissionAccrualsDashboardResult.mockResolvedValueOnce({
      data: [],
      ok: true,
    });

    render(await CommissionsRoute());

    expect(dependencies.getSalesCommissionAccrualsDashboardResult).toHaveBeenCalledWith(500);
    expect(screen.getByText("limit:500")).toBeInTheDocument();
    expect(screen.getByText("entries:0")).toBeInTheDocument();
  });
});
