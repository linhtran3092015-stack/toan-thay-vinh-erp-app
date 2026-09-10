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
