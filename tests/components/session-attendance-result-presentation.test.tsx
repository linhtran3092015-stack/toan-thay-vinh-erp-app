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

  // Value: protects=the result editor tells a TA the truth about locking: a missing test score never blocks the lock (migration 20261011090100), only that a locked session's results cannot be edited, matching the lock panel's "không phải là điều kiện khóa";
  // fails_when=the editor goes back to saying a session can only be locked once every present or additional-study student has a test score;
  // why_new=the stale copy survived the 20261011090100 lock change and misled TAs; seam=none; no_claim=what the lock RPC enforces
  it("says a test score is not a lock condition in the result editor", () => {
    render(<SessionResultManagement {...resultProps()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Nhập kết quả cho học viên/ })[0]);
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveTextContent(/Có thể lưu kết quả chưa có điểm kiểm tra\./);
    expect(dialog).toHaveTextContent(/không phải là điều\s+kiện khóa buổi học/);
    expect(dialog).not.toHaveTextContent(/chỉ được khóa khi/);
  });

  it("starts a new result's notebook at Chờ chấm vở so the Zalo comment waits for grading", () => {
    render(<SessionResultManagement {...resultProps({ participants: [{ ...participant, notebookStatus: null }] })} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Nhập kết quả cho học viên/ })[0]);

    const notebook = screen.getByRole("combobox", { name: /Trạng thái vở/ });
    expect(notebook).toHaveValue("pending");
    expect(within(notebook).getAllByRole("option").map((option) => option.textContent?.trim())).toEqual([
      "Chờ chấm vở",
      "Đã nộp",
      "Chưa nộp",
      "Không yêu cầu",
    ]);
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

  it("marks every unmarked student present one action at a time, keeps going past a failure, and reports every unsaved student", async () => {
    attendanceActions.markSessionAttendanceAction
      .mockResolvedValueOnce({ status: "success", message: "Đã ghi điểm danh.", attendanceId: "att-a", classSessionId: "session-1" })
      .mockResolvedValueOnce({ status: "error", message: "Học viên không thuộc roster." })
      .mockResolvedValueOnce({ status: "success", message: "Đã ghi điểm danh.", attendanceId: "att-d", classSessionId: "session-1" });
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, studentId: "a", studentName: "An", attendanceStatus: null },
      { ...participant, studentId: "b", studentName: "Bình", attendanceId: "att-b", attendanceStatus: "present" },
      { ...participant, actualLearningMode: null, studentId: "c", studentName: "Cúc", attendanceStatus: null, registeredMode: "online" },
      { ...participant, studentId: "d", studentName: "Dũng", attendanceStatus: null },
    ] })} />);

    fireEvent.click(screen.getByRole("button", { name: "Có mặt cho tất cả chưa chọn" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Đã ghi có mặt cho 2 học sinh; 1 học sinh chưa ghi được: Cúc. Học viên không thuộc roster."));
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenCalledTimes(3);
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenNthCalledWith(1, expect.objectContaining({ studentId: "a", attendanceStatus: "present", actualLearningMode: "offline" }));
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ studentId: "c", attendanceStatus: "present", actualLearningMode: "online" }));
    // The failure on Cúc does not stop the batch: Dũng is still saved.
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenNthCalledWith(3, expect.objectContaining({ studentId: "d", attendanceStatus: "present", actualLearningMode: "offline" }));
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

// Generated by /ship test audit pass 2 (Claude Opus 5.5) — 2026-10-12
// Value: protects=results footer counts visible vs total rows and averages only entered test scores, rounded to 0.1, recomputed under a search; fails_when=missing scores count as 0, rounding/locale drifts, the average ignores the search, or the footer shows an average with no scores; why_new=ResultFooter is new in design 04 and unasserted; seam=none; no_claim=does not prove the mobile list layout or server-side score validation
describe("Session results footer (design 04)", () => {
  it("averages only entered scores for the visible rows", () => {
    render(<SessionResultManagement {...resultProps({ participants: [
      { ...participant, resultId: "r-a", studentId: "a", studentName: "An", testScore: 8 },
      { ...participant, attendanceStatus: "additional_study", resultId: "r-b", studentId: "b", studentName: "Bình", testScore: 7.25 },
      { ...participant, studentId: "c", studentName: "Cúc", testScore: null },
      { ...participant, attendanceStatus: "excused_absence", studentId: "d", studentName: "Dũng", testScore: null },
    ] })} />);

    // (8 + 7.25) / 2 = 7.625 → 7.6; the two missing scores are not zeros (which would give 3.8).
    expect(screen.getByText(/^Hiển thị 4 trong 4/)).toHaveTextContent("Hiển thị 4 trong 4 · Điểm trung bình đã nhập: 7,6");

    fireEvent.change(screen.getByPlaceholderText("Tên hoặc mã học viên · có thể gõ không dấu"), { target: { value: "Bình" } });
    expect(screen.getByText(/^Hiển thị 1 trong 4/)).toHaveTextContent("Hiển thị 1 trong 4 · Điểm trung bình đã nhập: 7,3"); // 7.25 rounds to one decimal

    fireEvent.change(screen.getByPlaceholderText("Tên hoặc mã học viên · có thể gõ không dấu"), { target: { value: "Cúc" } });
    expect(screen.getByText(/^Hiển thị 1 trong 4/)).toHaveTextContent(/^Hiển thị 1 trong 4$/);
  });
});

// Generated by test-gap pass (Claude Sonnet 5.5) — 2026-10-12
describe("Bulk attendance failure reporting (masking and rejected saves)", () => {
  // Value: protects=the bulk "mark all present" failure alert never leaks a student's name or code to a role without students.view, and numbers the student by roster position; fails_when=failedNames uses studentName/studentCode regardless of canViewStudents, or numbers by visible index instead of roster index; why_new=the masking cases cover the table, editor and search but not the aggregated alert text; seam=none; no_claim=does not prove the server action's own message is free of identity (action is mocked)
  it("masks the failed student's identity in the bulk alert without students.view", async () => {
    attendanceActions.markSessionAttendanceAction.mockResolvedValueOnce({ status: "error", message: "Không ghi được." });
    render(<SessionAttendanceManagement {...attendanceProps({ canViewStudents: false, participants: [
      { ...participant, attendanceId: "att-1", studentId: "marked", studentName: "Trần An", studentCode: "HV-009" },
      { ...participant, attendanceStatus: null, studentId: "student-2" },
    ] })} />);

    fireEvent.click(screen.getByRole("button", { name: "Có mặt cho tất cả chưa chọn" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Đã ghi có mặt cho 0 học sinh; 1 học sinh chưa ghi được: Học viên 2. Không ghi được."));
    expect(screen.getByRole("alert")).not.toHaveTextContent("Nguyễn Minh An");
    expect(screen.getByRole("alert")).not.toHaveTextContent("HV-001");
  });

  // Value: protects=a save that REJECTS (network/throw) mid-batch is caught, the next student is still saved, and the alert names the failed student with the retry copy; fails_when=the try/catch around the action is removed (batch aborts, later students unsaved, unhandled rejection) or the catch message/name is dropped; why_new=the existing batch case only covers a resolved error result, not a thrown rejection; seam=none; no_claim=does not prove which writes reached the server before a network drop (action is mocked)
  it("keeps saving after a rejected save and names the failed student with the retry message", async () => {
    attendanceActions.markSessionAttendanceAction
      .mockResolvedValueOnce({ status: "success", message: "Đã ghi điểm danh.", attendanceId: "att-a", classSessionId: "session-1" })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ status: "success", message: "Đã ghi điểm danh.", attendanceId: "att-c", classSessionId: "session-1" });
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, studentId: "a", studentName: "An", attendanceStatus: null },
      { ...participant, studentId: "b", studentName: "Bình", attendanceStatus: null },
      { ...participant, studentId: "c", studentName: "Cúc", attendanceStatus: null },
    ] })} />);

    fireEvent.click(screen.getByRole("button", { name: "Có mặt cho tất cả chưa chọn" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Đã ghi có mặt cho 2 học sinh; 1 học sinh chưa ghi được: Bình. Chưa lưu được điểm danh. Vui lòng thử lại."));
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenCalledTimes(3);
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ studentId: "b" }));
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenNthCalledWith(3, expect.objectContaining({ studentId: "c" }));
  });
});

// Value: protects=attendance and result copy agree with the lock RPC (roster Học thêm blocks the lock; results are not a lock condition), and a session-wide save failure stops the bulk batch;
// fails_when=the mobile bar says "đủ" while a roster student is only Học thêm, the result row says results are required, or markAllPresent keeps calling the action after the session is locked;
// why_new=review findings (a), (c) and (d) on the lock-readiness pass; seam=none; no_claim=does not prove the server returns these codes (actions are mocked)
describe("Attendance and result copy match lock readiness", () => {
  it("does not tell the TA attendance is done while a roster student is only Học thêm", () => {
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, studentId: "a", studentName: "An", attendanceId: "att-a", attendanceStatus: "present" },
      { ...participant, studentId: "b", studentName: "Bình", attendanceId: "att-b", attendanceStatus: "additional_study" },
      { ...participant, studentId: "w", studentName: "Vãng lai", attendanceId: "att-w", attendanceStatus: "additional_study", enrollmentClassId: null, enrollmentId: null },
    ] })} />);

    expect(screen.queryByText("Đã điểm danh đủ. Chuyển sang Kết quả.")).not.toBeInTheDocument();
    // Only Bình counts: the walk-in is not on the roster.
    expect(screen.getByText("1 học sinh roster đang là Học thêm — đổi sang Có mặt hoặc Vắng để khóa buổi.")).toBeInTheDocument();
  });

  it("prompts for a missing result without calling it required", () => {
    render(<SessionResultManagement {...resultProps({ participants: [{ ...participant, resultId: null }] })} />);

    expect(screen.getAllByText("Chưa nhập kết quả")).not.toHaveLength(0);
    expect(screen.queryByText(/Bắt buộc: học sinh có mặt phải có kết quả/)).not.toBeInTheDocument();
  });

  it("stops the bulk batch at a session-wide failure and says the rest were not attempted", async () => {
    attendanceActions.markSessionAttendanceAction.mockResolvedValueOnce({ status: "error", code: "CLASS_SESSION_IS_LOCKED", message: "Buổi học đã khóa nên không thể thay đổi điểm danh." });
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, studentId: "a", studentName: "An", attendanceStatus: null },
      { ...participant, studentId: "b", studentName: "Bình", attendanceStatus: null },
      { ...participant, studentId: "c", studentName: "Cúc", attendanceStatus: null },
    ] })} />);

    fireEvent.click(screen.getByRole("button", { name: "Có mặt cho tất cả chưa chọn" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Đã ghi có mặt cho 0 học sinh; dừng, không ghi tiếp 3 học sinh còn lại vì: Buổi học đã khóa nên không thể thay đổi điểm danh."));
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenCalledTimes(1);
  });

  // The stopping student counts in "không ghi tiếp" (refused by the session-wide error), not as a per-student failure.
  it("keeps earlier per-student failures in the stop message and counts only the stopped students as not attempted", async () => {
    attendanceActions.markSessionAttendanceAction
      .mockResolvedValueOnce({ status: "error", code: "MAIN_ATTENDANCE_REQUIRES_EFFECTIVE_ENROLLMENT", message: "Học viên không có đăng ký lớp còn hiệu lực tại ngày diễn ra buổi học." })
      .mockResolvedValueOnce({ status: "error", code: "CLASS_SESSION_IS_LOCKED", message: "Buổi học đã khóa nên không thể thay đổi điểm danh." });
    render(<SessionAttendanceManagement {...attendanceProps({ participants: [
      { ...participant, studentId: "a", studentName: "An", attendanceStatus: null },
      { ...participant, studentId: "b", studentName: "Bình", attendanceStatus: null },
      { ...participant, studentId: "c", studentName: "Cúc", attendanceStatus: null },
    ] })} />);

    fireEvent.click(screen.getByRole("button", { name: "Có mặt cho tất cả chưa chọn" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
      "Đã ghi có mặt cho 0 học sinh; 1 học sinh chưa ghi được: An. Học viên không có đăng ký lớp còn hiệu lực tại ngày diễn ra buổi học. Dừng, không ghi tiếp 2 học sinh còn lại vì: Buổi học đã khóa nên không thể thay đổi điểm danh.",
    ));
    expect(attendanceActions.markSessionAttendanceAction).toHaveBeenCalledTimes(2);
    expect(attendanceActions.markSessionAttendanceAction).not.toHaveBeenCalledWith(expect.objectContaining({ studentId: "c" }));
  });
});
