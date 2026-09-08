import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyMonthlyTimesheetPanel } from "@/features/timekeeping/components/my-monthly-timesheet-panel";
import { fetchMyMonthlyTimesheetAction } from "@/features/timekeeping/timekeeping-admin-actions";
import type { TimekeepingMonthlyEntry } from "@/features/timekeeping/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/timekeeping/timekeeping-admin-actions", () => ({
  fetchMyMonthlyTimesheetAction: vi.fn(),
}));

const mockEntries: TimekeepingMonthlyEntry[] = [
  {
    adjustedCheckInAt: null,
    adjustedCheckOutAt: null,
    adjustmentStatus: "none",
    autoEndedAt: null,
    checkInAt: "2026-09-01T08:00:00+07:00",
    checkInMode: "offline",
    checkOutAt: "2026-09-01T17:00:00+07:00",
    checkOutMode: "offline",
    clockOutReason: "manual",
    hasCheckInGpsEvidence: true,
    hasCheckInWifiEvidence: true,
    hasCheckOutGpsEvidence: true,
    hasCheckOutWifiEvidence: true,
    id: "entry-1",
    isUnscheduled: false,
    status: "checked_out",
    totalMinutes: 540,
    workDate: "2026-09-01",
    workShiftCode: "CA-SANG",
    workShiftName: "Ca Sáng Chuẩn",
  },
  {
    adjustedCheckInAt: null,
    adjustedCheckOutAt: null,
    adjustmentStatus: "none",
    autoEndedAt: "2026-09-02T15:30:00+07:00",
    checkInAt: "2026-09-02T08:00:00+07:00",
    checkInMode: "offline",
    checkOutAt: "2026-09-02T15:30:00+07:00",
    checkOutMode: "auto_end",
    clockOutReason: "left_geofence",
    hasCheckInGpsEvidence: true,
    hasCheckInWifiEvidence: false,
    hasCheckOutGpsEvidence: false,
    hasCheckOutWifiEvidence: false,
    id: "entry-2",
    isUnscheduled: false,
    status: "auto_ended",
    totalMinutes: 450,
    workDate: "2026-09-02",
    workShiftCode: "CA-SANG",
    workShiftName: "Ca Sáng Chuẩn",
  },
  {
    adjustedCheckInAt: "2026-09-03T08:00:00+07:00",
    adjustedCheckOutAt: "2026-09-03T17:00:00+07:00",
    adjustmentStatus: "approved",
    autoEndedAt: null,
    checkInAt: "2026-09-03T08:30:00+07:00",
    checkInMode: "online",
    checkOutAt: "2026-09-03T16:30:00+07:00",
    checkOutMode: "online",
    clockOutReason: "manual",
    hasCheckInGpsEvidence: false,
    hasCheckInWifiEvidence: false,
    hasCheckOutGpsEvidence: false,
    hasCheckOutWifiEvidence: false,
    id: "entry-3",
    isUnscheduled: true,
    status: "checked_out",
    totalMinutes: 540,
    workDate: "2026-09-03",
    workShiftCode: null,
    workShiftName: null,
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MyMonthlyTimesheetPanel", () => {
  it("renders panel header and KPI summary cards correctly", () => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck={true}
        initialEntries={mockEntries}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    expect(screen.getByText("Bảng công cá nhân theo tháng")).toBeInTheDocument();

    // KPI 1: Distinct work days: 3
    expect(screen.getByText("Số ngày đi làm")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // KPI 2: Total hours: (540 + 450 + 540) = 1530 mins = 25.5 hours
    expect(screen.getByText("Tổng giờ làm việc")).toBeInTheDocument();
    expect(screen.getByText("25.5")).toBeInTheDocument();

    // KPI 3: Auto-ended count: 1 & KPI 4: Adjusted count: 1
    expect(screen.getByText("Ca tự động ngắt")).toBeInTheDocument();
    expect(screen.getByText("Ca đã điều chỉnh")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("displays auto-ended status with geofence exit reason", () => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck={true}
        initialEntries={mockEntries}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    expect(screen.getByText("Rời khỏi trung tâm")).toBeInTheDocument();
  });

  it("displays approved adjustment indicator", () => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck={true}
        initialEntries={mockEntries}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    expect(screen.getByText("Đã duyệt sửa giờ")).toBeInTheDocument();
  });
});

 it("keeps the page usable when a monthly server action rejects and permits retry", async () => {
   vi.mocked(fetchMyMonthlyTimesheetAction).mockRejectedValueOnce(new Error("network"));
   render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);
   fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });
   expect(await screen.findByText("Không thể tải bảng công. Vui lòng chọn lại tháng để thử lại.")).toBeInTheDocument();
   expect(screen.queryByText("25.5")).not.toBeInTheDocument();
   vi.mocked(fetchMyMonthlyTimesheetAction).mockResolvedValueOnce({ ok: true, entries: mockEntries });
   fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "9" } });
   expect(await screen.findByText("25.5")).toBeInTheDocument();
 });
