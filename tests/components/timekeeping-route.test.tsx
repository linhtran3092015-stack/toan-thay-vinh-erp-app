import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TimekeepingRoute from "@/app/(app)/timekeeping/page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getMyTimeEntryAdjustmentRequests: vi.fn(),
  getMyTimekeepingAdjustableEntries: vi.fn(),
  getMyTimekeepingEntries: vi.fn(),
  getTimeEntryAdjustmentApprovalQueue: vi.fn(),
  getTimekeepingDayEntries: vi.fn(),
  getTimekeepingSchedule: vi.fn(),
  getTimekeepingStaffOptions: vi.fn(),
  getTimekeepingWorkShifts: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/timekeeping/data", () => dependencies);
vi.mock("@/features/timekeeping/timekeeping-page", () => ({
  TimekeepingPage: ({ canCheck, dayEntries, myEntries }: { canCheck: boolean; dayEntries: readonly { id: string }[]; myEntries: readonly { id: string }[] }) => (
    <div>
      <p>canCheck:{String(canCheck)}</p>
      <p>dayEntries:{dayEntries.length}</p>
      <p>myEntries:{myEntries.length}</p>
    </div>
  ),
}));

function setSharedReadResults() {
  dependencies.getTimekeepingSchedule.mockResolvedValue({ entries: [], ok: true });
  dependencies.getTimekeepingWorkShifts.mockResolvedValue({ ok: true, workShifts: [] });
  dependencies.getTimekeepingDayEntries.mockResolvedValue({ entries: [{ id: "day-entry" }], ok: true });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Timekeeping route authority", () => {
  it("keeps timekeeping.view-only users on the current-day audit without loading personal timekeeping data", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: ["timekeeping.view"] });

    render(await TimekeepingRoute());

    expect(screen.getByText("canCheck:false")).toBeInTheDocument();
    expect(screen.getByText("dayEntries:1")).toBeInTheDocument();
    expect(screen.getByText("myEntries:0")).toBeInTheDocument();
    expect(dependencies.getTimekeepingDayEntries).toHaveBeenCalledOnce();
    expect(dependencies.getMyTimekeepingEntries).not.toHaveBeenCalled();
  });

  it("retains timekeeping.check as the route composition that loads personal entries for check-in/out presentation", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["timekeeping.view", "timekeeping.check"],
    });
    dependencies.getMyTimekeepingEntries.mockResolvedValueOnce({ entries: [{ id: "my-entry" }], ok: true });
    dependencies.getMyTimekeepingAdjustableEntries.mockResolvedValueOnce({ entries: [], ok: true });
    dependencies.getMyTimeEntryAdjustmentRequests.mockResolvedValueOnce({ ok: true, requests: [] });

    render(await TimekeepingRoute());

    expect(screen.getByText("canCheck:true")).toBeInTheDocument();
    expect(screen.getByText("myEntries:1")).toBeInTheDocument();
    expect(dependencies.getMyTimekeepingEntries).toHaveBeenCalledOnce();
  });
});
