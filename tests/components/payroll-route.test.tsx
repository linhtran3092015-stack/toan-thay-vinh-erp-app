import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PayrollRoute from "@/app/(app)/payroll/page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  getPayrollDashboardResult: vi.fn(),
  getPayrollManagementOverviewResult: vi.fn(),
  getRecentPayrollPeriodsResult: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/auth/current-user", () => ({
  getCurrentAuthUser: dependencies.getCurrentAuthUser,
}));
vi.mock("@/features/payroll/data", () => ({
  getPayrollDashboardResult: dependencies.getPayrollDashboardResult,
  getPayrollManagementOverviewResult: dependencies.getPayrollManagementOverviewResult,
  getRecentPayrollPeriodsResult: dependencies.getRecentPayrollPeriodsResult,
}));
vi.mock("@/features/payroll/payroll-page", () => ({
  PayrollPage: ({
    canApprove,
    canManage,
    canReconcile,
    olderPeriodCount,
    periodCount,
    periods,
  }: {
    canApprove: boolean;
    canManage: boolean;
    canReconcile: boolean;
    olderPeriodCount: number;
    periodCount: number;
    periods: readonly { id: string }[];
  }) => (
    <div>
      <p>canApprove:{String(canApprove)}</p>
      <p>canManage:{String(canManage)}</p>
      <p>canReconcile:{String(canReconcile)}</p>
      <p>periods:{periods.length}</p>
      <p>periodCount:{periodCount}</p>
      <p>olderPeriodCount:{olderPeriodCount}</p>
    </div>
  ),
}));

function recentPeriods(periods: readonly { id: string }[], olderPeriodCount = 0) {
  return { data: { olderPeriodCount, periods, staleStatement: null }, ok: true };
}

function route(search: { period?: string; periods?: string } = {}) {
  return PayrollRoute({ searchParams: Promise.resolve(search) });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  dependencies.getCurrentAuthUser.mockResolvedValue({
    ok: true,
    user: { id: "11111111-1111-4111-8111-111111111111" },
  });
  dependencies.getPayrollManagementOverviewResult.mockResolvedValue({
    data: { correctionRequests: [], importBatches: [], issues: [] },
    ok: true,
  });
});

describe("Payroll route authority", () => {
  it("loads the Payroll 0 detail reader for payroll.view without loading the legacy dashboard reader", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.view"],
    });
    dependencies.getRecentPayrollPeriodsResult.mockResolvedValueOnce(recentPeriods([{ id: "period-1" }]));

    render(await route());

    expect(screen.getByText("canApprove:false")).toBeInTheDocument();
    expect(screen.getByText("canManage:false")).toBeInTheDocument();
    expect(screen.getByText("canReconcile:false")).toBeInTheDocument();
    expect(screen.getByText("periods:1")).toBeInTheDocument();
    expect(dependencies.getRecentPayrollPeriodsResult).toHaveBeenCalledOnce();
    expect(dependencies.getRecentPayrollPeriodsResult).toHaveBeenCalledWith(3, null);
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });

  it("does not load either Payroll reader without payroll.view", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [],
    });

    render(await route());

    expect(screen.getByText("Không có quyền xem bảng lương")).toBeInTheDocument();
    expect(dependencies.getRecentPayrollPeriodsResult).not.toHaveBeenCalled();
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });

  it("passes payroll.accountant_reconcile independently to Payroll 2 composition", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.view", "payroll.accountant_reconcile"],
    });
    dependencies.getRecentPayrollPeriodsResult.mockResolvedValueOnce(recentPeriods([{ id: "period-1" }]));

    render(await route());

    expect(screen.getByText("canApprove:false")).toBeInTheDocument();
    expect(screen.getByText("canManage:false")).toBeInTheDocument();
    expect(screen.getByText("canReconcile:true")).toBeInTheDocument();
    expect(screen.getByText("periods:1")).toBeInTheDocument();
    expect(dependencies.getRecentPayrollPeriodsResult).toHaveBeenCalledOnce();
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });

  it("passes payroll.owner_approve independently without treating payroll.manage as transition authority", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payroll.view", "payroll.manage", "payroll.owner_approve"],
    });
    dependencies.getRecentPayrollPeriodsResult.mockResolvedValueOnce(recentPeriods([]));

    render(await route());

    expect(screen.getByText("canApprove:true")).toBeInTheDocument();
    expect(screen.getByText("canManage:true")).toBeInTheDocument();
    expect(screen.getByText("canReconcile:false")).toBeInTheDocument();
    expect(dependencies.getRecentPayrollPeriodsResult).toHaveBeenCalledOnce();
    expect(dependencies.getPayrollDashboardResult).not.toHaveBeenCalled();
  });
  // Value: protects=/payroll reads only the latest periods and grows the window from ?periods= when older ones are asked for;
  // fails_when=the route ignores ?periods= (older periods never load), passes an unclamped value, or drops olderPeriodCount so the "older periods" control never shows;
  // why_new=/payroll read the whole history before this change;
  // seam=data loaders and PayrollPage mocked; no_claim=the clamp range itself is covered in period-window.test.ts
  it("reads the number of recent periods asked for in ?periods=", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    dependencies.getRecentPayrollPeriodsResult.mockResolvedValueOnce(recentPeriods([{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }, { id: "p5" }, { id: "p6" }], 2));

    render(await route({ periods: "6" }));

    expect(dependencies.getRecentPayrollPeriodsResult).toHaveBeenCalledWith(6, null);
    expect(screen.getByText("periodCount:6")).toBeInTheDocument();
    expect(screen.getByText("olderPeriodCount:2")).toBeInTheDocument();
  });

  // Extended by /ship test coverage audit (pass 1): the "unavailable" case.
  // Value: protects=/payroll asks for a recalculation only when lines did not reconcile; any other failed read shows the plain "không tải được" message;
  // fails_when=the route shows the reconcile message for every failed read (an outage would ask for a recalculation) or drops it for an unreconciled read;
  // why_new=the existing case covered only reason "unreconciled", so a collapsed ternary still passed;
  // seam=none; no_claim=data loaders and PayrollPage are mocked; does not prove when the loader reports each reason (payroll-period-details-data.test does)
  it("explains a read that did not reconcile instead of rendering totals", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: ["payroll.view"] });
    dependencies.getRecentPayrollPeriodsResult.mockResolvedValueOnce({ ok: false, reason: "unreconciled" });

    const { unmount } = render(await route());

    expect(screen.getByText(/Các dòng lương chưa khớp với tổng của phiếu lương/)).toHaveTextContent("báo quản lý lương");

    unmount();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: ["payroll.view"] });
    dependencies.getRecentPayrollPeriodsResult.mockResolvedValueOnce({ ok: false, reason: "unavailable" });

    render(await route());

    expect(screen.getByText("Không tải được dữ liệu bảng lương từ hệ thống.")).toBeInTheDocument();
    expect(screen.queryByText(/Các dòng lương chưa khớp/)).not.toBeInTheDocument();
  });

  // Value: protects=a Tạm ứng link (/payroll?period=<id>) loads that period even outside the recent window, and a malformed id is ignored;
  // fails_when=the route drops ?period=, passes a non-uuid to the loader, or forgets it on the "older periods" link;
  // why_new=/payroll now shows only recent and open periods, so links to older ones need the id;
  // seam=data loaders and PayrollPage mocked; no_claim=does not prove the RPC includes the period (pgTAP does)
  it("passes a linked period through ?period= and ignores a malformed one", async () => {
    const periodId = "b2000000-0000-4000-8000-000000202609";
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["payroll.view"] });
    dependencies.getRecentPayrollPeriodsResult.mockResolvedValue(recentPeriods([{ id: periodId }]));

    const { unmount } = render(await route({ period: periodId }));
    expect(dependencies.getRecentPayrollPeriodsResult).toHaveBeenLastCalledWith(3, periodId);

    unmount();
    render(await route({ period: "period-9" }));
    expect(dependencies.getRecentPayrollPeriodsResult).toHaveBeenLastCalledWith(3, null);
  });

  it("tells a payroll manager to recalculate when a read did not reconcile", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    dependencies.getRecentPayrollPeriodsResult.mockResolvedValueOnce({ ok: false, reason: "unreconciled" });

    render(await route());

    expect(screen.getByText(/Các dòng lương chưa khớp/)).toHaveTextContent("mở kỳ lương và bấm Tính lại");
  });
});
