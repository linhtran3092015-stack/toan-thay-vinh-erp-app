import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TimekeepingRoute from "@/app/(app)/timekeeping/page";

const dependencies = vi.hoisted(() => ({
  getAttendanceVerificationConfig: vi.fn(),
  getAttendanceVerificationPolicy: vi.fn(),
  getCachedDatabasePermissions: vi.fn(),
  getCenterMonthlyTimekeepingOverview: vi.fn(),
  getMyMonthlyTimekeepingEntries: vi.fn(),
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
  TimekeepingPage: ({
    canApproveAdjustments,
    canCheck,
    canManage,
    canManageVerification,
    dayEntries,
    myEntries,
  }: {
    canApproveAdjustments: boolean;
    canCheck: boolean;
    canManage: boolean;
    canManageVerification: boolean;
    dayEntries: readonly { id: string }[];
    myEntries: readonly { id: string }[];
  }) => (
    <div>
      <p>canCheck:{String(canCheck)}</p>
      <p>canApproveAdjustments:{String(canApproveAdjustments)}</p>
      <p>canManage:{String(canManage)}</p>
      <p>canManageVerification:{String(canManageVerification)}</p>
      <p>dayEntries:{dayEntries.length}</p>
      <p>myEntries:{myEntries.length}</p>
    </div>
  ),
}));

function setSharedReadResults() {
  dependencies.getAttendanceVerificationPolicy.mockResolvedValue({
    ok: true,
    policy: {
      attendanceRadiusM: 100,
      centerName: "Trung tâm",
      configured: true,
      continuousGpsTrackingRequired: false,
      gpsMaxAccuracyM: 100,
      gpsRequiredForOffline: true,
      wifiRequiredForOffline: false,
    },
  });
  dependencies.getTimekeepingSchedule.mockResolvedValue({ entries: [], ok: true });
  dependencies.getTimekeepingWorkShifts.mockResolvedValue({ ok: true, workShifts: [] });
  dependencies.getTimekeepingDayEntries.mockResolvedValue({ entries: [{ id: "day-entry" }], ok: true });
  dependencies.getTimekeepingStaffOptions.mockResolvedValue({ ok: true, staffOptions: [] });
  dependencies.getMyMonthlyTimekeepingEntries.mockResolvedValue({ entries: [], ok: true });
  dependencies.getCenterMonthlyTimekeepingOverview.mockResolvedValue({ ok: true, overview: [] });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Timekeeping route authority", () => {
  it("loads only the normalized week selected in the URL", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({ ok: true, permissions: ["timekeeping.view"] });
    render(await TimekeepingRoute({ searchParams: Promise.resolve({ week: "2027-01-03" }) }));
    expect(dependencies.getTimekeepingSchedule).toHaveBeenCalledWith("2026-12-28");
  });

  it("keeps timekeeping.view-only users on current-day audit without loading adjustment readers or approval queue", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["timekeeping.view"],
    });

    render(await TimekeepingRoute({}));

    expect(screen.getByText("canCheck:false")).toBeInTheDocument();
    expect(screen.getByText("canManage:false")).toBeInTheDocument();
    expect(screen.getByText("canApproveAdjustments:false")).toBeInTheDocument();
    expect(screen.getByText("dayEntries:1")).toBeInTheDocument();
    expect(screen.getByText("myEntries:0")).toBeInTheDocument();

    expect(dependencies.getTimekeepingDayEntries).toHaveBeenCalledOnce();
    expect(dependencies.getMyTimekeepingEntries).not.toHaveBeenCalled();
    expect(dependencies.getMyTimekeepingAdjustableEntries).not.toHaveBeenCalled();
    expect(dependencies.getMyTimeEntryAdjustmentRequests).not.toHaveBeenCalled();
    expect(dependencies.getTimeEntryAdjustmentApprovalQueue).not.toHaveBeenCalled();
    expect(dependencies.getTimekeepingSchedule).toHaveBeenCalledOnce();
    expect(dependencies.getTimekeepingWorkShifts).toHaveBeenCalledOnce();
    expect(dependencies.getTimekeepingStaffOptions).not.toHaveBeenCalled();
  });

  it("retains timekeeping.check as the composition that loads personal entries and adjustment readers without loading approval queue", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["timekeeping.view", "timekeeping.check"],
    });
    dependencies.getMyTimekeepingEntries.mockResolvedValueOnce({ entries: [{ id: "my-entry" }], ok: true });
    dependencies.getMyTimekeepingAdjustableEntries.mockResolvedValueOnce({ entries: [], ok: true });
    dependencies.getMyTimeEntryAdjustmentRequests.mockResolvedValueOnce({ ok: true, requests: [] });

    render(await TimekeepingRoute({}));

    expect(screen.getByText("canCheck:true")).toBeInTheDocument();
    expect(screen.getByText("canApproveAdjustments:false")).toBeInTheDocument();
    expect(screen.getByText("myEntries:1")).toBeInTheDocument();

    expect(dependencies.getMyTimekeepingEntries).toHaveBeenCalledOnce();
    expect(dependencies.getMyTimekeepingAdjustableEntries).toHaveBeenCalledOnce();
    expect(dependencies.getMyTimeEntryAdjustmentRequests).toHaveBeenCalledOnce();
    expect(dependencies.getTimeEntryAdjustmentApprovalQueue).not.toHaveBeenCalled();
  });

  it("loads the adjustment approval queue when timekeeping.approve_adjustment permission is present", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["timekeeping.view", "timekeeping.approve_adjustment"],
    });
    dependencies.getTimeEntryAdjustmentApprovalQueue.mockResolvedValueOnce({ ok: true, requests: [] });

    render(await TimekeepingRoute({}));

    expect(screen.getByText("canCheck:false")).toBeInTheDocument();
    expect(screen.getByText("canApproveAdjustments:true")).toBeInTheDocument();

    expect(dependencies.getTimeEntryAdjustmentApprovalQueue).toHaveBeenCalledOnce();
    expect(dependencies.getMyTimekeepingAdjustableEntries).not.toHaveBeenCalled();
    expect(dependencies.getMyTimeEntryAdjustmentRequests).not.toHaveBeenCalled();
  });

  it("allows timekeeping.check-only users to access /timekeeping and load personal entries without loading broader staff attendance data", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["timekeeping.check"],
    });
    dependencies.getMyTimekeepingEntries.mockResolvedValueOnce({ entries: [{ id: "my-entry" }], ok: true });
    dependencies.getMyTimekeepingAdjustableEntries.mockResolvedValueOnce({ entries: [], ok: true });
    dependencies.getMyTimeEntryAdjustmentRequests.mockResolvedValueOnce({ ok: true, requests: [] });

    render(await TimekeepingRoute({}));

    expect(screen.getByText("canCheck:true")).toBeInTheDocument();
    expect(screen.getByText("myEntries:1")).toBeInTheDocument();
    expect(screen.getByText("dayEntries:0")).toBeInTheDocument();

    expect(dependencies.getMyTimekeepingEntries).toHaveBeenCalledOnce();
    expect(dependencies.getMyTimekeepingAdjustableEntries).toHaveBeenCalledOnce();
    expect(dependencies.getMyTimeEntryAdjustmentRequests).toHaveBeenCalledOnce();

    expect(dependencies.getTimekeepingDayEntries).not.toHaveBeenCalled();
    expect(dependencies.getTimekeepingSchedule).not.toHaveBeenCalled();
    expect(dependencies.getTimekeepingWorkShifts).not.toHaveBeenCalled();
    expect(dependencies.getTimekeepingStaffOptions).not.toHaveBeenCalled();
    expect(dependencies.getTimeEntryAdjustmentApprovalQueue).not.toHaveBeenCalled();
  });

  it("denies access to /timekeeping when user has neither timekeeping.check nor timekeeping.view permission", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [],
    });

    render(await TimekeepingRoute({}));

    expect(screen.getByText("Không có quyền truy cập chấm công")).toBeInTheDocument();
    expect(dependencies.getMyTimekeepingEntries).not.toHaveBeenCalled();
    expect(dependencies.getTimekeepingDayEntries).not.toHaveBeenCalled();
  });

  it("loads management options only when staff.manage is present", async () => {
    setSharedReadResults();
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["timekeeping.view", "staff.manage"],
    });

    render(await TimekeepingRoute({}));

    expect(screen.getByText("canManage:true")).toBeInTheDocument();
    expect(dependencies.getTimekeepingSchedule).toHaveBeenCalledOnce();
    expect(dependencies.getTimekeepingWorkShifts).toHaveBeenCalledOnce();
    expect(dependencies.getTimekeepingStaffOptions).toHaveBeenCalledOnce();
  });

  it("loads owner verification configuration only with the dedicated permission", async () => {
    setSharedReadResults();
    dependencies.getAttendanceVerificationConfig.mockResolvedValueOnce({
      config: {
        attendanceRadiusM: 100,
        centerLatitude: 10.77,
        centerLongitude: 106.69,
        centerName: "Trung tâm",
        configured: true,
        continuousGpsTrackingRequired: false,
        gpsMaxAccuracyM: 80,
        gpsRequiredForOffline: true,
        updatedAt: null,
        wifiNetworks: [],
        wifiRequiredForOffline: false,
      },
      ok: true,
    });
    dependencies.getCachedDatabasePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: ["timekeeping.manage_verification"],
    });

    render(await TimekeepingRoute({}));

    expect(screen.getByText("canManageVerification:true")).toBeInTheDocument();
    expect(dependencies.getAttendanceVerificationConfig).toHaveBeenCalledOnce();
    expect(dependencies.getAttendanceVerificationPolicy).toHaveBeenCalledOnce();
    expect(dependencies.getMyTimekeepingEntries).not.toHaveBeenCalled();
  });
});
