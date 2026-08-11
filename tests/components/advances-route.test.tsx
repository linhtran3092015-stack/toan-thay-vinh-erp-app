import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdvancesRoute from "@/app/(app)/advances/page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getSalaryAdvancesDashboardResult: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/advances/data", () => ({
  getSalaryAdvancesDashboardResult: dependencies.getSalaryAdvancesDashboardResult,
}));
vi.mock("@/features/advances/advance-list-page", () => ({
  AdvanceListPage: ({
    canApprove,
    canRequest,
    canReview,
    entries,
  }: {
    canApprove: boolean;
    canRequest: boolean;
    canReview: boolean;
    entries: readonly { id: string }[];
  }) => (
    <div>
      <p>canApprove:{String(canApprove)}</p>
      <p>canRequest:{String(canRequest)}</p>
      <p>canReview:{String(canReview)}</p>
      <p>entries:{entries.length}</p>
    </div>
  ),
}));

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
});
