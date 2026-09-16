import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeeklySchedulePanel } from "@/features/timekeeping/components/weekly-schedule-panel";
import type { WeeklyScheduleEntry } from "@/features/timekeeping/weekly-schedule";
const mocks = vi.hoisted(() => ({ save: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/timekeeping/weekly-schedule-actions", () => ({ saveWeeklyAssignmentAction: mocks.save }));
vi.mock("@/features/timekeeping/timekeeping-client-utils", async (load) => ({ ...await load<object>(), getVietnamBusinessDate: () => "2026-09-15" }));
const staff = { id: "11111111-1111-4111-8111-111111111111", displayName: "Trợ giảng An", employeeCode: "TG01" };
const shift = { id: "22222222-2222-4222-8222-222222222222", code: "PM", name: "Ca chiều", startTime: "14:00:00", endTime: "18:00:00", crossesMidnight: false, breakMinutes: 0, isActive: true, notes: null };
const entry: WeeklyScheduleEntry = { assignmentId: "33333333-3333-4333-8333-333333333333", staffId: staff.id, staffDisplayName: staff.displayName, staffEmployeeCode: staff.employeeCode, staffEmploymentStatus: "active", workShiftId: shift.id, workShiftCode: shift.code, workShiftName: shift.name, startTime: shift.startTime, endTime: shift.endTime, crossesMidnight: false, breakMinutes: 0, weekday: 2, weekStart: "2026-09-14", workDate: "2026-09-15", effectiveFrom: "2026-09-15", effectiveTo: "2026-09-15", updatedAt: "2026-09-15T01:00:00+00:00", isActive: true, isLocked: false };
function panel(entries: WeeklyScheduleEntry[] = [], canManage = true, weekStart = "2026-09-14") { return <WeeklySchedulePanel weekStart={weekStart} entries={entries} staffOptions={[staff]} workShifts={[shift, { ...shift, id: "44444444-4444-4444-8444-444444444444", isActive: false, name: "Ca cũ" }]} canManage={canManage} />; }
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("weekly schedule panel", () => {
  it("navigates weeks and normalizes a chosen Sunday", () => {
    render(panel());
    expect(screen.getByRole("link", { name: /Tuần sau/ })).toHaveAttribute("href", "/timekeeping?week=2026-09-21#weekly-schedule");
    fireEvent.change(screen.getByLabelText("Chọn ngày trong tuần"), { target: { value: "2026-10-04" } });
    expect(mocks.push).toHaveBeenCalledWith("/timekeeping?week=2026-09-28#weekly-schedule", { scroll: false });
  });
  it("keeps historical and attendance-locked assignments read-only", () => {
    const { rerender } = render(panel([{ ...entry, isLocked: true }]));
    expect(screen.queryByRole("button", { name: "Đổi / bỏ ca" })).not.toBeInTheDocument();
    rerender(panel([entry], true, "2026-09-07"));
    expect(screen.queryByRole("button", { name: "Phân công lịch" })).not.toBeInTheDocument();
    expect(screen.getByText(/Lịch sử, chỉ xem/)).toBeInTheDocument();
    rerender(panel([entry], false));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("saves to the selected week and excludes retired shifts", async () => {
    mocks.save.mockResolvedValue({ status: "success", message: "Đã lưu" });
    render(panel([], true, "2026-09-21"));
    fireEvent.click(screen.getByRole("button", { name: "Phân công lịch" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("option", { name: /Ca cũ/ })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Lý do thay đổi"), { target: { value: "Lịch đã chốt tuần mới" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu phân công" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ weekStart: "2026-09-21", weekday: 1, expectedAssignmentId: null, workShiftId: shift.id })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("cancels just one cell with its version and keeps the dialog recoverable on failure", async () => {
    mocks.save.mockResolvedValue({ status: "error", message: "Lịch đã thay đổi" });
    render(panel([entry]));
    fireEvent.click(screen.getAllByRole("button", { name: "Đổi / bỏ ca" })[0]);
    fireEvent.change(screen.getByLabelText("Ca làm"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Lý do thay đổi"), { target: { value: "Nghỉ buổi này" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phân công" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ workShiftId: null, expectedAssignmentId: entry.assignmentId, expectedUpdatedAt: entry.updatedAt })));
    expect(await screen.findByText("Lịch đã thay đổi")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Lưu phân công" })).toBeEnabled());
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
