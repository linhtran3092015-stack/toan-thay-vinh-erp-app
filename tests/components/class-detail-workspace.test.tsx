// Value: protects=the class detail page (design 03): tabs follow the sessions feed, the enroll button follows the class status, close/archive is blocked with reasons the RPC would raise, bulk cancel only offers sessions not started and reports per-session failures, the enroll dialog sends the chosen student with this class, and roles without payments.view see no tuition;
// fails_when=a forbidden sessions feed still shows the Buổi học tab, a closed class shows "Ghi danh học sinh", "Đóng lớp" stays enabled with active schedules or students, a locked session gets a checkbox, a failed cancel is reported as success or cleared from the selection, the enroll payload loses classId, or a TA sees "Còn phải thu";
// why_new=the page was rebuilt around a new workspace feed and new bulk/enroll flows;
// seam=server actions are mocked at module boundaries and the workspace is a fixture; no_claim=does not prove the RPCs accept these calls or that the loader fills the workspace correctly
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionMenu } from "@/components/patterns/action-menu";
import { ClassDetailPage } from "@/features/classes/class-detail-page";
import type { ClassDetailWorkspace } from "@/features/classes/detail/class-detail-data";
import { orderClassSessions, type ClassSessionRow } from "@/features/classes/detail/class-detail-models";
import type { ClassDetailReadModel } from "@/features/classes/read-models";

const mocks = vi.hoisted(() => ({
  cancelSessionAction: vi.fn(),
  changeClassStatusAction: vi.fn(),
  enrollStudentInClassAction: vi.fn(),
  refresh: vi.fn(),
  searchEnrollmentCandidatesAction: vi.fn(),
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
vi.mock("@/features/classes/actions/class-enrollment-search-actions", () => ({
  searchEnrollmentCandidatesAction: mocks.searchEnrollmentCandidatesAction,
}));

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
    componentClasses: [],
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
      canBulkCancelSessions
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
    // The reason points to the "…" menu where activation lives, and describes the button.
    const reason = screen.getByText("Kích hoạt lớp (menu …) trước khi ghi danh học sinh");
    expect(enroll).toHaveAttribute("aria-describedby", reason.id);

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

  // Value: protects=the "…" menu item opens the hook's shared dialog and submits classId, reason and target status; an RPC error keeps the dialog open with the message;
  // fails_when=ActionMenu onSelect no longer reaches useClassStatusOperations.open, the dialog node is not rendered, the payload loses classId/targetStatus, or an error closes the dialog;
  // why_new=the status flow moved from a component to a hook and no test ever submitted it (the action mock was never asserted);
  // seam=none; no_claim=does not prove change_class_status accepts the transition
  it("changes the class status through the menu dialog and keeps it open on an error", async () => {
    mocks.changeClassStatusAction
      .mockResolvedValueOnce({ message: "Năm học của lớp chưa hoạt động.", status: "error" })
      .mockResolvedValueOnce({ message: "Đã kích hoạt lớp.", status: "success" });
    renderPage({ detail: buildDetail({ status: "draft" }) });

    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động cho lớp" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Kích hoạt lớp/ }));
    const dialog = screen.getByRole("dialog", { name: "Kích hoạt lớp học" });
    expect(within(dialog).getByRole("button", { name: "Xác nhận kích hoạt" })).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Đủ học sinh để mở lớp" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận kích hoạt" }));

    expect(await within(dialog).findByText("Năm học của lớp chưa hoạt động.")).toBeInTheDocument();
    expect(mocks.changeClassStatusAction).toHaveBeenCalledWith({ classId: "class-1", reason: "Đủ học sinh để mở lớp", targetStatus: "active" });
    expect(screen.getByRole("dialog", { name: "Kích hoạt lớp học" })).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();

    // The transition settles after the message renders; retry once the submit button is back.
    fireEvent.click(await within(dialog).findByRole("button", { name: "Xác nhận kích hoạt" }));

    expect(await screen.findByText("Đã kích hoạt lớp.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Kích hoạt lớp học" })).not.toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  // Value: protects=a consecutive-absence streak links to the care queue filtered on that student, or to the profile for roles without student_care.view;
  // fails_when=the href drops ?student_id, canViewCare is ignored, or a failed streak feed silently shows "nothing to do";
  // why_new=findAbsenceStreaks is unit-tested but the overview item, its link and the failed note are not rendered in any test;
  // seam=none; no_claim=does not prove /student-care honours the student_id filter
  it("links absence streaks to student care, or to the profile without care access", () => {
    const streaks = workspace({
      absenceStreaks: { status: "ready", value: [{ count: 3, ordinals: [1, 2, 3], student: { fullName: "Trần Gia Bảo", id: "student-bao", publicCode: "HS1" } }] },
    });
    renderPage({ canViewCare: true, workspace: streaks });
    expect(screen.getByText("Trần Gia Bảo vắng 3 buổi liên tiếp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở chăm sóc" })).toHaveAttribute("href", "/student-care?student_id=student-bao");

    cleanup();
    renderPage({ canViewCare: false, workspace: streaks });
    expect(screen.getByRole("link", { name: "Mở hồ sơ" })).toHaveAttribute("href", "/students/student-bao");

    cleanup();
    renderPage({ workspace: workspace({ absenceStreaks: { reason: "failed", status: "unavailable" } }) });
    expect(screen.getByText(/Chưa tải được điểm danh để kiểm tra học sinh vắng liên tiếp/)).toBeInTheDocument();
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
    // jsdom renders both the desktop table and the mobile list; act on the table.
    const table = screen.getByRole("table", { name: "Buổi học của lớp" });

    expect(within(table).queryByRole("checkbox", { name: /Chọn buổi B1 / })).not.toBeInTheDocument();
    expect(within(table).queryByRole("checkbox", { name: /Chọn buổi B2 / })).not.toBeInTheDocument();
    fireEvent.click(within(table).getByRole("checkbox", { name: /Chọn buổi B3 / }));
    fireEvent.click(within(table).getByRole("checkbox", { name: /Chọn buổi B4 / }));
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
    renderPage({ canBulkCancelSessions: false, canManageSessions: false, initialTab: "sessions" });
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

  // Value: protects=a rejected enrolment keeps the dialog open with the RPC message and no success banner; a failed candidate read disables enrolment with a reason;
  // fails_when=onSuccess fires on an error result, the error alert is dropped, the page refreshes on failure, or candidates=null opens an empty dialog;
  // why_new=only the success path of the enroll dialog and the draft-class disabled state were tested;
  // seam=none; no_claim=does not prove enroll_student_in_class rejects students with enrolment history
  it("keeps the dialog open on an enrolment error and disables enrolment when candidates failed to load", async () => {
    mocks.enrollStudentInClassAction.mockResolvedValueOnce({ message: "Học sinh đã có lịch sử ghi danh.", status: "error" });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Ghi danh học sinh" }));
    const dialog = screen.getByRole("dialog", { name: "Ghi danh học sinh" });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Lý Minh Thư/ }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do thao tác/ }), { target: { value: "Đăng ký" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ghi danh Lý Minh Thư" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Học sinh đã có lịch sử ghi danh.");
    expect(screen.getByRole("dialog", { name: "Ghi danh học sinh" })).toBeInTheDocument();
    expect(screen.queryByText(/Đã ghi danh/)).not.toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();

    cleanup();
    renderPage({ enrollmentCandidates: null });
    expect(screen.getByRole("button", { name: "Ghi danh học sinh" })).toBeDisabled();
    expect(screen.getByText("Chưa tải được danh sách học sinh, tải lại trang")).toBeInTheDocument();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe("ClassDetailPage close blockers and composite classes", () => {
  // Value: protects=closing is blocked only by the class's own in-progress session, and the closing consequence counts only its own scheduled sessions;
  // fails_when=a component class's in-progress or scheduled row (the feed includes a composite's components) blocks "Đóng lớp" or inflates the cancelled-session count, or the class's own in-progress session no longer blocks;
  // why_new=the feed was widened to component classes while change_class_status only touches class_sessions.class_id = the class (migration 20261013090100);
  // seam=none; no_claim=does not prove the RPC raises on an in-progress session
  it("blocks closing only on the class's own in-progress session", () => {
    const componentRows = orderClassSessions([
      row({ classId: "component-1", id: "c-live", sessionDate: TODAY, status: "in_progress" }),
      row({ classId: "component-1", id: "c-next", sessionDate: "2026-10-15" }),
      row({ id: "own-next", sessionDate: "2026-10-16" }),
    ]);
    renderPage({ workspace: workspace({ sessions: { status: "ready", value: { rows: componentRows, truncated: false } } }) });

    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động cho lớp" }));
    const close = screen.getByRole("menuitem", { name: /Đóng lớp/ });
    expect(close).not.toHaveAttribute("aria-disabled");
    expect(close).not.toHaveTextContent("buổi đang diễn ra");
    fireEvent.click(close);
    expect(within(screen.getByRole("dialog")).getByText(/1 buổi đã lên lịch còn lại sẽ bị hủy tự động/)).toBeInTheDocument();

    cleanup();
    const ownRows = orderClassSessions([row({ id: "own-live", sessionDate: TODAY, status: "in_progress" })]);
    renderPage({ workspace: workspace({ sessions: { status: "ready", value: { rows: ownRows, truncated: false } } }) });
    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động cho lớp" }));
    const blocked = screen.getByRole("menuitem", { name: /Đóng lớp/ });
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    expect(blocked).toHaveTextContent("Chưa thực hiện được: còn buổi đang diễn ra.");
  });

  // Value: protects=a composite parent never offers creating sessions or schedule templates (the DB rejects both) and points to its component classes instead;
  // fails_when=componentClasses is ignored and "Tạo buổi hàng loạt", "Thiết lập lịch", "Sửa lịch" or the create form show on a composite parent, or the components are not linked;
  // why_new=red-team finding: those CTAs led to COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION / _SCHEDULE_TEMPLATE errors;
  // seam=none; no_claim=does not prove getClassDetail reads class_component_links correctly
  it("hides session and schedule creation on a composite parent and lists its components", () => {
    const composite = buildDetail({
      componentClasses: [
        { code: "L-9A26-T2", id: "component-1", name: "Toán 9 ghép thứ 2" },
        { code: "L-9A26-T5", id: "component-2", name: "Toán 9 ghép thứ 5" },
      ],
      weeklySessionCount: 2,
    });
    const empty = workspace({ sessions: { status: "ready", value: { rows: [], truncated: false } } });
    renderPage({ canManageSchedule: true, detail: composite, workspace: empty });

    expect(screen.getByText("Không có buổi sắp tới")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Thiết lập lịch/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Xếp lịch/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sửa lịch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm lịch học" })).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa có lịch cố định.")).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "L-9A26-T2 · Toán 9 ghép thứ 2" })) {
      expect(link).toHaveAttribute("href", "/classes/component-1");
    }
    expect(screen.getAllByRole("link", { name: "L-9A26-T5 · Toán 9 ghép thứ 5" })).not.toHaveLength(0);

    cleanup();
    renderPage({ canManageSchedule: true, detail: composite, initialTab: "sessions", workspace: empty });
    expect(screen.queryByRole("link", { name: /Tạo buổi hàng loạt/ })).not.toBeInTheDocument();

    // Control: the same permissions on an ordinary class keep the CTAs.
    cleanup();
    renderPage({ canManageSchedule: true, workspace: empty });
    expect(screen.getByRole("link", { name: /Thiết lập lịch/ })).toHaveAttribute("href", "#class-schedule-management");
    expect(screen.getByRole("link", { name: "Sửa lịch" })).toBeInTheDocument();
  });

  // Value: protects=the empty next-session heading says "Chưa xếp lịch" only when the class has no schedule;
  // fails_when=a scheduled class without upcoming sessions, or a draft class, is labelled "Chưa xếp lịch";
  // why_new=the heading was hard-coded for every empty case;
  // seam=none; no_claim=none
  it("names the empty next-session state after the schedule", () => {
    const empty = workspace({ sessions: { status: "ready", value: { rows: [], truncated: false } } });
    renderPage({ detail: buildDetail({ activeScheduleCount: 3 }), workspace: empty });
    expect(screen.getByText("Không có buổi sắp tới")).toBeInTheDocument();
    expect(screen.queryByText("Chưa xếp lịch")).not.toBeInTheDocument();

    cleanup();
    renderPage({ detail: buildDetail({ status: "draft" }), workspace: empty });
    expect(screen.getByText("Không có buổi sắp tới")).toBeInTheDocument();

    cleanup();
    renderPage({ workspace: empty });
    expect(screen.getByText("Chưa xếp lịch")).toBeInTheDocument();
  });

  // Value: protects=a session that ended earlier today without starting is listed as overdue, using the server's Vietnam time;
  // fails_when=nowTime is not passed to the stage helpers and today's missed session waits until tomorrow to be flagged;
  // why_new=the stage helpers only compared dates before this change;
  // seam=none; no_claim=does not prove getVietnamTime returns Vietnam time
  it("flags a session that ended earlier today without starting", () => {
    const rows = orderClassSessions([row({ endTime: "10:00:00", id: "s-today", sessionDate: TODAY, startTime: "08:00:00" })]);
    const today = workspace({ sessions: { status: "ready", value: { rows, truncated: false } } });
    renderPage({ nowTime: "12:00", workspace: today });
    expect(screen.getByText("Buổi 1 đã qua nhưng chưa bắt đầu")).toBeInTheDocument();

    cleanup();
    renderPage({ nowTime: "09:00", workspace: today });
    expect(screen.queryByText(/đã qua nhưng chưa bắt đầu/)).not.toBeInTheDocument();
  });

  // Value: protects=an owner whose debt feed failed sees an unknown amount, never a reassuring 0 ₫;
  // fails_when=a failed debt feed renders "0 ₫" or hides the tile from an owner;
  // why_new=only the forbidden (TA) branch of the debt tiles was tested;
  // seam=none; no_claim=none
  it("shows an unknown amount when the debt feed failed", () => {
    renderPage({ workspace: workspace({ debt: { reason: "failed", status: "unavailable" } }) });
    const tile = screen.getByText("Còn phải thu").parentElement as HTMLElement;
    expect(within(tile).getByText("—")).toBeInTheDocument();
    expect(within(tile).getByText("chưa tải được")).toBeInTheDocument();
    expect(screen.queryByText(/^0\s*₫$/)).not.toBeInTheDocument();
    expect(screen.getByText(/Chưa tải được công nợ của học sinh trong lớp/)).toBeInTheDocument();
  });
});

describe("ClassDetailPage sessions tab, bulk and mobile", () => {
  // Value: protects=a failed sessions feed keeps the tab reachable with a warning instead of an empty table;
  // fails_when=a failed feed hides the tab, falls back to overview, or renders the table as "no sessions";
  // why_new=only the forbidden branch of the tab gate was tested;
  // seam=none; no_claim=none
  it("keeps the sessions tab with a warning when the feed failed", () => {
    renderPage({ initialTab: "sessions", workspace: workspace({ sessions: { reason: "failed", status: "unavailable" } }) });
    expect(screen.getByRole("tab", { name: /Buổi học/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Chưa tải được buổi học của lớp")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // Value: protects=the truncation notice says honestly that only the newest 400 sessions are shown;
  // fails_when=the notice sends the user to "mục Buổi học" while they are already in it;
  // why_new=the old wording pointed at the tab itself;
  // seam=none; no_claim=does not prove the loader's limit is 400
  it("explains the 400-session limit without pointing to itself", () => {
    renderPage({ initialTab: "sessions", workspace: workspace({ sessions: { status: "ready", value: { rows: sessionRows, truncated: true } } }) });
    expect(screen.getByText("Chỉ hiện 400 buổi mới nhất")).toBeInTheDocument();
    expect(screen.queryByText(/Xem đủ ở mục Buổi học/)).not.toBeInTheDocument();
  });

  // Value: protects=bulk cancel is owner-only: a role with sessions.manage but not classes.manage_schedule (TA) gets no selection or bulk bar;
  // fails_when=canBulkCancelSessions is ignored and the checkboxes follow sessions.manage alone;
  // why_new=owner decision after teaching assistants received sessions.manage (migration 20261014090100);
  // seam=the permission pair is combined in the route (class-detail-route.test); no_claim=does not prove cancel_session rejects TAs
  it("offers no bulk selection to a role without classes.manage_schedule", () => {
    renderPage({ canBulkCancelSessions: false, canManageSessions: true, initialTab: "sessions" });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tạo buổi hàng loạt/ })).toBeInTheDocument();
  });

  // Value: protects=the mobile list offers the same bulk selection as the table, so bulk cancel works below md;
  // fails_when=the mobile rows have no checkbox, offer one for a started/locked session, or keep their own selection apart from the table;
  // why_new=the bulk bar showed on mobile with nothing to select;
  // seam=none; no_claim=does not prove the 44px target at real viewport sizes
  it("lets mobile rows select the same sessions as the table", () => {
    renderPage({ initialTab: "sessions" });
    const list = screen.getByRole("list", { name: "Buổi học của lớp" });
    expect(within(list).queryByRole("checkbox", { name: /Chọn buổi B1 / })).not.toBeInTheDocument();
    expect(within(list).queryByRole("checkbox", { name: /Chọn buổi B2 / })).not.toBeInTheDocument();
    expect(within(list).getAllByRole("checkbox")).toHaveLength(2);

    fireEvent.click(within(list).getByRole("checkbox", { name: /Chọn buổi B3 / }));
    expect(screen.getByRole("region", { name: "Đã chọn 1 buổi · B3" })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Buổi học của lớp" })).getByRole("checkbox", { name: /Chọn buổi B3 / })).toBeChecked();
  });

  // Value: protects=a cancel call that throws (network) is reported per session and the session stays selected for a retry;
  // fails_when=the thrown call aborts the loop, is counted as cancelled, or clears the selection;
  // why_new=only returned errors were tested, not a rejected promise;
  // seam=cancelSessionAction is mocked; no_claim=none
  it("reports a rejected cancel call and keeps that session selected", async () => {
    mocks.cancelSessionAction
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ message: "Đã hủy buổi học.", sessionId: "s-later", status: "success" });
    renderPage({ initialTab: "sessions" });
    const table = screen.getByRole("table", { name: "Buổi học của lớp" });
    fireEvent.click(within(table).getByRole("checkbox", { name: /Chọn buổi B3 / }));
    fireEvent.click(within(table).getByRole("checkbox", { name: /Chọn buổi B4 / }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi…" }));
    const dialog = screen.getByRole("dialog", { name: "Hủy 2 buổi học" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "Trùng lịch thi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy 2 buổi" }));

    expect(await screen.findByText("B3: Không kết nối được hệ thống.")).toBeInTheDocument();
    expect(mocks.cancelSessionAction).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Đã hủy 1\/2 buổi/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Đã chọn 1 buổi · B3" })).toBeInTheDocument();
  });

  // Value: protects=the bulk cancel reason field is labelled and its error is linked for screen readers;
  // fails_when=the textarea loses its label or the short-reason error is not referenced by aria-describedby;
  // why_new=the field used a bespoke class list and an unlinked error;
  // seam=none; no_claim=none
  it("links the short-reason error to the bulk cancel textarea", () => {
    renderPage({ initialTab: "sessions" });
    fireEvent.click(within(screen.getByRole("table", { name: "Buổi học của lớp" })).getByRole("checkbox", { name: /Chọn buổi B3 / }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi…" }));
    const textarea = within(screen.getByRole("dialog")).getByRole("textbox", { name: /Lý do hủy/ });
    fireEvent.change(textarea, { target: { value: "ab" } });
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("Lý do hủy phải có ít nhất 3 ký tự.");
    expect(textarea).toHaveAttribute("maxLength", "500");
  });
});

describe("ClassDetailPage enroll search", () => {
  const remoteStudent = { fullName: "Ngô Gia Huy", grade: 9, id: "student-huy", lifecycleStatus: "trial", publicCode: "HS27100", registeredMode: "offline" as const };

  // Value: protects=typing two or more characters searches every candidate on the server, only the latest response is shown, and a remote result can be enrolled;
  // fails_when=the dialog only filters the preloaded list, a slow earlier response overwrites a newer one, one character already calls the server, or the chosen remote student is not sent;
  // why_new=the dialog searched only the first 500 preloaded candidates;
  // seam=searchEnrollmentCandidatesAction is mocked; no_claim=does not prove the server query or its permission check
  it("searches on the server after two characters and ignores a stale response", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mocks.searchEnrollmentCandidatesAction.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mocks.enrollStudentInClassAction.mockResolvedValueOnce({ message: "ok", status: "success" });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Ghi danh học sinh" }));
    const dialog = screen.getByRole("dialog", { name: "Ghi danh học sinh" });
    const search = within(dialog).getByRole("searchbox", { name: "Tìm học sinh theo tên hoặc mã" });

    fireEvent.change(search, { target: { value: "n" } });
    await act(() => new Promise((settle) => setTimeout(settle, 350)));
    expect(mocks.searchEnrollmentCandidatesAction).not.toHaveBeenCalled();

    fireEvent.change(search, { target: { value: "ngo" } });
    await waitFor(() => expect(mocks.searchEnrollmentCandidatesAction).toHaveBeenCalledWith("ngo"));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Đang tìm trong toàn bộ học sinh");
    fireEvent.change(search, { target: { value: "ngo gia" } });
    await waitFor(() => expect(mocks.searchEnrollmentCandidatesAction).toHaveBeenCalledWith("ngo gia"));

    await act(async () => second.resolve({ candidates: [remoteStudent], status: "success", truncated: false }));
    expect(await within(dialog).findByRole("radio", { name: /Ngô Gia Huy/ })).toBeInTheDocument();
    await act(async () => first.resolve({ candidates: [{ ...remoteStudent, fullName: "Kết quả cũ", id: "stale" }], status: "success", truncated: false }));
    expect(within(dialog).queryByText("Kết quả cũ")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: /Ngô Gia Huy/ }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do thao tác/ }), { target: { value: "Đăng ký" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ghi danh Ngô Gia Huy" }));
    await waitFor(() => expect(mocks.enrollStudentInClassAction).toHaveBeenCalledWith(expect.objectContaining({ studentId: "student-huy" })));
  });

  // Value: protects=a failed server search says so and keeps the preloaded matches usable;
  // fails_when=an error result or a thrown action leaves the dialog loading forever or empties the list;
  // why_new=the server search is new;
  // seam=searchEnrollmentCandidatesAction is mocked; no_claim=none
  it("shows a retry message when the server search fails", async () => {
    mocks.searchEnrollmentCandidatesAction
      .mockResolvedValueOnce({ message: "Chưa tìm được học sinh, thử lại.", status: "error" })
      .mockRejectedValueOnce(new Error("offline"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Ghi danh học sinh" }));
    const dialog = screen.getByRole("dialog", { name: "Ghi danh học sinh" });
    const search = within(dialog).getByRole("searchbox", { name: "Tìm học sinh theo tên hoặc mã" });

    fireEvent.change(search, { target: { value: "hoang" } });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Chưa tìm được học sinh, thử lại.");
    expect(within(dialog).getByRole("radio", { name: /Hoàng Bảo Ngọc/ })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "hoang b" } });
    await waitFor(() => expect(mocks.searchEnrollmentCandidatesAction).toHaveBeenCalledTimes(2));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Chưa tìm được học sinh, thử lại.");
  });
});

describe("ActionMenu keyboard", () => {
  const items = [
    { enabled: false, label: "Chuyển lớp", reason: "Cần lớp đích đang hoạt động.", value: "transfer" },
    { enabled: true, label: "Bảo lưu", reason: null, value: "reserve" },
    { enabled: true, label: "Nghỉ học", reason: null, value: "end" },
  ] as const;

  // Value: protects=the shared "…" menu follows the WAI-ARIA menu button pattern (first enabled item focused, roving arrows with wrap, Home/End, Escape/Tab/outside click close, disabled items focusable but inert);
  // fails_when=opening leaves focus on the trigger, arrows do not move or wrap, Escape does not return focus, Tab or an outside click leaves the menu open, or a disabled item calls onSelect;
  // why_new=the menu only handled Escape and mouse;
  // seam=none; no_claim=does not prove screen reader announcements
  it("moves focus through items and closes like a menu button", () => {
    const onSelect = vi.fn();
    render(<ActionMenu items={items} label="Thêm hành động" onSelect={onSelect} />);
    const trigger = screen.getByRole("button", { name: "Thêm hành động" });

    fireEvent.click(trigger);
    const item = (name: RegExp) => screen.getByRole("menuitem", { name });
    expect(item(/Bảo lưu/)).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(item(/Nghỉ học/)).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(item(/Chuyển lớp/)).toHaveFocus();
    fireEvent.click(item(/Chuyển lớp/));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
    expect(item(/Nghỉ học/)).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    expect(item(/Chuyển lớp/)).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    expect(item(/Nghỉ học/)).toHaveFocus();

    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(item(/Nghỉ học/)).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "Tab" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(item(/Bảo lưu/)).toHaveFocus();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(item(/Bảo lưu/));
    expect(onSelect).toHaveBeenCalledWith("reserve", trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
