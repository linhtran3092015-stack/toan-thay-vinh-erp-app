import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FinanceOrdersRoute from "@/app/(app)/finance/orders/page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getFinanceOrdersDashboardResult: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/finance/data", () => ({
  getFinanceOrdersDashboardResult: dependencies.getFinanceOrdersDashboardResult,
}));
vi.mock("@/features/finance/components/finance-orders-page", () => ({
  FinanceOrdersPage: ({ canReview, canViewStudents, filters, today }: { canReview: boolean; canViewStudents?: boolean; filters: { month: string; orderType: string; period: string; source: string }; today?: string }) => (
    <>
      <div>review:{String(canReview)} · {filters.month}/{filters.orderType}/{filters.source}/{filters.period}</div>
      <div>{`students:${String(canViewStudents)} · today:${today}`}</div>
    </>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Finance Orders route authority", () => {
  it("reads the server-filtered dashboard for finance.view and exposes review only to payments.manage", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["finance.view", "payments.manage"],
    });
    dependencies.getFinanceOrdersDashboardResult.mockResolvedValueOnce({ data: {}, ok: true });

    render(await FinanceOrdersRoute({
      searchParams: Promise.resolve({ month: "2026-08", orderType: "renewal", source: "sb", period: "2" }),
    }));

    expect(screen.getByText("review:true · 2026-08/renewal/sb/2")).toBeInTheDocument();
    expect(dependencies.getFinanceOrdersDashboardResult).toHaveBeenCalledWith({
      month: "2026-08",
      orderType: "renewal",
      period: "2",
      source: "sb",
    });
  });

  it("passes students.view and the Vietnam business date from what it already loaded", async () => {
    // 18:30 UTC on 16/10 is already 17/10 in Vietnam.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T18:30:00.000Z"));
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["finance.view", "students.view"],
    });
    dependencies.getFinanceOrdersDashboardResult.mockResolvedValueOnce({ data: {}, ok: true });

    render(await FinanceOrdersRoute({ searchParams: Promise.resolve({ month: "2026-10" }) }));

    expect(screen.getByText("review:false · 2026-10///")).toBeInTheDocument();
    expect(screen.getByText("students:true · today:2026-10-17")).toBeInTheDocument();
    expect(dependencies.getFinanceOrdersDashboardResult).toHaveBeenCalledWith({ month: "2026-10", orderType: "", period: "", source: "" });
  });

  it("keeps student links off without students.view", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: ["finance.view"] });
    dependencies.getFinanceOrdersDashboardResult.mockResolvedValueOnce({ data: {}, ok: true });

    render(await FinanceOrdersRoute({ searchParams: Promise.resolve({ month: "2026-10" }) }));

    expect(screen.getByText(/^students:false · today:\d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
  });

  it("does not load financial orders without finance.view", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["payments.manage"],
    });

    render(await FinanceOrdersRoute({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Không có quyền xem Đơn hàng")).toBeInTheDocument();
    expect(dependencies.getFinanceOrdersDashboardResult).not.toHaveBeenCalled();
  });
});
