import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdvancesRoute from "@/app/(app)/advances/page";

const dependencies = vi.hoisted(() => ({
  getCachedCurrentAuthUser: vi.fn(),
  getCachedDatabasePermissions: vi.fn(),
  getSalaryAdvancesDashboardResult: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/advances/data", () => ({
  getSalaryAdvancesDashboardResult: dependencies.getSalaryAdvancesDashboardResult,
}));
// Step 14b: the route reads the cached viewer id so the list can set the viewer's own rows apart.
vi.mock("@/features/auth/current-user", () => ({
  getCachedCurrentAuthUser: dependencies.getCachedCurrentAuthUser,
}));
vi.mock("@/features/advances/advance-list-page", () => ({
  AdvanceListPage: ({
    canApprove,
    canRequest,
    canReview,
    canViewPayroll,
    entries,
    today,
    viewerId,
  }: {
    canApprove: boolean;
    canRequest: boolean;
    canReview: boolean;
    canViewPayroll?: boolean;
    entries: readonly { id: string }[];
    today?: string;
    viewerId?: string | null;
  }) => (
    <div>
      <p>canApprove:{String(canApprove)}</p>
      <p>canRequest:{String(canRequest)}</p>
      <p>canReview:{String(canReview)}</p>
      <p>canViewPayroll:{String(canViewPayroll)}</p>
      <p>entries:{entries.length}</p>
      <p>today:{today}</p>
      <p>viewerId:{String(viewerId)}</p>
    </div>
  ),
}));

beforeEach(() => {
  dependencies.getCachedCurrentAuthUser.mockResolvedValue({
    ok: true,
    user: { displayName: "Lê Thu Hằng", email: "hang@example.com", id: "viewer-1", initials: "LH" },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Advances route authority", () => {
  it("loads the authoritative reader for advances.view and passes independent presentation flags", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["advances.view", "advances.request", "advances.review"],
    });
    dependencies.getSalaryAdvancesDashboardResult.mockResolvedValueOnce({
      data: [{ id: "advance-1" }],
      ok: true,
    });

    render(await AdvancesRoute());

    expect(screen.getByText("canRequest:true")).toBeInTheDocument();
    expect(screen.getByText("canReview:true")).toBeInTheDocument();
    expect(screen.getByText("canApprove:false")).toBeInTheDocument();
    expect(screen.getByText("entries:1")).toBeInTheDocument();
    expect(dependencies.getSalaryAdvancesDashboardResult).toHaveBeenCalledOnce();
  });

  it("does not load the reader without advances.view", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["advances.request", "advances.review", "advances.owner_approve"],
    });

    render(await AdvancesRoute());

    expect(screen.getByText("Không có quyền xem tạm ứng")).toBeInTheDocument();
    expect(dependencies.getSalaryAdvancesDashboardResult).not.toHaveBeenCalled();
    expect(dependencies.getCachedCurrentAuthUser).not.toHaveBeenCalled();
  });

  it("keeps owner approval independent from request and review permissions", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["advances.view", "advances.owner_approve"],
    });
    dependencies.getSalaryAdvancesDashboardResult.mockResolvedValueOnce({
      data: [{ id: "advance-2" }],
      ok: true,
    });

    render(await AdvancesRoute());

    expect(screen.getByText("canRequest:false")).toBeInTheDocument();
    expect(screen.getByText("canReview:false")).toBeInTheDocument();
    expect(screen.getByText("canApprove:true")).toBeInTheDocument();
    expect(dependencies.getSalaryAdvancesDashboardResult).toHaveBeenCalledOnce();
  });

  it("passes the viewer id, the Vietnam business date and payroll.view to the list", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 00:30 on 1 Oct in Vietnam while the UTC date is still 30 Sep.
    vi.setSystemTime(new Date("2026-09-30T17:30:00.000Z"));
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["advances.view", "advances.review", "payroll.view"],
    });
    dependencies.getSalaryAdvancesDashboardResult.mockResolvedValueOnce({
      data: [{ id: "advance-3" }],
      ok: true,
    });

    try {
      render(await AdvancesRoute());
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByText("viewerId:viewer-1")).toBeInTheDocument();
    expect(screen.getByText("today:2026-10-01")).toBeInTheDocument();
    expect(screen.getByText("canViewPayroll:true")).toBeInTheDocument();
    expect(dependencies.getCachedCurrentAuthUser).toHaveBeenCalledOnce();
  });

  it("still renders the list without a viewer id when the session cannot be read", async () => {
    dependencies.getCachedCurrentAuthUser.mockResolvedValueOnce({ error: "session_expired", ok: false });
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["advances.view", "advances.request"],
    });
    dependencies.getSalaryAdvancesDashboardResult.mockResolvedValueOnce({ data: [], ok: true });

    render(await AdvancesRoute());

    expect(screen.getByText("viewerId:null")).toBeInTheDocument();
    expect(screen.getByText("canViewPayroll:false")).toBeInTheDocument();
    expect(screen.getByText("entries:0")).toBeInTheDocument();
  });
});
