// Value: protects=the class detail page (design 03): tabs follow the sessions feed, the enroll button follows the class status, close/archive is blocked with reasons the RPC would raise, bulk cancel only offers sessions not started and reports per-session failures, the enroll dialog sends the chosen student with this class, and roles without payments.view see no tuition;
// fails_when=a forbidden sessions feed still shows the Buổi học tab, a closed class shows "Ghi danh học sinh", "Đóng lớp" stays enabled with active schedules or students, a locked session gets a checkbox, a failed cancel is reported as success or cleared from the selection, the enroll payload loses classId, or a TA sees "Còn phải thu";
// why_new=the page was rebuilt around a new workspace feed and new bulk/enroll flows;
// seam=server actions are mocked at module boundaries and the workspace is a fixture; no_claim=does not prove the RPCs accept these calls or that the loader fills the workspace correctly
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClassDetailPage } from "@/features/classes/class-detail-page";
import type { ClassDetailWorkspace } from "@/features/classes/detail/class-detail-data";
import { orderClassSessions, type ClassSessionRow } from "@/features/classes/detail/class-detail-models";
import type { ClassDetailReadModel } from "@/features/classes/read-models";

const mocks = vi.hoisted(() => ({
  cancelSessionAction: vi.fn(),
  changeClassStatusAction: vi.fn(),
  enrollStudentInClassAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/sessions/actions/session-lifecycle-actions", () => ({ cancelSessionAction: mocks.cancelSessionAction }));
vi.mock("@/features/students/enrollment/student-enrollment-actions", () => ({
  enrollStudentInClassAction: mocks.enrollStudentInClassAction,
}));
vi.mock("@/features/classes/actions/class-actions", () => ({ changeClassStatusAction: mocks.changeClassStatusAction }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TODAY = "2026-10-13";

function buildDetail(overrides: Partial<ClassDetailReadModel> = {}): ClassDetailReadModel {
  return {
    academicYear: { code: "NH2627", endsOn: "2027-05-31", id: "year", isCurrent: true, name: "2026–2027", startsOn: "2026-09-01", status: "active" },
    activeScheduleCount: 0,
    activeStudentCount: 0,
    classinUrl: null,
    code: "L-9A26",
    defaultLearningMode: "offline",
    grade: 9,
    id: "class-1",
    level: "A",
    name: "Toán 9A tối 2-4-6",
    notes: null,
    schedules: [],
    status: "active",
    weeklySessionCount: 3,
    ...overrides,
  };
}

function row(overrides: Partial<ClassSessionRow> & Pick<ClassSessionRow, "id" | "sessionDate">): Omit<ClassSessionRow, "ordinal"> {
  return {
    attendance: null,
    classCode: "L-9A26",
    classId: "class-1",
    componentCode: null,
    endTime: "21:30:00",
    learningMode: "offline",
    lockedAt: null,
    resultCount: null,
    roomName: "P.101",
    rosterCount: null,
    sessionKind: "regular",
    startTime: "19:30:00",
    status: "scheduled",
    ...overrides,
  };
}

const sessionRows = orderClassSessions([
  row({ attendance: { absent: 1, additional: 0, present: 21, unmarked: 0 }, id: "s-locked", lockedAt: "2026-10-09T15:00:00Z", resultCount: 21, rosterCount: 22, sessionDate: "2026-10-09", status: "completed" }),
  row({ attendance: { absent: 0, additional: 0, present: 20, unmarked: 2 }, id: "s-pending", resultCount: 18, rosterCount: 22, sessionDate: "2026-10-12", status: "completed" }),
  row({ id: "s-next", sessionDate: "2026-10-14" }),
  row({ id: "s-later", sessionDate: "2026-10-16" }),
]);

function workspace(overrides: Partial<ClassDetailWorkspace> = {}): ClassDetailWorkspace {
  return {
    absenceStreaks: { status: "ready", value: [] },
    attendance: { status: "ready", value: true },
    debt: { status: "ready", value: { outstandingVnd: 2_400_000, overdueStudentCount: 0, studentCount: 1 } },
    results: { status: "ready", value: true },
    sessions: { status: "ready", value: { rows: sessionRows, truncated: false } },
    students: { status: "ready", value: [] },
    ...overrides,
  };
}

function renderPage(props: Partial<Parameters<typeof ClassDetailPage>[0]> = {}) {
  return render(
    <ClassDetailPage
      canEditClass
      canEnrollStudents
      canManageSchedule={false}
      canManageSessions
      canViewStudentCount
      detail={buildDetail()}
      enrollmentCandidates={{
        candidates: [
          { fullName: "Hoàng Bảo Ngọc", grade: 9, id: "student-ngoc", lifecycleStatus: "trial", publicCode: "HS27001", registeredMode: "online" },
          { fullName: "Lý Minh Thư", grade: 7, id: "student-thu", lifecycleStatus: "interested", publicCode: "HS27002", registeredMode: null },
        ],
        truncated: false,
      }}
      nowTime="12:00"
      today={TODAY}
      workspace={workspace()}
      {...props}
    />,
  );
}

describe("ClassDetailPage header and tabs", () => {
  it("shows the sessions tab with its count and pending dot, and hides it when sessions are forbidden", () => {
    renderPage();
    const tablist = screen.getByRole("tablist", { name: "Mục trong lớp học" });
    expect(within(tablist).getByRole("tab", { name: /Buổi học/ })).toHaveTextContent("4");

    cleanup();
    renderPage({ workspace: workspace({ sessions: { reason: "forbidden", status: "unavailable" } }) });
    expect(within(screen.getByRole("tablist", { name: "Mục trong lớp học" })).queryByRole("tab", { name: /Buổi học/ })).not.toBeInTheDocument();
  });

  it("names the next session and the work the class owes", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Mở buổi 3" })).toHaveAttribute("href", "/sessions/s-next");
    expect(screen.getByText("Buổi 2 chưa khóa")).toBeInTheDocument();
    expect(screen.getByText(/điểm danh 20\/22, còn thiếu 2/)).toBeInTheDocument();
    expect(screen.getByText("1 học sinh còn công nợ")).toBeInTheDocument();
  });

  it("disables enrolment for a draft class with the reason and hides it once the class is closed", () => {
    renderPage({ detail: buildDetail({ status: "draft" }) });
    const enroll = screen.getByRole("button", { name: "Ghi danh học sinh" });
    expect(enroll).toBeDisabled();
    expect(screen.getByText("Kích hoạt lớp trước khi ghi danh học sinh")).toBeInTheDocument();

    cleanup();
    renderPage({ detail: buildDetail({ status: "closed" }) });
    expect(screen.queryByRole("button", { name: "Ghi danh học sinh" })).not.toBeInTheDocument();
  });

  it("blocks closing while schedules or students remain and says why", () => {
    renderPage({ detail: buildDetail({ activeScheduleCount: 3, activeStudentCount: 22 }), workspace: workspace({ students: { reason: "forbidden", status: "unavailable" } }) });
    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động cho lớp" }));
    const item = screen.getByRole("menuitem", { name: /Đóng lớp/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("Chưa thực hiện được: còn 3 lịch cố định đang hiệu lực, 22 học sinh đang học.");
    fireEvent.click(item);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps tuition out of the page for roles without payments.view", () => {
    renderPage({ workspace: workspace({ debt: { reason: "forbidden", status: "unavailable" } }) });
    expect(screen.queryByText("Còn phải thu")).not.toBeInTheDocument();
    expect(screen.queryByText(/còn công nợ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Học phí tính theo mức/)).not.toBeInTheDocument();
  });
});

describe("ClassDetailPage sessions tab", () => {
  it("offers bulk cancel only for sessions not started and keeps failures selected", async () => {
    mocks.cancelSessionAction
      .mockResolvedValueOnce({ message: "Đã hủy buổi học.", sessionId: "s-next", status: "success" })
      .mockResolvedValueOnce({ message: "Buổi học đã bắt đầu.", status: "error" });

    renderPage({ initialTab: "sessions" });

    expect(screen.queryByRole("checkbox", { name: /Chọn buổi B1 / })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Chọn buổi B2 / })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Chọn buổi B3 / }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Chọn buổi B4 / }));
    expect(screen.getByRole("region", { name: "Đã chọn 2 buổi · B3, B4" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi…" }));
    const dialog = screen.getByRole("dialog", { name: "Hủy 2 buổi học" });
    expect(within(dialog).getByRole("button", { name: "Hủy 2 buổi" })).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Trùng lịch thi" } });
    // The enabled button drops the disabled-reason wrapper, so query it again.
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy 2 buổi" }));

    await waitFor(() => expect(mocks.cancelSessionAction).toHaveBeenCalledTimes(2));
    expect(mocks.cancelSessionAction).toHaveBeenNthCalledWith(1, { reason: "Trùng lịch thi", sessionId: "s-next" });
    expect(mocks.cancelSessionAction).toHaveBeenNthCalledWith(2, { reason: "Trùng lịch thi", sessionId: "s-later" });
    await waitFor(() => expect(screen.getByText(/Đã hủy 1\/2 buổi/)).toBeInTheDocument());
    expect(screen.getByText("B4: Buổi học đã bắt đầu.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Đã chọn 1 buổi · B4" })).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("has no selection column without sessions.manage", () => {
    renderPage({ canManageSessions: false, initialTab: "sessions" });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Tạo buổi hàng loạt/ })).not.toBeInTheDocument();
  });
});

describe("ClassDetailPage enroll dialog", () => {
  it("sends the chosen student with this class and the student's registered mode", async () => {
    mocks.enrollStudentInClassAction.mockResolvedValueOnce({ message: "ok", status: "success" });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Ghi danh học sinh" }));
    const dialog = screen.getByRole("dialog", { name: "Ghi danh học sinh" });
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Tìm học sinh theo tên hoặc mã" }), { target: { value: "hoang bao" } });
    expect(within(dialog).queryByText("Lý Minh Thư")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Hoàng Bảo Ngọc/ }));
    expect(within(dialog).getByRole("combobox", { name: /Hình thức đăng ký/ })).toHaveValue("online");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do thao tác/ }), { target: { value: "Đăng ký sau học thử" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ghi danh Hoàng Bảo Ngọc" }));

    await waitFor(() =>
      expect(mocks.enrollStudentInClassAction).toHaveBeenCalledWith({
        classId: "class-1",
        effectiveFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        reason: "Đăng ký sau học thử",
        registeredMode: "online",
        studentId: "student-ngoc",
      }),
    );
    expect(await screen.findByText("Đã ghi danh Hoàng Bảo Ngọc vào lớp L-9A26.")).toBeInTheDocument();
  });
});
