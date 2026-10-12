import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionAttendanceManagement } from "@/features/sessions/components/session-attendance-management";
import { SessionResultManagement } from "@/features/sessions/components/session-result-management";
import type { SessionParticipantReadModel } from "@/features/sessions/detail-read-models";

const attendanceActions = vi.hoisted(() => ({ markSessionAttendanceAction: vi.fn(), updateSessionAttendanceAction: vi.fn() }));
const resultActions = vi.hoisted(() => ({ recordSessionResultAction: vi.fn(), updateSessionResultAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/sessions/actions/session-attendance-actions", () => attendanceActions);
vi.mock("@/features/sessions/actions/session-result-actions", () => resultActions);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const participant: SessionParticipantReadModel = {
  actualLearningMode: "offline", attendanceId: null, attendanceNotes: null, attendanceStatus: "present", currentGrade: 7, enrollmentClassId: "class-1", enrollmentId: "enrollment-1", isLateUpdate: false, notebookScore: null, notebookStatus: "not_submitted", registeredMode: "offline", resultComment: null, resultId: null, studentCode: "HV-001", studentId: "student-1", studentName: "Nguyễn Minh An", testScore: null,
};

function attendanceProps(overrides: Partial<ComponentProps<typeof SessionAttendanceManagement>> = {}) {
  return { additionalStudyCandidates: [], canMarkAttendance: true, canViewStudents: true, defaultLearningMode: "offline" as const, lockedAt: null, participants: [participant], sessionId: "session-1", sessionStatus: "in_progress" as const, ...overrides };
}

function resultProps(overrides: Partial<ComponentProps<typeof SessionResultManagement>> = {}) {
  return { canManageResults: true, canViewStudents: true, lockedAt: null, participants: [participant], sessionId: "session-1", sessionStatus: "in_progress" as const, ...overrides };
}

describe("Session attendance and result presentation", () => {
  it("keeps attendance editable after completion but readonly when locked or before start", () => {
    const completed = render(<SessionAttendanceManagement {...attendanceProps({ sessionStatus: "completed" })} />);
    expect(screen.getAllByRole("button", { name: /Điểm danh cho học viên/ })).not.toHaveLength(0);
    expect(screen.getByText(/Mọi điểm danh được bổ sung hoặc sửa lúc này/i)).toBeInTheDocument();
    completed.unmount();

    const locked = render(<SessionAttendanceManagement {...attendanceProps({ lockedAt: "2026-08-10T00:00:00Z" })} />);
    expect(screen.queryByRole("button", { name: /Điểm danh cho học viên/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Chỉ đọc")).not.toHaveLength(0);
    locked.unmount();

    render(<SessionAttendanceManagement {...attendanceProps({ sessionStatus: "scheduled" })} />);
    expect(screen.queryByRole("button", { name: /Điểm danh cho học viên/ })).not.toBeInTheDocument();
  });

  it("presents the existing create/update attendance forms, including update reason", () => {
    const created = render(<SessionAttendanceManagement {...attendanceProps()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Điểm danh cho học viên/ })[0]);
    expect(screen.getByRole("heading", { name: "Ghi điểm danh" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Lý do cập nhật/)).not.toBeInTheDocument();
    created.unmount();

    render(<SessionAttendanceManagement {...attendanceProps({ participants: [{ ...participant, attendanceId: "attendance-1" }] })} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Sửa điểm danh cho học viên/ })[0]);
    expect(screen.getByRole("heading", { name: "Cập nhật điểm danh" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Lý do cập nhật/)).toBeInTheDocument();
  });

  it("masks student identity without students.view and exposes compact attendance records", () => {
    render(<SessionAttendanceManagement {...attendanceProps({ canViewStudents: false })} />);
    expect(screen.getAllByText("Học viên 1")).not.toHaveLength(0);
    expect(screen.queryByText("Nguyễn Minh An")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Danh sách điểm danh buổi học" })).toBeInTheDocument();
  });

  it("keeps attendance content viewable but removes marking controls without attendance.mark", () => {
    render(<SessionAttendanceManagement {...attendanceProps({ canMarkAttendance: false })} />);

    expect(screen.getAllByText("Nguyễn Minh An")).not.toHaveLength(0);
    expect(screen.getByText("Tài khoản hiện tại chỉ được xem điểm danh.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Điểm danh cho học viên/ })).not.toBeInTheDocument();
  });

  it("keeps the existing additional-study flow feature-local", () => {
    render(
      <SessionAttendanceManagement
        {...attendanceProps({
          additionalStudyCandidates: [{ currentGrade: 7, fullName: "Trần Gia Hân", id: "student-additional", publicCode: "HV-002", registeredMode: "offline" }],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Thêm học viên học thêm" }));

    expect(screen.getByRole("heading", { name: "Thêm học viên học thêm" })).toBeInTheDocument();
    expect(screen.getByLabelText("Trạng thái")).toHaveValue("Học thêm");
  });

  it("presents result eligibility and retains completed-unlocked editing", () => {
    const ineligible = { ...participant, attendanceStatus: "excused_absence" as const };
    const view = render(<SessionResultManagement {...resultProps({ participants: [ineligible], sessionStatus: "completed" })} />);
    expect(screen.getAllByText("Không được nhập kết quả")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Nhập kết quả cho học viên/ })).not.toBeInTheDocument();
    view.unmount();

    render(<SessionResultManagement {...resultProps({ sessionStatus: "completed" })} />);
    expect(screen.getAllByRole("button", { name: /Nhập kết quả cho học viên/ })).not.toHaveLength(0);
    expect(screen.getByText(/đã hoàn thành nhưng chưa khóa/i)).toBeInTheDocument();
  });

  it("keeps results readonly once locked, masks identity, and shows the compact result list", () => {
    render(<SessionResultManagement {...resultProps({ canViewStudents: false, lockedAt: "2026-08-10T00:00:00Z" })} />);
    expect(screen.queryByRole("button", { name: /Nhập kết quả cho học viên/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Chỉ đọc")).not.toHaveLength(0);
    expect(screen.getAllByText("Học viên 1")).not.toHaveLength(0);
    expect(screen.queryByText("Nguyễn Minh An")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Danh sách kết quả cuối buổi" })).toBeInTheDocument();
  });

  it("keeps result content viewable but removes editing controls without results.manage", () => {
    render(<SessionResultManagement {...resultProps({ canManageResults: false })} />);

    expect(screen.getAllByText("Nguyễn Minh An")).not.toHaveLength(0);
    expect(screen.getByText("Tài khoản hiện tại chỉ được xem kết quả.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nhập kết quả cho học viên/ })).not.toBeInTheDocument();
  });

  it("preserves the result create/update distinction and update reason presentation", () => {
    render(
      <SessionResultManagement
        {...resultProps({ participants: [{ ...participant, resultId: "result-1" }] })}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Sửa kết quả cho học viên/ })[0]);

    expect(screen.getByRole("heading", { name: "Cập nhật kết quả" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Lý do cập nhật/)).toBeInTheDocument();
  });

  it("renders existing result validation feedback through the shared error presentation", async () => {
    resultActions.recordSessionResultAction.mockResolvedValueOnce({ fieldErrors: { testScore: ["Điểm không hợp lệ."] }, message: "Không thể ghi kết quả.", status: "error" });
    render(<SessionResultManagement {...resultProps()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Nhập kết quả cho học viên/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Ghi kết quả" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể ghi kết quả."));
    const control = screen.getByLabelText(/Điểm kiểm tra cuối buổi/);
    const error = screen.getByText("Điểm không hợp lệ.");
    const label = screen.getByText("Điểm kiểm tra cuối buổi").closest("label");

    expect(control).toHaveAttribute("aria-describedby", error.id);
    expect(label).toHaveAttribute("for", control.id);
    expect(error.closest("label")).toBeNull();
  });

  it("uses each zero-padding operational work area as the responsive query container", () => {
    const attendance = render(<SessionAttendanceManagement {...attendanceProps()} />);
    const attendanceTable = screen.getByRole("table", { name: "Danh sách điểm danh buổi học" });
    const attendanceList = screen.getByRole("list", { name: "Danh sách điểm danh buổi học" });

    expect(attendanceTable.closest(".session-attendance-work-area")).not.toBeNull();
    expect(attendanceList.closest(".session-attendance-work-area")).not.toBeNull();
    attendance.unmount();

    render(<SessionResultManagement {...resultProps()} />);
    const resultTable = screen.getByRole("table", { name: "Danh sách kết quả cuối buổi" });
    const resultList = screen.getByRole("list", { name: "Danh sách kết quả cuối buổi" });
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(resultTable.closest(".session-result-work-area")).not.toBeNull();
    expect(resultList.closest(".session-result-work-area")).not.toBeNull();
    expect(globals).toMatch(/\.session-attendance-work-area,[\s\S]*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 960px\)[\s\S]*\.session-attendance-table/);
    expect(globals).toMatch(/@container \(min-width: 1120px\)[\s\S]*\.session-result-table/);
  });
});


describe("Fast attendance workflow", () => {
  it("searches names without accents including Đ and filters unmarked students", () => {
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, studentName: "Đặng Bảo Ngọc", attendanceStatus: null },
      { ...participant, studentId: "student-2", studentName: "Trần An", attendanceId: "att-2" },
    ] })} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "dang ngoc" } });
    expect(screen.getAllByText("Đặng Bảo Ngọc")).toHaveLength(2);
    expect(screen.queryByText("Trần An")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Chưa điểm danh" }));
    expect(screen.queryByText("Trần An")).not.toBeInTheDocument();
  });

  it("marks present in one click with the registered learning mode", async () => {
    attendanceActions.markSessionAttendanceAction.mockResolvedValueOnce({ status: "success", message: "Đã ghi điểm danh.", attendanceId: "att-1", classSessionId: "session-1" });
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [{ ...participant, actualLearningMode: null, registeredMode: "online", attendanceStatus: null }] })} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Ghi có mặt cho học viên" })[0]);
    await waitFor(() => expect(attendanceActions.markSessionAttendanceAction).toHaveBeenCalledWith({ classSessionId: "session-1", studentId: "student-1", attendanceStatus: "present", actualLearningMode: "online", notes: null }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not overwrite existing attendance with the quick action", () => {
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [{ ...participant, attendanceId: "att-1" }] })} />);
    expect(screen.queryByRole("button", { name: "Ghi có mặt cho học viên" })).not.toBeInTheDocument();
  });

  it("keeps identity masked in the editor and search", () => {
    render(<SessionAttendanceManagement {...attendanceProps({ canViewStudents: false })} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Điểm danh cho học viên" })[0]);
    expect(within(screen.getByRole("dialog")).queryByText(participant.studentName!)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Nguyễn" } });
    expect(screen.queryByText("Học viên 1")).not.toBeInTheDocument();
  });

  it("advances results only after saving and skips students who were absent", async () => {
    resultActions.recordSessionResultAction.mockResolvedValueOnce({ status: "success", message: "Đã lưu.", resultId: "result-1", classSessionId: "session-1" });
    render(<SessionResultManagement {...resultProps({ participants: [participant,
      { ...participant, studentId: "absent", studentName: "Vắng", attendanceStatus: "excused_absence" },
      { ...participant, studentId: "next", studentName: "Đặng Bảo Ngọc" },
    ] })} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Nhập kết quả cho học viên" })[0]);
    fireEvent.change(screen.getByLabelText("Điểm kiểm tra cuối buổi"), { target: { value: "8.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu và học viên tiếp theo" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Đặng Bảo Ngọc")).toBeInTheDocument());
    expect(resultActions.recordSessionResultAction).toHaveBeenCalledWith(expect.objectContaining({ studentId: "student-1", testScore: 8.5 }));
    expect(screen.getByLabelText("Điểm kiểm tra cuối buổi")).toHaveValue(null);
  });

  it("retains result draft when the network fails", async () => {
    resultActions.recordSessionResultAction.mockRejectedValueOnce(new Error("offline"));
    render(<SessionResultManagement {...resultProps()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Nhập kết quả cho học viên" })[0]);
    fireEvent.change(screen.getByLabelText("Điểm kiểm tra cuối buổi"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu và học viên tiếp theo" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Chưa lưu được kết quả"));
    expect(screen.getByLabelText("Điểm kiểm tra cuối buổi")).toHaveValue(7);
  });
});

// Generated by /ship test audit (Claude Fable 5.1) — 2026-10-12
// Value: protects=one-tap status save (any status, registered mode) and the bulk "mark all present" loop: one action per unmarked student, stop at first failure, report the partial count;
// fails_when=quick buttons always send "present", marked rows get silently overwritten instead of opening the editor, bulk marking skips/duplicates students or hides a mid-loop failure;
// why_new=existing cases only cover the single "present" quick action; the four-status group and markAllPresent arrived with the design-04 workbench;
// seam=none; no_claim=does not prove the server action validates learning mode or roster membership (actions are mocked)
describe("Attendance status group and bulk marking (design 04)", () => {
  it("saves a non-present status in one tap and sends marked rows to the editor instead of overwriting", async () => {
    attendanceActions.markSessionAttendanceAction.mockResolvedValueOnce({ status: "success", message: "Đã ghi điểm danh.", attendanceId: "att-1", classSessionId: "session-1" });
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, actualLearningMode: null, attendanceStatus: null, registeredMode: "online" },
      { ...participant, studentId: "student-2", studentName: "Trần An", attendanceId: "att-2", attendanceStatus: "present" },
    ] })} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Ghi Vắng có phép cho học viên" })[0]);
    await waitFor(() => expect(attendanceActions.markSessionAttendanceAction).toHaveBeenCalledWith({ classSessionId: "session-1", studentId: "student-1", attendanceStatus: "excused_absence", actualLearningMode: "online", notes: null }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const change = screen.getAllByRole("button", { name: "Đổi sang Vắng không phép cho học viên" })[0];
    await waitFor(() => expect(change).toBeEnabled());
    fireEvent.click(change);
    expect(screen.getByRole("heading", { name: "Cập nhật điểm danh" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Lý do cập nhật/)).toBeInTheDocument();
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenCalledTimes(1);
  });

  // Value: protects=tapped status is carried into the attendance editor for marked rows; fails_when=onSelect drops the status and the editor reopens on the current one; why_new=existing cases cover unmarked one-tap only; seam=none; no_claim=server validation of the change (mocked action)
  it("opens the update editor on a marked row with the tapped status preselected", () => {
    attendanceActions.markSessionAttendanceAction.mockClear();
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [{ ...participant, attendanceId: "att-1", attendanceStatus: "present" }] })} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Đổi sang Vắng có phép cho học viên" })[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Cập nhật điểm danh" })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: /Trạng thái điểm danh/ })).toHaveValue("excused_absence");
    expect(within(dialog).getByRole("option", { name: "Vắng có phép" })).toHaveProperty("selected", true);
    expect(attendanceActions.markSessionAttendanceAction).not.toHaveBeenCalled();
  });

  it("marks every unmarked student present one action at a time and stops at the first failure with the partial count", async () => {
    attendanceActions.markSessionAttendanceAction
      .mockResolvedValueOnce({ status: "success", message: "Đã ghi điểm danh.", attendanceId: "att-a", classSessionId: "session-1" })
      .mockResolvedValueOnce({ status: "error", message: "Buổi học đã bị khóa." });
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, studentId: "a", studentName: "An", attendanceStatus: null },
      { ...participant, studentId: "b", studentName: "Bình", attendanceId: "att-b", attendanceStatus: "present" },
      { ...participant, actualLearningMode: null, studentId: "c", studentName: "Cúc", attendanceStatus: null, registeredMode: "online" },
      { ...participant, studentId: "d", studentName: "Dũng", attendanceStatus: null },
    ] })} />);

    fireEvent.click(screen.getByRole("button", { name: "Có mặt cho tất cả chưa chọn" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Đã ghi có mặt 1/3. Buổi học đã bị khóa."));
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenCalledTimes(2);
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenNthCalledWith(1, expect.objectContaining({ studentId: "a", attendanceStatus: "present", actualLearningMode: "offline" }));
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ studentId: "c", attendanceStatus: "present", actualLearningMode: "online" }));
    expect(attendanceActions.markSessionAttendanceAction).not.toHaveBeenCalledWith(expect.objectContaining({ studentId: "b" }));
  });

  // Value: protects=the mobile bar only claims a complete roster when the whole roster is marked, and re-tapping the current status saves nothing; fails_when=the bar trusts the filtered list or a same-status tap opens the reason editor; why_new=review cycle 2 (bulk scope moved to visible rows); seam=none; no_claim=desktop layout (md:hidden is not applied in jsdom)
  it("keeps the mobile bar honest under a search filter and ignores a tap on the current status", () => {
    attendanceActions.markSessionAttendanceAction.mockClear();
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, studentId: "a", studentName: "An", attendanceId: "att-a", attendanceStatus: "present" },
      { ...participant, studentId: "b", studentName: "Bình", attendanceStatus: null },
    ] })} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Đổi sang Có mặt cho học viên" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(attendanceActions.markSessionAttendanceAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Tên hoặc mã học viên · có thể gõ không dấu"), { target: { value: "An" } });
    expect(screen.queryByText("Đã điểm danh đủ. Chuyển sang Kết quả.")).not.toBeInTheDocument();
    expect(screen.getByText("Còn 1 chưa điểm danh ngoài bộ lọc.")).toBeInTheDocument();
  });

  it("hides the bulk action when nothing is left to mark or the session is read-only", () => {
    const allMarked = render(<SessionAttendanceManagement {...attendanceProps({ participants: [{ ...participant, attendanceId: "att-1" }] })} />);
    expect(screen.queryByRole("button", { name: /^Có mặt cho (tất cả|\d+ bạn) chưa chọn$/ })).not.toBeInTheDocument();
    expect(screen.getByText("Đã điểm danh đủ. Chuyển sang Kết quả.")).toBeInTheDocument();
    allMarked.unmount();

    render(<SessionAttendanceManagement {...attendanceProps({ lockedAt: "2026-08-10T00:00:00Z", participants: [{ ...participant, attendanceStatus: null }] })} />);
    expect(screen.queryByRole("button", { name: /^Có mặt cho (tất cả|\d+ bạn) chưa chọn$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Trạng thái điểm danh/ })).not.toBeInTheDocument();
  });
});
