import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CenterMonthlyTimesheetManagement } from "@/features/timekeeping/components/center-monthly-timesheet-management";
import type {
  TimekeepingCenterMonthlyOverviewEntry,
  TimekeepingStaffOption,
} from "@/features/timekeeping/types";

const mockOverview: TimekeepingCenterMonthlyOverviewEntry[] = [
  {
    autoEndedCount: 1,
    pendingAdjustmentCount: 1,
    primaryRoleName: "Giáo viên",
    staffDisplayName: "Nguyễn Văn A",
    staffEmployeeCode: "GV-001",
    staffId: "staff-1",
    totalEntries: 20,
    totalHours: 80.5,
    totalWorkDays: 18,
  },
  {
    autoEndedCount: 0,
    pendingAdjustmentCount: 0,
    primaryRoleName: "Trợ giảng",
    staffDisplayName: "Trần Thị B",
    staffEmployeeCode: "TG-002",
    staffId: "staff-2",
    totalEntries: 15,
    totalHours: 45.0,
    totalWorkDays: 15,
  },
];

const mockStaffOptions: TimekeepingStaffOption[] = [
  { displayName: "Nguyễn Văn A", employeeCode: "GV-001", id: "staff-1" },
  { displayName: "Trần Thị B", employeeCode: "TG-002", id: "staff-2" },
];

const dependencies = vi.hoisted(() => ({
  fetchCenterMonthlyOverviewAction: vi.fn(),
  fetchStaffMonthlyTimesheetAction: vi.fn(),
}));

vi.mock("@/features/timekeeping/timekeeping-admin-actions", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/timekeeping/timekeeping-admin-actions")
  >();
  return {
    ...actual,
    fetchCenterMonthlyOverviewAction: dependencies.fetchCenterMonthlyOverviewAction,
    fetchStaffMonthlyTimesheetAction: dependencies.fetchStaffMonthlyTimesheetAction,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CenterMonthlyTimesheetManagement", () => {
  it("renders center overview and KPI summary metrics", () => {
    render(
      <CenterMonthlyTimesheetManagement
        canApproveAdjustments={true}
        canManage={true}
        initialMonth={9}
        initialOverview={mockOverview}
        initialYear={2026}
        staffOptions={mockStaffOptions}
      />,
    );

    expect(
      screen.getByText("Bảng công toàn trung tâm theo tháng"),
    ).toBeInTheDocument();

    // KPI 1: Nhân sự có công: 2
    expect(screen.getByText("Nhân sự có công")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // KPI 2: Tổng giờ: 80.5 + 45.0 = 125.5
    expect(screen.getByText("125.5")).toBeInTheDocument();

    // Table rows
    expect(screen.getAllByText("Nguyễn Văn A")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Trần Thị B")[0]).toBeInTheDocument();
    expect(screen.getByText("80.5")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();

    // Badges
    expect(screen.getByText("1 ca tự ngắt")).toBeInTheDocument();
    expect(screen.getByText("1 chờ duyệt")).toBeInTheDocument();
    expect(screen.getByText("Bình thường")).toBeInTheDocument();
  });

  it("filters staff list by search query", () => {
    render(
      <CenterMonthlyTimesheetManagement
        canApproveAdjustments={true}
        canManage={true}
        initialMonth={9}
        initialOverview={mockOverview}
        initialYear={2026}
        staffOptions={mockStaffOptions}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      "Tìm nhân sự theo họ tên, mã nhân viên, vai trò...",
    );
    fireEvent.change(searchInput, { target: { value: "Nguyễn" } });

    expect(screen.getAllByText("Nguyễn Văn A")[0]).toBeInTheDocument();
    expect(screen.queryByText("Trần Thị B")).not.toBeInTheDocument();
  });

  it("opens staff detail dialog on click", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction.mockResolvedValueOnce({
      entries: [],
      ok: true,
    });

    render(
      <CenterMonthlyTimesheetManagement
        canApproveAdjustments={true}
        canManage={true}
        initialMonth={9}
        initialOverview={mockOverview}
        initialYear={2026}
        staffOptions={mockStaffOptions}
      />,
    );

    const detailButtons = screen.getAllByRole("button", {
      name: /Chi tiết bảng công/i,
    });
    fireEvent.click(detailButtons[0]);

    await waitFor(() => {
      expect(
        dependencies.fetchStaffMonthlyTimesheetAction,
      ).toHaveBeenCalledWith("staff-1", 9, 2026);
    });

    expect(
      screen.getByText(/Chi tiết chấm công: Nguyễn Văn A/i),
    ).toBeInTheDocument();
  });
  it("opens manual entry without an initial error banner", () => {
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getByRole("button", { name: "Bổ sung công bù" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Không thể thêm công")).not.toBeInTheDocument();
  });

  it("shows a rejected detail request inside the dialog instead of crashing", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction.mockRejectedValueOnce(new Error("transport failed"));
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Chi tiết bảng công" })[0]);
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("Không thể tải bảng công");
  });

});
