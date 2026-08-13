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
  FinanceOrdersPage: ({ canReview, filters }: { canReview: boolean; filters: { month: string; orderType: string; period: string; source: string } }) => (
    <div>review:{String(canReview)} · {filters.month}/{filters.orderType}/{filters.source}/{filters.period}</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
