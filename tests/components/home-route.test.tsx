// Value: protects=the home route "/" loads no dashboard data without dashboard.view or when permissions fail, hands the executive load to the home loader once, gives any payroll.view viewer (either layout) the current month's live estimate, and only echoes a YYYY-MM month into "Thử lại";
// fails_when=the dashboard.view gate is removed or moved after the loads, the executive RPC runs twice, the estimate month drifts from the home model's today, or a raw ?month value reaches the retry link;
//   also when an out-of-range month (2026-13) still reaches the executive RPC, or a rejected executive read takes the whole home down instead of showing the analytics as an ErrorState;
// why_new=the route was rewired to DashboardHome and no test rendered "/" before;
// seam=none (loaders and DashboardHome/DashboardPage mocked at module boundaries; the returned element's props are inspected); no_claim=does not prove the loaders' queries, RLS or the rendered blocks
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  DashboardHome: vi.fn(() => null),
  DashboardPage: vi.fn(() => null),
  StaffLiveEstimateCard: vi.fn(() => null),
  StudentCareDashboardCard: vi.fn(() => null),
  getCachedDatabasePermissions: vi.fn(),
  getCenterDisplayName: vi.fn(async () => "Cơ sở Cầu Giấy"),
  getDashboardHomeReadModel: vi.fn(),
  getRoleAwareDashboardReadModel: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({ getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions }));
vi.mock("@/features/dashboard/data", () => ({ getRoleAwareDashboardReadModel: dependencies.getRoleAwareDashboardReadModel }));
vi.mock("@/features/dashboard/home-data", () => ({ getDashboardHomeReadModel: dependencies.getDashboardHomeReadModel }));
vi.mock("@/features/settings/system-settings-data", () => ({ getCenterDisplayName: dependencies.getCenterDisplayName }));
vi.mock("@/features/dashboard/components/home/dashboard-home", () => ({ DashboardHome: dependencies.DashboardHome }));
vi.mock("@/features/dashboard/dashboard-page", () => ({ DashboardPage: dependencies.DashboardPage }));
vi.mock("@/features/payroll/estimate/components/staff-live-estimate-card", () => ({ StaffLiveEstimateCard: dependencies.StaffLiveEstimateCard }));
vi.mock("@/features/student-care/dashboard-card", () => ({ StudentCareDashboardCard: dependencies.StudentCareDashboardCard }));

import Home from "@/app/(app)/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";

afterEach(() => {
  vi.clearAllMocks();
});

const executive = { marker: "executive" };

function arrange(permissions: string[], layout: "center" | "personal") {
  dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });
  dependencies.getRoleAwareDashboardReadModel.mockResolvedValue(executive);
  dependencies.getDashboardHomeReadModel.mockResolvedValue({ layout, today: "2026-10-14" });
}

async function renderRoute(searchParams?: { month?: string }) {
  return (await Home({ searchParams: searchParams ? Promise.resolve(searchParams) : undefined })) as ReactElement<Record<string, unknown>>;
}

describe("home route", () => {
  it("loads no dashboard data without dashboard.view or when permissions fail to load", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["sessions.view", "payroll.view"] });
    expect((await renderRoute()).type).toBe(PermissionDeniedState);

    dependencies.getCachedDatabasePermissions.mockResolvedValue({ error: "boom", ok: false });
    expect((await renderRoute()).type).toBe(ErrorState);

    expect(dependencies.getRoleAwareDashboardReadModel).not.toHaveBeenCalled();
    expect(dependencies.getDashboardHomeReadModel).not.toHaveBeenCalled();
    expect(dependencies.getCenterDisplayName).not.toHaveBeenCalled();
  });

  it("shares the executive load with the home loader, gives a personal payroll.view viewer this month's estimate and keeps only a valid month in the retry link", async () => {
    const permissions = ["dashboard.view", "sessions.view", "attendance.mark", "timekeeping.check", "payroll.view"];
    arrange(permissions, "personal");

    const element = await renderRoute({ month: "2026-09" });

    expect(element.type).toBe(dependencies.DashboardHome);
    expect(dependencies.getRoleAwareDashboardReadModel).toHaveBeenCalledTimes(1);
    expect(dependencies.getRoleAwareDashboardReadModel).toHaveBeenCalledWith(permissions, "2026-09");
    const [, executiveArg] = dependencies.getDashboardHomeReadModel.mock.calls[0] as unknown as [unknown, Promise<unknown>];
    await expect(executiveArg).resolves.toBe(executive);
    expect(element.props).toMatchObject({ centerDisplayName: "Cơ sở Cầu Giấy", retryHref: "/?month=2026-09" });
    const estimate = element.props.payrollEstimate as ReactElement<{ month: string }>;
    expect(estimate.type).toBe(dependencies.StaffLiveEstimateCard);
    expect(estimate.props.month).toBe("2026-10-01");

    vi.clearAllMocks();
    arrange(["dashboard.view", "sessions.view"], "personal");
    const unsafe = await renderRoute({ month: "//evil.example" });
    expect(unsafe.props).toMatchObject({ payrollEstimate: undefined, retryHref: "/" });

    vi.clearAllMocks();
    arrange(["dashboard.view", "sessions.view", "finance.view", "payroll.view"], "center");
    const centre = await renderRoute();
    expect((centre.props.payrollEstimate as ReactElement).type).toBe(dependencies.StaffLiveEstimateCard);
  });

  // Value: protects=only a YYYY-(01..12) month reaches the executive RPC and the retry link; fails_when=the regex accepts 2026-13 / 2026-00 / 2026-9, which would fail the RPC and with it the home work list; why_new=the month check was tightened in review; seam=none; no_claim=none
  it("treats an out-of-range or malformed month as absent", async () => {
    const permissions = ["dashboard.view", "sessions.view"];
    for (const month of ["2026-13", "2026-00", "2026-9", "2026-10-01"]) {
      vi.clearAllMocks();
      arrange(permissions, "personal");
      const element = await renderRoute({ month });

      expect(dependencies.getRoleAwareDashboardReadModel, month).toHaveBeenCalledWith(permissions, undefined);
      expect(element.props.retryHref, month).toBe("/");
    }

    vi.clearAllMocks();
    arrange(permissions, "personal");
    const december = await renderRoute({ month: "2026-12" });
    expect(dependencies.getRoleAwareDashboardReadModel).toHaveBeenCalledWith(permissions, "2026-12");
    expect(december.props.retryHref).toBe("/?month=2026-12");
  });

  // Value: protects=a failed executive read leaves the home blocks rendered (its feeds fail inside the loader) and replaces only the analytics with an ErrorState;
  // fails_when=the rejection propagates and the route throws, the home loader receives a rejecting promise instead of null, or the analytics slot still renders DashboardPage; why_new=the route now catches the executive read; seam=none; no_claim=does not render ErrorState's text
  it("keeps the home and shows the analytics as an error when the executive read rejects", async () => {
    arrange(["dashboard.view", "sessions.view"], "personal");
    dependencies.getRoleAwareDashboardReadModel.mockRejectedValue(new Error("rpc"));

    const element = await renderRoute();

    expect(element.type).toBe(dependencies.DashboardHome);
    expect((element.props.analytics as ReactElement).type).toBe(ErrorState);
    const [, executiveArg] = dependencies.getDashboardHomeReadModel.mock.calls[0] as unknown as [unknown, Promise<unknown>];
    await expect(executiveArg).resolves.toBeNull();

    vi.clearAllMocks();
    arrange(["dashboard.view", "sessions.view"], "personal");
    const healthy = await renderRoute();
    const analytics = healthy.props.analytics as ReactElement<{ dashboard: unknown }>;
    expect(analytics.type).toBe(dependencies.DashboardPage);
    expect(analytics.props.dashboard).toBe(executive);
  });
});
