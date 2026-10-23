import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CenterMonthlyTimesheetManagement } from "@/features/timekeeping/components/center-monthly-timesheet-management";
import type {
  TimekeepingCenterMonthlyOverviewEntry,
  TimekeepingMonthlyEntry,
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

const adjustedEntry: TimekeepingMonthlyEntry = {
  adjustedCheckInAt: "2026-09-07T01:30:00.000Z",
  adjustedCheckOutAt: "2026-09-07T05:30:00.000Z",
  adjustmentStatus: "approved",
  autoEndedAt: null,
  checkInAt: "2026-09-07T01:00:00.000Z",
  checkInMode: "offline",
  checkOutAt: "2026-09-07T05:00:00.000Z",
  checkOutMode: "offline",
  clockOutReason: "manual",
  hasCheckInGpsEvidence: false,
  hasCheckInWifiEvidence: false,
  hasCheckOutGpsEvidence: false,
  hasCheckOutWifiEvidence: false,
  id: "c1111111-1111-4111-8111-111111111111",
  isUnscheduled: false,
  status: "checked_out",
  totalMinutes: 240,
  workDate: "2026-09-07",
  workShiftCode: null,
  workShiftName: null,
};

const pendingEntry: TimekeepingMonthlyEntry = {
  ...adjustedEntry,
  adjustedCheckInAt: "2026-09-08T02:00:00.000Z",
  adjustedCheckOutAt: "2026-09-08T11:00:00.000Z",
  adjustmentStatus: "pending",
  checkInAt: "2026-09-08T01:00:00.000Z",
  checkOutAt: "2026-09-08T05:00:00.000Z",
  id: "c3333333-3333-4333-8333-333333333333",
  workDate: "2026-09-08",
};

const openEntry: TimekeepingMonthlyEntry = {
  ...adjustedEntry,
  adjustedCheckInAt: null,
  adjustedCheckOutAt: null,
  adjustmentStatus: "none",
  checkOutAt: null,
  checkOutMode: null,
  clockOutReason: null,
  id: "c2222222-2222-4222-8222-222222222222",
  status: "open",
  totalMinutes: null,
  workDate: "2026-09-08",
};

const dependencies = vi.hoisted(() => ({
  adminAdjustTimeEntryAction: vi.fn(),
  adminDeleteTimeEntryAction: vi.fn(),
  fetchCenterMonthlyOverviewAction: vi.fn(),
  fetchStaffMonthlyTimesheetAction: vi.fn(),
}));

vi.mock("@/features/timekeeping/timekeeping-admin-actions", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/timekeeping/timekeeping-admin-actions")
  >();
  return {
    ...actual,
    adminAdjustTimeEntryAction: dependencies.adminAdjustTimeEntryAction,
    adminDeleteTimeEntryAction: dependencies.adminDeleteTimeEntryAction,
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

  it("offers re-adjusting an adjusted entry and sends a changed mode", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction.mockResolvedValue({ entries: [adjustedEntry], ok: true });
    dependencies.fetchCenterMonthlyOverviewAction.mockResolvedValue({ ok: true, overview: mockOverview });
    dependencies.adminAdjustTimeEntryAction.mockResolvedValueOnce({ message: "ok", status: "success" });
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Chi tiết bảng công" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /^Sửa lại lượt chấm công/ }));

    expect(screen.getByText(/đã được điều chỉnh trước đó/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Hình thức"), { target: { value: "online" } });
    fireEvent.change(screen.getByLabelText("Lý do điều chỉnh (bắt buộc)"), { target: { value: "Dạy trực tuyến" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu điều chỉnh" }));

    await waitFor(() => {
      expect(dependencies.adminAdjustTimeEntryAction).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "online", reason: "Dạy trực tuyến", timeEntryId: adjustedEntry.id }),
      );
    });
  });

  it("deletes a closed entry with a reason, refreshes the timesheet and hides delete for an open shift", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction
      .mockResolvedValueOnce({ entries: [adjustedEntry, openEntry], ok: true })
      .mockResolvedValue({ entries: [openEntry], ok: true });
    dependencies.fetchCenterMonthlyOverviewAction.mockResolvedValue({ ok: true, overview: mockOverview });
    dependencies.adminDeleteTimeEntryAction.mockResolvedValueOnce({ message: "Đã xóa lượt chấm công.", status: "success" });
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Chi tiết bảng công" })[0]);

    const deleteButtons = await screen.findAllByRole("button", { name: /^Xóa lượt chấm công / });
    expect(deleteButtons).toHaveLength(2);
    const openShiftDelete = deleteButtons.find((button) => (button as HTMLButtonElement).disabled);
    const closedShiftDelete = deleteButtons.find((button) => !(button as HTMLButtonElement).disabled);
    expect(openShiftDelete).toBeDefined();
    fireEvent.click(closedShiftDelete!);

    fireEvent.change(screen.getByLabelText("Lý do xóa (bắt buộc)"), { target: { value: "Chấm trùng ca" } });
    fireEvent.click(screen.getByRole("button", { name: "Xóa lượt chấm công" }));

    await waitFor(() => {
      expect(dependencies.adminDeleteTimeEntryAction).toHaveBeenCalledWith({
        reason: "Chấm trùng ca",
        timeEntryId: adjustedEntry.id,
      });
    });
    expect(await screen.findByText("Đã xóa lượt chấm công.")).toBeInTheDocument();
    await waitFor(() => {
      expect(dependencies.fetchStaffMonthlyTimesheetAction).toHaveBeenCalledTimes(2);
      expect(dependencies.fetchCenterMonthlyOverviewAction).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Xóa lượt chấm công / })).toHaveLength(1);
    });
    expect(screen.getByRole("button", { name: /^Xóa lượt chấm công / })).toBeDisabled();
  });

  it("offers delete only to accounts that can approve adjustments", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction.mockResolvedValue({ entries: [adjustedEntry], ok: true });
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments={false} canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Chi tiết bảng công" })[0]);

    expect(await screen.findByRole("button", { name: /^Sửa lại lượt chấm công/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Xóa lượt chấm công / })).not.toBeInTheDocument();
  });

  // Value: protects=the adjust dialog starts from what the entry currently says (an approved adjustment, never a pending
  // request's proposal), warns that saving closes a pending request, and leaves the mode to the server when it is untouched;
  // fails_when=prefill reads adjusted* regardless of status again, the pending notice disappears, or an untouched select sends a mode;
  // why_new=earlier fixtures had adjusted == recorded times and never read the inputs; seam=none; no_claim=jsdom datetime-local, action mocked
  it("prefills from an approved adjustment only and sends no mode when it is untouched", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction.mockResolvedValue({ entries: [adjustedEntry, pendingEntry], ok: true });
    dependencies.fetchCenterMonthlyOverviewAction.mockResolvedValue({ ok: true, overview: mockOverview });
    dependencies.adminAdjustTimeEntryAction.mockResolvedValue({ message: "ok", status: "success" });
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Chi tiết bảng công" })[0]);

    expect(await screen.findByText("Chờ duyệt điều chỉnh")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Sửa giờ lượt chấm công 08\/09\/2026/ }));
    expect(screen.getByLabelText("Giờ vào (Check-in)")).toHaveValue("2026-09-08T08:00");
    expect(screen.getByLabelText("Giờ ra (Check-out)")).toHaveValue("2026-09-08T12:00");
    expect(screen.getByText("Nhân sự đang có yêu cầu điều chỉnh chờ duyệt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    fireEvent.click(screen.getByRole("button", { name: /^Sửa lại lượt chấm công/ }));
    expect(screen.getByLabelText("Giờ vào (Check-in)")).toHaveValue("2026-09-07T08:30");
    expect(screen.getByLabelText("Giờ ra (Check-out)")).toHaveValue("2026-09-07T12:30");
    fireEvent.change(screen.getByLabelText("Lý do điều chỉnh (bắt buộc)"), { target: { value: "Sửa giờ ra" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu điều chỉnh" }));

    await waitFor(() => {
      expect(dependencies.adminAdjustTimeEntryAction).toHaveBeenCalledWith(
        expect.objectContaining({ mode: undefined, timeEntryId: adjustedEntry.id }),
      );
    });
  });

  // Value: protects=a blank reason never reaches the action, a refused delete keeps the dialog open with its message, and
  // Escape cannot dismiss a delete that is still running; fails_when=the client guard is removed, an error closes the dialog,
  // or close() stops checking the pending state; why_new=the delete test covered success only; seam=none;
  // no_claim=action mocked; jsdom does not prove the scrim or real focus behaviour
  it("keeps the delete dialog open on a blank reason, a refusal, and while the delete is running", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction.mockResolvedValue({ entries: [adjustedEntry], ok: true });
    let resolveDelete: (value: { message: string; status: "error" }) => void = () => {};
    dependencies.adminDeleteTimeEntryAction
      .mockResolvedValueOnce({ message: "Lượt chấm công thuộc kỳ lương đã khoá.", status: "error" })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveDelete = resolve; }));
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Chi tiết bảng công" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /^Xóa lượt chấm công / }));

    fireEvent.change(screen.getByLabelText(/^Lý do xóa \(bắt buộc\)/), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("button", { name: "Xóa lượt chấm công" }).closest("form")!);
    expect(await screen.findByText("Vui lòng nhập lý do xóa.")).toBeInTheDocument();
    expect(dependencies.adminDeleteTimeEntryAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Lý do xóa \(bắt buộc\)/), { target: { value: "Chấm trùng ca" } });
    fireEvent.click(screen.getByRole("button", { name: "Xóa lượt chấm công" }));
    expect(await screen.findByText("Lượt chấm công thuộc kỳ lương đã khoá.")).toBeInTheDocument();
    expect(screen.getByText("Không thể xóa")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Lý do xóa \(bắt buộc\)/)).toHaveValue("Chấm trùng ca");

    fireEvent.click(screen.getByRole("button", { name: "Xóa lượt chấm công" }));
    const deleteDialog = screen.getByRole("dialog", { name: "Xóa lượt chấm công" });
    await waitFor(() => expect(dependencies.adminDeleteTimeEntryAction).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(deleteDialog, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Xóa lượt chấm công" })).toBeInTheDocument();
    resolveDelete({ message: "Thử lại sau.", status: "error" });
    expect(await screen.findByText("Thử lại sau.")).toBeInTheDocument();
  });

  it("explains why an open shift cannot be deleted", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction.mockResolvedValue({ entries: [openEntry], ok: true });
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Chi tiết bảng công" })[0]);

    expect(await screen.findByText("Sửa giờ ra trước khi xóa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Xóa lượt chấm công / })).toBeDisabled();
  });

  it("shows a rejected detail request inside the dialog instead of crashing", async () => {
    dependencies.fetchStaffMonthlyTimesheetAction.mockRejectedValueOnce(new Error("transport failed"));
    render(<CenterMonthlyTimesheetManagement canApproveAdjustments canManage initialMonth={9} initialOverview={mockOverview} initialYear={2026} staffOptions={mockStaffOptions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Chi tiết bảng công" })[0]);
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("Không thể tải bảng công");
  });

});
