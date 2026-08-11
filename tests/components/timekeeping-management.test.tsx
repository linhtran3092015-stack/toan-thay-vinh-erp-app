import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffShiftAssignmentDialog } from "@/features/timekeeping/components/staff-shift-assignment-dialog";
import { StaffShiftEndAction } from "@/features/timekeeping/components/staff-shift-end-action";
import { StaffShiftReplaceAction } from "@/features/timekeeping/components/staff-shift-replace-action";
import { WorkShiftDialog } from "@/features/timekeeping/components/work-shift-dialog";
import { WorkShiftRetireAction } from "@/features/timekeeping/components/work-shift-retire-action";
import { TimekeepingPage } from "@/features/timekeeping/timekeeping-page";
import type { TimekeepingScheduleEntry, TimekeepingStaffOption, TimekeepingWorkShift } from "@/features/timekeeping/types";

const actions = vi.hoisted(() => ({
  createStaffShiftAssignmentAction: vi.fn(), createWorkShiftAction: vi.fn(), endStaffShiftAssignmentAction: vi.fn(), replaceStaffShiftAssignmentAction: vi.fn(), retireWorkShiftAction: vi.fn(), updateWorkShiftAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/timekeeping/timekeeping-actions", () => actions);
vi.mock("@/features/timekeeping/timekeeping-client-utils", () => ({
  getVietnamBusinessDate: () => "2026-08-11",
  WEEKDAY_OPTIONS: [
    { label: "Thứ Hai", value: 1 }, { label: "Thứ Ba", value: 2 }, { label: "Thứ Tư", value: 3 }, { label: "Thứ Năm", value: 4 }, { label: "Thứ Sáu", value: 5 }, { label: "Thứ Bảy", value: 6 }, { label: "Chủ nhật", value: 7 },
  ],
}));
vi.mock("@/features/timekeeping/components/my-timekeeping-panel", () => ({ MyTimekeepingPanel: () => null }));
vi.mock("@/features/timekeeping/components/timekeeping-adjustment-requests", () => ({ TimekeepingAdjustmentRequests: () => null }));
vi.mock("@/features/timekeeping/components/timekeeping-adjustment-approval-queue", () => ({ TimekeepingAdjustmentApprovalQueue: () => null }));
vi.mock("@/features/timekeeping/components/timekeeping-day-entries", () => ({ TimekeepingDayEntries: () => null }));

const shift: TimekeepingWorkShift = { breakMinutes: 30, code: "MORNING", crossesMidnight: false, endTime: "12:00:00", id: "11111111-1111-4111-8111-111111111111", isActive: true, name: "Ca sáng", notes: "Ca chuẩn", startTime: "08:00:00" };
const retiredShift: TimekeepingWorkShift = { ...shift, code: "OLD", id: "22222222-2222-4222-8222-222222222222", isActive: false, name: "Ca cũ" };
const staff: TimekeepingStaffOption = { displayName: "Nguyễn Minh An", employeeCode: "NS-001", id: "33333333-3333-4333-833333333333" };
const entry: TimekeepingScheduleEntry = { assignmentId: "44444444-4444-4444-8444-444444444444", breakMinutes: 30, crossesMidnight: false, effectiveFrom: "2099-01-01", effectiveTo: null, endTime: "12:00:00", staffDisplayName: "Nguyễn Minh An", staffEmployeeCode: "NS-001", staffEmploymentStatus: "active", staffId: staff.id, startTime: "08:00:00", weekday: 1, workShiftCode: "MORNING", workShiftId: shift.id, workShiftName: "Ca sáng" };
const success = { message: "Đã lưu.", status: "success" as const };

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((next) => { resolve = next; }); return { promise, resolve }; }
function open(name: string) { fireEvent.click(screen.getByRole("button", { name })); return screen.getByRole("dialog"); }

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

describe("Timekeeping 3 management", () => {
  it("keeps the active assignment directory and full shift catalogue reader-owned, with management controls gated", () => {
    const { rerender } = render(<TimekeepingPage adjustmentApprovalQueue={[]} adjustmentEntries={[]} canApproveAdjustments={false} canCheck={false} canManage={false} dayEntries={[]} entries={[entry]} myAdjustmentRequests={[]} myEntries={[]} staffOptions={[staff]} workShifts={[shift, retiredShift]} />);
    expect(screen.getByRole("table", { name: "Lịch phân công ca đang hoạt động" })).toHaveTextContent("Nguyễn Minh An");
    expect(screen.getByRole("table", { name: "Danh mục ca làm" })).toHaveTextContent("Ca cũ");
    expect(screen.getAllByText("Đã ngừng dùng")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /thêm ca làm|phân công lịch|thay ca|kết thúc lịch|sửa ca|ngừng dùng/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/lịch sử phân công|toàn bộ phân công/i)).not.toBeInTheDocument();
    rerender(<TimekeepingPage adjustmentApprovalQueue={[]} adjustmentEntries={[]} canApproveAdjustments={false} canCheck={false} canManage dayEntries={[]} entries={[entry]} myAdjustmentRequests={[]} myEntries={[]} staffOptions={[staff]} workShifts={[shift, retiredShift]} />);
    expect(screen.getAllByRole("button", { name: "Thay ca" })).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Kết thúc lịch" })).not.toHaveLength(0);
  });

  it("preserves exact create and update shift payloads", async () => {
    actions.createWorkShiftAction.mockResolvedValueOnce(success);
    render(<WorkShiftDialog />);
    open("Thêm ca làm");
    fireEvent.change(screen.getByLabelText("Mã ca"), { target: { value: "evening" } }); fireEvent.change(screen.getByLabelText("Tên ca"), { target: { value: "Ca tối" } }); fireEvent.change(screen.getByLabelText("Giờ bắt đầu"), { target: { value: "18:00" } }); fireEvent.change(screen.getByLabelText("Giờ kết thúc"), { target: { value: "22:00" } }); fireEvent.change(screen.getByLabelText("Nghỉ giữa ca (phút)"), { target: { value: "15" } }); fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Ca thử" } }); fireEvent.change(screen.getByLabelText("Lý do thao tác"), { target: { value: "Bổ sung ca" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo ca làm" }));
    await waitFor(() => expect(actions.createWorkShiftAction).toHaveBeenCalledWith({ breakMinutes: 15, code: "EVENING", crossesMidnight: false, endTime: "22:00", name: "Ca tối", notes: "Ca thử", reason: "Bổ sung ca", startTime: "18:00" }));
    cleanup(); actions.updateWorkShiftAction.mockResolvedValueOnce(success); render(<WorkShiftDialog workShift={shift} />); open("Sửa ca"); fireEvent.change(screen.getByLabelText("Lý do thao tác"), { target: { value: "Sửa tên" } }); fireEvent.click(screen.getByRole("button", { name: "Lưu ca làm" }));
    await waitFor(() => expect(actions.updateWorkShiftAction).toHaveBeenCalledWith({ breakMinutes: 30, code: "MORNING", crossesMidnight: false, endTime: "12:00", name: "Ca sáng", notes: "Ca chuẩn", reason: "Sửa tên", startTime: "08:00", workShiftId: shift.id }));
  });

  it("preserves exact retire, assign, replace, and end payloads", async () => {
    actions.retireWorkShiftAction.mockResolvedValueOnce(success); render(<WorkShiftRetireAction workShift={shift} />); open("Ngừng dùng"); fireEvent.change(screen.getByLabelText("Lý do ngừng dùng"), { target: { value: "Ngừng ca" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận ngừng dùng" })); await waitFor(() => expect(actions.retireWorkShiftAction).toHaveBeenCalledWith({ reason: "Ngừng ca", workShiftId: shift.id }));
    cleanup(); actions.createStaffShiftAssignmentAction.mockResolvedValueOnce(success); render(<StaffShiftAssignmentDialog staffOptions={[staff]} workShifts={[shift, retiredShift]} />); open("Phân công lịch"); fireEvent.change(screen.getByLabelText("Thứ trong tuần"), { target: { value: "3" } }); fireEvent.change(screen.getByLabelText("Ca làm"), { target: { value: retiredShift.id } }); fireEvent.change(screen.getByLabelText("Lý do phân công"), { target: { value: "Bố trí lớp" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phân công" })); await waitFor(() => expect(actions.createStaffShiftAssignmentAction).toHaveBeenCalledWith({ effectiveFrom: "2026-08-11", reason: "Bố trí lớp", staffId: staff.id, weekday: 3, workShiftId: retiredShift.id }));
    cleanup(); actions.replaceStaffShiftAssignmentAction.mockResolvedValueOnce(success); render(<StaffShiftReplaceAction entry={entry} workShifts={[shift, retiredShift]} />); open("Thay ca"); fireEvent.change(screen.getByLabelText("Lý do thay ca"), { target: { value: "Đổi ca" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận thay ca" })); await waitFor(() => expect(actions.replaceStaffShiftAssignmentAction).toHaveBeenCalledWith({ effectiveFrom: "2026-08-11", reason: "Đổi ca", staffShiftAssignmentId: entry.assignmentId, workShiftId: retiredShift.id }));
    cleanup(); actions.endStaffShiftAssignmentAction.mockResolvedValueOnce(success); render(<StaffShiftEndAction entry={entry} />); open("Kết thúc lịch"); fireEvent.change(screen.getByLabelText("Ngày kết thúc hiệu lực"), { target: { value: "2026-08-10" } }); fireEvent.change(screen.getByLabelText("Lý do kết thúc"), { target: { value: "Dừng lịch" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận kết thúc" })); await waitFor(() => expect(actions.endStaffShiftAssignmentAction).toHaveBeenCalledWith({ effectiveTo: "2026-08-10", reason: "Dừng lịch", staffShiftAssignmentId: entry.assignmentId }));
  });

  it("associates the server-returned assignment effective date error with its field", async () => {
    const effectiveFromError = "Ngày hiệu lực phải theo ngày làm việc tại Việt Nam.";
    actions.createStaffShiftAssignmentAction.mockResolvedValueOnce({ fieldErrors: { effectiveFrom: [effectiveFromError] }, message: "Vui lòng kiểm tra lại lịch phân công.", status: "error" });

    render(<StaffShiftAssignmentDialog staffOptions={[staff]} workShifts={[shift]} />);
    open("Phân công lịch");
    fireEvent.change(screen.getByLabelText("Lý do phân công"), { target: { value: "Phân công mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận phân công" }));

    const error = await screen.findByText(effectiveFromError);
    const effectiveFrom = screen.getByLabelText("Ngày bắt đầu hiệu lực");
    expect(effectiveFrom).toHaveAttribute("aria-invalid", "true");
    expect(effectiveFrom).toHaveAttribute("aria-describedby", expect.stringContaining(error.id));
  });

  it("associates the server-returned replacement effective date error with its field", async () => {
    const effectiveFromError = "Lịch thay thế không hợp lệ cho ngày hiệu lực này.";
    actions.replaceStaffShiftAssignmentAction.mockResolvedValueOnce({ fieldErrors: { effectiveFrom: [effectiveFromError] }, message: "Vui lòng kiểm tra lại lịch thay thế.", status: "error" });

    render(<StaffShiftReplaceAction entry={entry} workShifts={[shift, retiredShift]} />);
    open("Thay ca");
    fireEvent.change(screen.getByLabelText("Lý do thay ca"), { target: { value: "Điều chỉnh lịch" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận thay ca" }));

    const error = await screen.findByText(effectiveFromError);
    const effectiveFrom = screen.getByLabelText("Ngày bắt đầu hiệu lực");
    expect(effectiveFrom).toHaveAttribute("aria-invalid", "true");
    expect(effectiveFrom).toHaveAttribute("aria-describedby", expect.stringContaining(error.id));
  });

  it("keeps replace and end available for server-returned active assignments without browser-date eligibility gates", () => {
    render(<><StaffShiftReplaceAction entry={entry} workShifts={[shift, retiredShift]} /><StaffShiftEndAction entry={entry} /></>);
    expect(screen.getByRole("button", { name: "Thay ca" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Kết thúc lịch" })).toBeEnabled();
    const replaceSource = readFileSync(resolve(process.cwd(), "src/features/timekeeping/components/staff-shift-replace-action.tsx"), "utf8"); const endSource = readFileSync(resolve(process.cwd(), "src/features/timekeeping/components/staff-shift-end-action.tsx"), "utf8");
    expect(replaceSource).not.toMatch(/canReplaceToday|canReplace/); expect(endSource).not.toMatch(/canEndToday|canEnd/);
  });

  it("blocks unsafe dismissal and duplicate submit while unresolved, then permits dismissal after an error and clears it on retry", async () => {
    const first = deferred<{ message: string; status: "error" }>(); const second = deferred<{ message: string; status: "success" }>(); actions.createWorkShiftAction.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<WorkShiftDialog />); const trigger = screen.getByRole("button", { name: "Thêm ca làm" }); trigger.focus(); const dialog = open("Thêm ca làm"); fireEvent.change(screen.getByLabelText("Mã ca"), { target: { value: "LATE" } }); fireEvent.change(screen.getByLabelText("Tên ca"), { target: { value: "Ca muộn" } }); fireEvent.change(screen.getByLabelText("Lý do thao tác"), { target: { value: "Thử khóa" } }); const submit = within(dialog).getByRole("button", { name: "Tạo ca làm" }); fireEvent.click(submit); await waitFor(() => expect(actions.createWorkShiftAction).toHaveBeenCalledOnce()); fireEvent.keyDown(dialog, { key: "Escape" }); fireEvent.mouseDown(dialog.parentElement!); fireEvent.click(screen.getByRole("button", { name: "Hủy" })); fireEvent.click(submit); expect(screen.getByRole("dialog")).toBeInTheDocument(); expect(actions.createWorkShiftAction).toHaveBeenCalledOnce();
    first.resolve({ message: "Máy chủ từ chối.", status: "error" }); await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Máy chủ từ chối.")); fireEvent.click(screen.getByRole("button", { name: "Tạo ca làm" })); await waitFor(() => expect(actions.createWorkShiftAction).toHaveBeenCalledTimes(2)); expect(screen.queryByRole("alert")).not.toBeInTheDocument(); fireEvent.keyDown(dialog, { key: "Escape" }); expect(screen.getByRole("dialog")).toBeInTheDocument(); second.resolve(success); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(router.refresh).toHaveBeenCalledOnce(); expect(trigger).toHaveFocus();
  });

  it("keeps both management surfaces container-responsive and excludes payroll vocabulary", () => {
    render(<TimekeepingPage adjustmentApprovalQueue={[]} adjustmentEntries={[]} canApproveAdjustments={false} canCheck={false} canManage={false} dayEntries={[]} entries={[entry]} myAdjustmentRequests={[]} myEntries={[]} staffOptions={[]} workShifts={[shift]} />);
    expect(screen.getByRole("table", { name: "Lịch phân công ca đang hoạt động" }).closest(".timekeeping-assignment-work-area")).not.toBeNull(); expect(screen.getByRole("list", { name: "Lịch phân công ca đang hoạt động" })).toBeInTheDocument(); expect(screen.getByRole("table", { name: "Danh mục ca làm" }).closest(".timekeeping-shift-catalogue-work-area")).not.toBeNull(); expect(screen.getByRole("list", { name: "Danh mục ca làm" })).toBeInTheDocument();
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8"); expect(globals).toMatch(/@container \(min-width: 1042px\)[\s\S]*\.timekeeping-assignment-table/); expect(globals).toMatch(/@container \(min-width: 962px\)[\s\S]*\.timekeeping-shift-catalogue-table/); expect(globals).not.toMatch(/timekeeping-assignment-table[\s\S]*lg:block/); expect(screen.queryByText(/payroll|lương|wage|payable hours|work units/i)).not.toBeInTheDocument();
  });
});
