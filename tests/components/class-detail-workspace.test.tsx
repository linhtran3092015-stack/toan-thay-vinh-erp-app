// Value: protects=the class detail page (design 03): tabs follow the sessions feed, the enroll button follows the class status, close/archive is blocked with reasons the RPC would raise, bulk cancel only offers sessions not started (re-checked on every render) and reports per-session failures, lock CTAs follow attendance readiness and sessions.lock, composite parents (future links included) offer no schedule or session creation, the enroll dialog sends the chosen student with this class, and roles without payments.view see no tuition;
// fails_when=a forbidden sessions feed still shows the Buổi học tab, a closed class shows "Ghi danh học sinh", "Đóng lớp" stays enabled with active schedules or students, a locked or started session gets a checkbox or stays selected, a failed cancel is reported as success or cleared from the selection, "Khóa buổi" shows without complete attendance or sessions.lock, the enroll payload loses classId, or a TA sees "Còn phải thu";
// why_new=the page was rebuilt around a new workspace feed and new bulk/enroll flows; red-team review added selection pruning, readiness-based CTAs, future component links and focus fixes;
// seam=server actions are mocked at module boundaries and the workspace is a fixture; no_claim=does not prove the RPCs accept these calls or that the loader fills the workspace correctly
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionMenu } from "@/components/patterns/action-menu";
import { ClassDetailPage, formatScheduleSummary } from "@/features/classes/class-detail-page";
import type { ClassDetailWorkspace } from "@/features/classes/detail/class-detail-data";
import { orderClassSessions, type ClassSessionRow } from "@/features/classes/detail/class-detail-models";
import { getClassStatusOperations } from "@/features/classes/management/class-status-actions";
import type { ClassDetailReadModel, ClassScheduleReadModel } from "@/features/classes/read-models";

const mocks = vi.hoisted(() => ({
  cancelClassSessionsAction: vi.fn(),
  changeClassStatusAction: vi.fn(),
  enrollStudentInClassAction: vi.fn(),
  refresh: vi.fn(),
  searchEnrollmentCandidatesAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/sessions/actions/session-lifecycle-actions", () => ({ cancelClassSessionsAction: mocks.cancelClassSessionsAction }));
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
  return render(pageElement(props));
}

function pageElement(props: Partial<Parameters<typeof ClassDetailPage>[0]> = {}) {
  return (
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
    />
  );
}

function withRows(rows: ClassSessionRow[]): ClassDetailWorkspace {
  return workspace({ sessions: { status: "ready", value: { rows, truncated: false } } });
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
  // fails_when=ActionMenu onSelect no longer reaches useClassStatusOperations.open, the dialog node is not rendered, the confirm button loses its "Nhập lý do đổi trạng thái" reason or the textarea its label, the payload loses classId/targetStatus, an error closes the dialog or is not announced as an alert;
  // why_new=the status flow moved from a component to a hook and no test ever submitted it (the action mock was never asserted); the reason field now uses the shared textarea control;
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
    expect(within(dialog).getByRole("button", { name: "Xác nhận kích hoạt" })).toHaveAccessibleDescription("Nhập lý do đổi trạng thái");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do đổi trạng thái/ }), { target: { value: "Đủ học sinh để mở lớp" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận kích hoạt" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Năm học của lớp chưa hoạt động.");
    expect(mocks.changeClassStatusAction).toHaveBeenCalledWith({ classId: "class-1", reason: "Đủ học sinh để mở lớp", targetStatus: "active" });
    expect(screen.getByRole("dialog", { name: "Kích hoạt lớp học" })).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();

    // The transition settles after the message renders; retry once the submit button is back.
    fireEvent.click(await within(dialog).findByRole("button", { name: "Xác nhận kích hoạt" }));

    expect(await screen.findByText("Đã kích hoạt lớp.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Kích hoạt lớp học" })).not.toBeInTheDocument();
    // changeClassStatusAction revalidates the class page itself; a client refresh would render it twice.
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  // Value: protects=a reason rejected by changeClassStatusAction is shown under the textarea, linked via aria-describedby/aria-invalid, and cleared when the dialog is reopened;
  // fails_when=fieldErrors.reason is ignored (only the generic alert shows), the error is not referenced by the textarea, or a stale reason error survives closing and reopening the dialog;
  // why_new=the existing status-dialog test returns only a message; the reason field-error branch of useClassStatusOperations was never rendered;
  // seam=changeClassStatusAction is mocked; no_claim=does not prove which reasons the server schema rejects
  it("shows and links a rejected reason in the status dialog, and clears it on reopen", async () => {
    mocks.changeClassStatusAction.mockResolvedValueOnce({
      fieldErrors: { reason: ["Lý do thao tác quá dài."] },
      message: "Vui lòng kiểm tra lại thông tin đổi trạng thái lớp.",
      status: "error",
    });
    renderPage({ detail: buildDetail({ status: "draft" }) });
    const trigger = screen.getByRole("button", { name: "Thêm hành động cho lớp" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: /Kích hoạt lớp/ }));
    let dialog = screen.getByRole("dialog", { name: "Kích hoạt lớp học" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do đổi trạng thái/ }), { target: { value: "Đủ học sinh" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận kích hoạt" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Vui lòng kiểm tra lại thông tin đổi trạng thái lớp.");
    const textarea = within(dialog).getByRole("textbox", { name: /Lý do đổi trạng thái/ });
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("Lý do thao tác quá dài.");

    // The transition settles after the error renders; close once the dialog is interactive again.
    await within(dialog).findByRole("button", { name: "Xác nhận kích hoạt" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog", { name: "Kích hoạt lớp học" })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: /Kích hoạt lớp/ }));
    dialog = screen.getByRole("dialog", { name: "Kích hoạt lớp học" });
    expect(within(dialog).getByRole("textbox", { name: /Lý do đổi trạng thái/ })).not.toHaveAttribute("aria-invalid");
    expect(within(dialog).queryByText("Lý do thao tác quá dài.")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
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
  // Value: protects=bulk cancel only offers sessions not started, sends them in one server call with this class, and keeps failed sessions selected, named by date and time;
  // fails_when=a locked session gets a checkbox, the dialog calls the server per session or drops classId, a failure is counted as cancelled or cleared from the selection, the failure names only the ordinal, or the page also calls router.refresh();
  // why_new=bulk cancel moved from N client calls of cancelSessionAction to one cancelClassSessionsAction (owner decision D6);
  // seam=cancelClassSessionsAction is mocked (its own unit test covers the server loop); no_claim=does not prove the RPC accepts these sessions
  it("offers bulk cancel only for sessions not started and keeps failures selected", async () => {
    mocks.cancelClassSessionsAction.mockResolvedValueOnce({
      cancelled: 1,
      failed: [{ message: "Buổi học đã bắt đầu.", sessionId: "s-later" }],
      status: "success",
    });

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

    await waitFor(() => expect(mocks.cancelClassSessionsAction).toHaveBeenCalledTimes(1));
    expect(mocks.cancelClassSessionsAction).toHaveBeenCalledWith({ classId: "class-1", reason: "Trùng lịch thi", sessionIds: ["s-next", "s-later"] });
    await waitFor(() => expect(screen.getByText(/Đã hủy 1\/2 buổi/)).toBeInTheDocument());
    expect(screen.getByText("B4 (Thứ 6 16/10, 19:30): Buổi học đã bắt đầu.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Đã chọn 1 buổi · B4" })).toBeInTheDocument();
    expect(screen.getByText("Đã hủy 1/2 buổi. Các buổi lỗi vẫn đang được chọn.")).toBeInTheDocument();
    // The action's revalidatePath re-renders the page; a client refresh would render it twice.
    expect(mocks.refresh).not.toHaveBeenCalled();
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
    // The reason field announces its hint (screen readers hear where the reason is kept).
    expect(within(dialog).getByRole("textbox", { name: /Lý do thao tác/ })).toHaveAccessibleDescription("Lý do được lưu vào lịch sử nghiệp vụ.");
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
    // enrollStudentInClassAction revalidates the class page itself; a client refresh would render it twice.
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  // Value: protects=the enrolment start date defaults to the Vietnam calendar date, not the UTC date;
  // fails_when=the dialog's default effectiveFrom is taken from UTC (a day early between 00:00 and 07:00 in Vietnam) or from a stale render date;
  // why_new=the success test only matched /^\d{4}-\d{2}-\d{2}$/ (pass-2 review, owner decision D14);
  // seam=none; no_claim=does not prove enroll_student_in_class accepts that date
  it("defaults the enrolment start to the Vietnam date, not the UTC date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T17:30:00Z")); // 00:30 on 13/10 in Vietnam
    try {
      mocks.enrollStudentInClassAction.mockResolvedValueOnce({ message: "ok", status: "success" });
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Ghi danh học sinh" }));
      const dialog = screen.getByRole("dialog", { name: "Ghi danh học sinh" });
      fireEvent.click(within(dialog).getByRole("radio", { name: /Hoàng Bảo Ngọc/ }));
      fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do thao tác/ }), { target: { value: "Đăng ký sau học thử" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Ghi danh Hoàng Bảo Ngọc" }));

      await waitFor(() => expect(mocks.enrollStudentInClassAction).toHaveBeenCalledWith(expect.objectContaining({ effectiveFrom: "2026-10-13" })));
    } finally {
      vi.useRealTimers();
    }
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
  // Value: protects=the close dialog's consequence states the real number of scheduled sessions to be cancelled, says none remain at 0, and falls back to a general sentence only when the count is unknown;
  // fails_when=a count of 0 still promises cancellations, an unknown count is shown as 0, or a known count is dropped for the general sentence;
  // why_new=the 0 and unknown branches were split in pass 2 of this ship run and only the >0 branch was rendered;
  // seam=none; no_claim=does not prove change_class_status cancels exactly these sessions
  it.each([
    [null, "Lớp ngừng hoạt động. Mọi buổi đã lên lịch còn lại sẽ bị hủy tự động."],
    [0, "Lớp ngừng hoạt động. Lớp không còn buổi nào đã lên lịch."],
    [3, "Lớp ngừng hoạt động. 3 buổi đã lên lịch còn lại sẽ bị hủy tự động."],
  ])("states the close consequence for %s scheduled sessions", (count, consequence) => {
    expect(getClassStatusOperations("active", count).find((operation) => operation.targetStatus === "closed")?.consequence).toBe(consequence);
  });

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

    // A truncated feed can miss older scheduled sessions that closing still cancels: no count, never "none left".
    cleanup();
    renderPage({ workspace: workspace({ sessions: { status: "ready", value: { rows: componentRows, truncated: true } } }) });
    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động cho lớp" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Đóng lớp/ }));
    expect(within(screen.getByRole("dialog")).getByText("Lớp ngừng hoạt động. Mọi buổi đã lên lịch còn lại sẽ bị hủy tự động.")).toBeInTheDocument();

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
        { code: "L-9A26-T2", effectiveFrom: "2026-09-07", id: "component-1", name: "Toán 9 ghép thứ 2" },
        { code: "L-9A26-T5", effectiveFrom: TODAY, id: "component-2", name: "Toán 9 ghép thứ 5" },
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

  // Value: protects=when the latest session is also the lowest, the chart legend names it once in warning (no "Buổi gần nhất" moss dot for a bar drawn in warning), and a low rate says why it is flagged;
  // fails_when=the legend shows a moss "Buổi gần nhất" entry for a warning bar, prints a sliced ISO date, or the low attendance tile has no hint;
  // why_new=design review of the overview chart and health tiles;
  // seam=none; no_claim=does not prove the bar colours at real sizes
  it("merges the latest and lowest bar into one legend entry and explains a low attendance rate", () => {
    const rows = orderClassSessions([
      row({ attendance: { absent: 1, additional: 0, present: 21, unmarked: 0 }, id: "s-1", lockedAt: "2026-10-09T15:00:00Z", resultCount: 21, rosterCount: 22, sessionDate: "2026-10-09", status: "completed" }),
      row({ attendance: { absent: 12, additional: 0, present: 10, unmarked: 0 }, id: "s-2", resultCount: 10, rosterCount: 22, sessionDate: "2026-10-12", status: "completed" }),
    ]);
    renderPage({ workspace: workspace({ sessions: { status: "ready", value: { rows, truncated: false } } }) });

    expect(screen.getByText(/B2 \(gần nhất\) có mặt\s+10\/22 · thấp nhất/)).toBeInTheDocument();
    expect(screen.queryByText("Buổi gần nhất")).not.toBeInTheDocument();
    expect(screen.getByText("dưới 85%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Việc tiếp theo của lớp" })).toHaveClass("text-body", "text-text-strong");
  });

  // Value: protects=when the lowest bar is an older session, the legend dates it (not "gần nhất") and keeps a separate "Buổi gần nhất" entry for the latest bar;
  // fails_when=latestIsLow stops comparing bar ids (any low bar is called "gần nhất" and the latest-bar entry disappears), or the low entry loses its date;
  // why_new=only the merged branch (latest bar is also the lowest) was rendered in a test;
  // seam=none; no_claim=does not prove the bar colours at real sizes
  it("dates an older lowest bar and keeps the latest-bar legend entry", () => {
    const rows = orderClassSessions([
      row({ attendance: { absent: 12, additional: 0, present: 10, unmarked: 0 }, id: "s-1", lockedAt: "2026-10-09T15:00:00Z", resultCount: 10, rosterCount: 22, sessionDate: "2026-10-09", status: "completed" }),
      row({ attendance: { absent: 1, additional: 0, present: 21, unmarked: 0 }, id: "s-2", resultCount: 21, rosterCount: 22, sessionDate: "2026-10-12", status: "completed" }),
    ]);
    renderPage({ workspace: withRows(rows) });

    expect(screen.getByText(/B1 \(Thứ 6 09\/10\) có mặt\s+10\/22 · thấp nhất/)).toBeInTheDocument();
    expect(screen.queryByText(/\(gần nhất\)/)).not.toBeInTheDocument();
    expect(screen.getByText("Buổi gần nhất")).toBeInTheDocument();
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

  // Value: protects=when the sessions feed failed, the overview's needs-action panel says sessions were not checked instead of giving an all-clear;
  // fails_when=NeedsActionPanel ignores a failed sessions feed and shows only "Không có việc tồn trong phần bạn được xem.";
  // why_new=the only failed-sessions test rendered the Sessions tab; the debt and absence notes had their own branches;
  // seam=none; no_claim=does not prove the loader reports a failed read as failed
  it("does not give an all-clear on the overview when the sessions feed failed", () => {
    renderPage({
      workspace: workspace({
        absenceStreaks: { reason: "forbidden", status: "unavailable" },
        debt: { reason: "forbidden", status: "unavailable" },
        sessions: { reason: "failed", status: "unavailable" },
      }),
    });
    const panel = screen.getByRole("region", { name: "Lớp này cần bạn xử lý" });
    expect(within(panel).getByText(/Chưa tải được buổi học nên chưa kiểm tra buổi chờ khóa/)).toBeInTheDocument();
  });

  // Value: protects=the attendance and result columns say why a value is missing: no permission, a failed load, or results needing attendance;
  // fails_when=a failed attendance or results read is reported as "Không có quyền" (table or overview chart), a row whose roster was not resolved claims a load failure, or the results dash has no reason for assistive tech;
  // why_new=the cells took a boolean, so a failed read and a missing permission rendered the same "no permission" text, and the results reason branch was unreachable;
  // seam=none; no_claim=does not prove the loader nulls attendance tallies when attendance fails
  it("explains missing attendance and result values by permission or failed load", () => {
    renderPage({
      initialTab: "sessions",
      workspace: workspace({ attendance: { reason: "failed", status: "unavailable" }, results: { reason: "forbidden", status: "unavailable" } }),
    });
    expect(screen.getAllByText("Chưa tải được điểm danh").length).toBeGreaterThan(0);
    expect(screen.queryByText("Không có quyền xem điểm danh")).not.toBeInTheDocument();
    expect(screen.getAllByText("Không có quyền xem kết quả").length).toBeGreaterThan(0);
    // One visible line says why the columns are empty, not only each dash's tooltip.
    expect(
      screen.getByText("Chưa tải được điểm danh nên cột Điểm danh để trống. Không có quyền xem kết quả nên cột Kết quả để trống."),
    ).toBeInTheDocument();

    cleanup();
    const noAttendanceRows = sessionRows.map((sessionRow) => ({ ...sessionRow, attendance: null }));
    renderPage({
      initialTab: "sessions",
      workspace: workspace({
        attendance: { reason: "forbidden", status: "unavailable" },
        results: { status: "ready", value: true },
        sessions: { status: "ready", value: { rows: noAttendanceRows, truncated: false } },
      }),
    });
    expect(screen.getAllByText("Không có quyền xem điểm danh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cần quyền xem điểm danh để tính kết quả").length).toBeGreaterThan(0);
    // Results are counted against attendance, so the note names both columns.
    expect(screen.getByText("Không có quyền xem điểm danh nên cột Điểm danh và Kết quả để trống.")).toBeInTheDocument();
    // Sessions not started yet have no results to count: a plain dash, no reason.
    const table = screen.getByRole("table", { name: "Buổi học của lớp" });
    const unstarted = within(table).getByRole("link", { name: / buổi B3 ngày / }).closest("tr") as HTMLElement;
    expect(unstarted).not.toHaveTextContent("tính kết quả");

    cleanup();
    renderPage({
      initialTab: "sessions",
      workspace: workspace({
        attendance: { reason: "failed", status: "unavailable" },
        results: { status: "ready", value: true },
        sessions: { status: "ready", value: { rows: noAttendanceRows, truncated: false } },
      }),
    });
    expect(screen.getAllByText("Chưa tải được điểm danh để tính kết quả").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cần quyền xem điểm danh để tính kết quả")).not.toBeInTheDocument();

    cleanup();
    renderPage({ initialTab: "sessions", workspace: workspace({ results: { reason: "failed", status: "unavailable" } }) });
    expect(screen.getAllByText("Chưa tải được kết quả").length).toBeGreaterThan(0);
    expect(screen.queryByText("Không có quyền xem kết quả")).not.toBeInTheDocument();

    // Attendance ready but this row's roster was not resolved here (component session or past the cap): no failure claim.
    cleanup();
    renderPage({ initialTab: "sessions", workspace: workspace({ sessions: { status: "ready", value: { rows: noAttendanceRows, truncated: false } } }) });
    expect(screen.getAllByText("Mở buổi để xem điểm danh và kết quả").length).toBeGreaterThan(0);
    expect(screen.queryByText("Chưa tải được điểm danh để tính kết quả")).not.toBeInTheDocument();

    // Mobile cards of started sessions keep the explanation even when neither tally exists.
    cleanup();
    const bareRows = sessionRows.map((sessionRow) => ({ ...sessionRow, attendance: null, resultCount: null }));
    const { container } = renderPage({
      initialTab: "sessions",
      workspace: workspace({
        attendance: { reason: "failed", status: "unavailable" },
        results: { reason: "failed", status: "unavailable" },
        sessions: { status: "ready", value: { rows: bareRows, truncated: false } },
      }),
    });
    const mobileList = container.querySelector(".class-sessions-record-list") as HTMLElement;
    expect(within(mobileList).getAllByText("Chưa tải được điểm danh").length).toBeGreaterThan(0);
    expect(within(mobileList).getAllByText("Chưa tải được kết quả").length).toBeGreaterThan(0);

    // Both feeds ready but no tally for a started row (component session or past the roster cap): still explained on mobile.
    cleanup();
    const readyBare = renderPage({ initialTab: "sessions", workspace: workspace({ sessions: { status: "ready", value: { rows: bareRows, truncated: false } } }) });
    const readyList = readyBare.container.querySelector(".class-sessions-record-list") as HTMLElement;
    expect(within(readyList).getAllByText("Chưa tải được danh sách hoặc điểm danh của buổi").length).toBeGreaterThan(0);

    // The overview chart tells a failed attendance read from a missing permission.
    cleanup();
    renderPage({ workspace: workspace({ attendance: { reason: "failed", status: "unavailable" } }) });
    expect(screen.getByText("Chưa tải được điểm danh, tải lại trang để thử lại.")).toBeInTheDocument();
    cleanup();
    renderPage({ workspace: workspace({ attendance: { reason: "forbidden", status: "unavailable" } }) });
    expect(screen.getByText("Không có quyền xem điểm danh.")).toBeInTheDocument();
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

  // Value: protects=a bulk cancel call that throws or returns an error keeps the dialog open with a message and the whole selection, so the owner can retry;
  // fails_when=a rejected call or an error state closes the dialog, reports success, clears the selection, or refreshes the page;
  // why_new=the dialog now makes one server call, so a thrown call or a permission error affects the whole batch;
  // seam=cancelClassSessionsAction is mocked; no_claim=none
  it("keeps the dialog and the selection when the bulk cancel call fails", async () => {
    mocks.cancelClassSessionsAction
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ message: "Tài khoản hiện tại không có quyền quản lý lịch học.", status: "error" });
    renderPage({ initialTab: "sessions" });
    const table = screen.getByRole("table", { name: "Buổi học của lớp" });
    fireEvent.click(within(table).getByRole("checkbox", { name: /Chọn buổi B3 / }));
    fireEvent.click(within(table).getByRole("checkbox", { name: /Chọn buổi B4 / }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi…" }));
    const dialog = screen.getByRole("dialog", { name: "Hủy 2 buổi học" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "Trùng lịch thi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy 2 buổi" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Không kết nối được hệ thống.");
    fireEvent.click(await within(dialog).findByRole("button", { name: "Hủy 2 buổi" }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Tài khoản hiện tại không có quyền quản lý lịch học."));

    expect(mocks.cancelClassSessionsAction).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog", { name: "Hủy 2 buổi học" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Đã chọn 2 buổi · B3, B4" })).toBeInTheDocument();
    expect(screen.queryByText(/Đã hủy \d/)).not.toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  // Value: protects=after every selected session is cancelled, focus lands on the result banner instead of the unmounted bulk trigger;
  // fails_when=focus falls to the document body (the trigger and its bar are gone), lands anywhere but the banner's focus wrapper, or the success banner is not focusable;
  // why_new=design/red-team review: keyboard users lost their place after a fully successful bulk cancel;
  // seam=cancelClassSessionsAction is mocked; no_claim=does not prove screen reader announcement order
  it("moves focus to the result after a fully successful bulk cancel", async () => {
    mocks.cancelClassSessionsAction.mockResolvedValueOnce({ cancelled: 2, failed: [], status: "success" });
    renderPage({ initialTab: "sessions" });
    const table = screen.getByRole("table", { name: "Buổi học của lớp" });
    fireEvent.click(within(table).getByRole("checkbox", { name: /Chọn buổi B3 / }));
    fireEvent.click(within(table).getByRole("checkbox", { name: /Chọn buổi B4 / }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi…" }));
    const dialog = screen.getByRole("dialog", { name: "Hủy 2 buổi học" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "Trùng lịch thi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy 2 buổi" }));

    const banner = await screen.findByText("Đã hủy 2 buổi.");
    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
    // toContainElement would pass with focus on <body>, which contains everything.
    const focusTarget = banner.closest<HTMLElement>('[tabindex="-1"]');
    expect(focusTarget).not.toBeNull();
    await waitFor(() => expect(focusTarget).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  // Value: protects=a composite parent page cannot bulk-cancel its component classes' sessions, which other classes share;
  // fails_when=isBulkCancellable ignores row.classId and offers a checkbox (desktop or mobile) for a component session;
  // why_new=red-team finding: the parent's feed includes component sessions and the bulk bar would cancel them;
  // seam=none; no_claim=the server-side class check is covered in cancel-class-sessions-action.test
  it("offers no bulk selection for a component class's sessions on the parent page", () => {
    const rows = orderClassSessions([
      row({ classId: "component-1", classCode: "L-9A26-T2", componentCode: "T2", id: "c-next", sessionDate: "2026-10-15" }),
      row({ id: "own-next", sessionDate: "2026-10-16" }),
    ]);
    renderPage({ initialTab: "sessions", workspace: workspace({ sessions: { status: "ready", value: { rows, truncated: false } } }) });

    const table = screen.getByRole("table", { name: "Buổi học của lớp" });
    expect(within(table).queryByRole("checkbox", { name: /Chọn buổi B1 / })).not.toBeInTheDocument();
    expect(within(table).getByRole("checkbox", { name: /Chọn buổi B2 / })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Buổi học của lớp" });
    expect(within(list).getAllByRole("checkbox")).toHaveLength(1);
  });

  // Value: protects=the bulk bar names at most three sessions, and mobile cards use the table's ordinal format with cancelled sessions titled by date;
  // fails_when=a long selection lists every ordinal, the mobile title reads "Buổi 3"/"Buổi đã hủy", or a cancelled card repeats "Đã hủy" beside its badge;
  // why_new=design review of the sessions tab;
  // seam=none; no_claim=does not prove the one-line layout at real widths
  it("caps the bulk subject at three ordinals and titles mobile cards like the table", () => {
    const rows = orderClassSessions([
      row({ id: "s-cancelled", sessionDate: "2026-10-13", status: "cancelled" }),
      ...["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"].map((date, index) => row({ id: `s-${index}`, sessionDate: date })),
    ]);
    renderPage({ initialTab: "sessions", workspace: workspace({ sessions: { status: "ready", value: { rows, truncated: false } } }) });

    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn mọi buổi sắp tới trên trang" }));
    expect(screen.getByRole("region", { name: "Đã chọn 5 buổi · B1, B2, B3 +2" })).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Buổi học của lớp" });
    expect(within(list).getByText("B1")).toBeInTheDocument();
    expect(within(list).getByText("Thứ 3, 13/10/2026")).toBeInTheDocument();
    expect(within(list).queryByText(/Buổi đã hủy/)).not.toBeInTheDocument();
    expect(within(list).getAllByText("Đã hủy")).toHaveLength(1);
  });

  // Value: protects=select-all takes only upcoming sessions; an overdue one (past its date, never started) is ticked on its own and the dialog warns that it may have been taught (owner decision D17);
  // fails_when=select-all also selects overdue sessions, an overdue session cannot be selected at all, or the dialog does not mark it "đã qua ngày" with the warning;
  // why_new=ship adversarial review: select-all could cancel past sessions that were taught but never started in the app;
  // seam=none; no_claim=does not prove the server refuses nothing else for overdue sessions
  it("keeps overdue sessions out of select-all and warns when one is ticked", () => {
    const rows = orderClassSessions([
      row({ id: "s-overdue", sessionDate: "2026-10-09" }),
      row({ id: "s-soon", sessionDate: "2026-10-14" }),
      row({ id: "s-later", sessionDate: "2026-10-16" }),
    ]);
    renderPage({ initialTab: "sessions", workspace: withRows(rows) });
    const table = screen.getByRole("table", { name: "Buổi học của lớp" });

    fireEvent.click(within(table).getByRole("checkbox", { name: "Chọn mọi buổi sắp tới trên trang" }));
    expect(screen.getByRole("region", { name: /^Đã chọn 2 / })).toBeInTheDocument();
    const overdueBox = within(table).getByRole("checkbox", { name: /Chọn buổi B1 / });
    expect(overdueBox).not.toBeChecked();

    fireEvent.click(overdueBox);
    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi…" }));
    const dialog = screen.getByRole("dialog", { name: "Hủy 3 buổi học" });
    expect(dialog).toHaveTextContent(/B1 \([^)]*, đã qua ngày\)/);
    expect(within(dialog).getByText(/1 buổi đã qua ngày mà chưa bắt đầu trên hệ thống/)).toBeInTheDocument();

    // A page whose only cancellable sessions are overdue still offers each one a checkbox on mobile.
    cleanup();
    renderPage({ initialTab: "sessions", workspace: withRows(orderClassSessions([row({ id: "s-overdue", sessionDate: "2026-10-09" })])) });
    const list = screen.getByRole("list", { name: "Buổi học của lớp" });
    expect(within(list).getByRole("checkbox", { name: /Chọn buổi B1 / })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Chọn mọi buổi sắp tới trên trang" })).not.toBeInTheDocument();
  });

  // Value: protects=on mobile, where select-all is hidden, "Bỏ chọn" moves focus to the first row checkbox instead of the body;
  // fails_when=returnFocusRefs only holds the desktop select-all, so a hidden select-all leaves keyboard focus nowhere;
  // why_new=design/red-team review: select-all is desktop-only;
  // seam=checkVisibility is stubbed on the select-all to stand in for the md:hidden layout; no_claim=does not prove CSS visibility
  it("returns focus to the first mobile checkbox when select-all is hidden", () => {
    renderPage({ initialTab: "sessions" });
    const selectAll = screen.getByRole("checkbox", { name: "Chọn mọi buổi sắp tới trên trang" });
    Object.defineProperty(selectAll, "checkVisibility", { value: () => false });
    const list = screen.getByRole("list", { name: "Buổi học của lớp" });
    fireEvent.click(within(list).getByRole("checkbox", { name: /Chọn buổi B4 / }));

    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn" }));

    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
    expect(within(list).getByRole("checkbox", { name: /Chọn buổi B3 / })).toHaveFocus();
  });

  // Value: protects=without checkVisibility (Safari before 17.4), a select-all hidden by CSS that cannot take focus is skipped and focus lands on the first mobile checkbox;
  // fails_when=the bar focuses the first connected candidate without checking it took focus, leaving keyboard focus on the body;
  // why_new=ship pass-3 red-team finding; focus() on a display:none node is a silent no-op;
  // seam=none (select-all's focus is stubbed as a no-op to stand in for display:none); no_claim=does not prove CSS hides select-all
  it("skips a select-all that cannot take focus when checkVisibility is missing", () => {
    renderPage({ initialTab: "sessions" });
    const selectAll = screen.getByRole("checkbox", { name: "Chọn mọi buổi sắp tới trên trang" });
    Object.defineProperty(selectAll, "focus", { value: () => undefined });
    const list = screen.getByRole("list", { name: "Buổi học của lớp" });
    fireEvent.click(within(list).getByRole("checkbox", { name: /Chọn buổi B4 / }));

    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn" }));

    expect(within(list).getByRole("checkbox", { name: /Chọn buổi B3 / })).toHaveFocus();
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

describe("ClassDetailPage review fixes", () => {
  // Value: protects=the bulk selection is re-derived from current eligibility, so a selected session that started after a refresh leaves the count, the bar subject, the dialog and the payload;
  // fails_when=selectedRows reads selectedIds without re-checking isBulkCancellable, so a now in-progress session stays "Đã chọn" and is sent to cancelClassSessionsAction;
  // why_new=red-team finding: the selection survived refreshes that made sessions ineligible;
  // seam=rerender stands in for the server re-render after revalidatePath; no_claim=does not prove when Next delivers the new rows
  it("drops a selected session from the selection once it has started", async () => {
    mocks.cancelClassSessionsAction.mockResolvedValueOnce({ cancelled: 1, failed: [], status: "success" });
    const { rerender } = renderPage({ initialTab: "sessions" });
    const table = () => screen.getByRole("table", { name: "Buổi học của lớp" });
    fireEvent.click(within(table()).getByRole("checkbox", { name: /Chọn buổi B3 / }));
    fireEvent.click(within(table()).getByRole("checkbox", { name: /Chọn buổi B4 / }));
    expect(screen.getByRole("region", { name: "Đã chọn 2 buổi · B3, B4" })).toBeInTheDocument();

    const started = sessionRows.map((item) => (item.id === "s-next" ? { ...item, status: "in_progress" as const } : item));
    rerender(pageElement({ initialTab: "sessions", workspace: withRows(started) }));

    expect(screen.getByRole("region", { name: "Đã chọn 1 buổi · B4" })).toBeInTheDocument();
    expect(within(table()).queryByRole("checkbox", { name: /Chọn buổi B3 / })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi…" }));
    const dialog = screen.getByRole("dialog", { name: "Hủy 1 buổi học" });
    expect(within(dialog).queryByText(/B3 \(/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "Trùng lịch thi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy 1 buổi" }));

    await waitFor(() => expect(mocks.cancelClassSessionsAction).toHaveBeenCalledWith({ classId: "class-1", reason: "Trùng lịch thi", sessionIds: ["s-later"] }));
  });

  // Value: protects=when a refused session turns out not to be cancellable after the refresh, the selection clears, the result stops claiming failed sessions are still selected, and focus moves to the result;
  // fails_when=the warning keeps "Các buổi lỗi vẫn đang được chọn" with nothing selected, the stale id keeps the bar alive, or focus is left on the body after the bar unmounts;
  // why_new=red-team finding: the failure message promised a selection that pruning removes;
  // seam=rerender stands in for the server re-render; cancelClassSessionsAction is mocked; no_claim=none
  it("stops claiming failed sessions are selected once none can be cancelled", async () => {
    mocks.cancelClassSessionsAction.mockResolvedValueOnce({
      cancelled: 0,
      failed: [{ message: "Buổi học đã bắt đầu, đã khóa hoặc đã hủy nên không hủy hàng loạt.", sessionId: "s-next" }],
      status: "success",
    });
    const { rerender } = renderPage({ initialTab: "sessions" });
    fireEvent.click(within(screen.getByRole("table", { name: "Buổi học của lớp" })).getByRole("checkbox", { name: /Chọn buổi B3 / }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi…" }));
    const dialog = screen.getByRole("dialog", { name: "Hủy 1 buổi học" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "Trùng lịch thi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy 1 buổi" }));

    // Before fresh rows arrive the failed session still looks cancellable and stays selected.
    expect(await screen.findByText("Đã hủy 0/1 buổi. Các buổi lỗi vẫn đang được chọn.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Đã chọn 1 buổi · B3" })).toBeInTheDocument();

    const started = sessionRows.map((item) => (item.id === "s-next" ? { ...item, status: "in_progress" as const } : item));
    rerender(pageElement({ initialTab: "sessions", workspace: withRows(started) }));

    const title = screen.getByText("Đã hủy 0/1 buổi.");
    expect(screen.queryByText(/Các buổi lỗi vẫn đang được chọn/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
    await waitFor(() => expect(title.closest('[tabindex="-1"]')).toHaveFocus());
  });

  const readinessRows = orderClassSessions([
    // complete: every roster student recorded.
    row({ attendance: { absent: 0, additional: 0, present: 2, unmarked: 0 }, id: "s-complete", rosterCount: 2, sessionDate: "2026-10-05", status: "completed" }),
    // unknown: a component class's session; its roster here is only this class's students.
    row({ attendance: { absent: 0, additional: 0, present: 2, unmarked: 0 }, classCode: "L-9A26-T2", classId: "component-1", id: "s-component", rosterCount: 2, sessionDate: "2026-10-06", status: "completed" }),
    // no_roster: nobody on the roster.
    row({ attendance: { absent: 0, additional: 0, present: 0, unmarked: 0 }, id: "s-empty", rosterCount: 0, sessionDate: "2026-10-07", status: "completed" }),
    // incomplete: one roster student unrecorded.
    row({ attendance: { absent: 0, additional: 0, present: 2, unmarked: 1 }, id: "s-incomplete", rosterCount: 3, sessionDate: "2026-10-08", status: "completed" }),
  ]);

  // Value: protects=the overview's pending-lock rows follow getSessionAttendanceReadiness: "Khóa buổi" only for complete attendance and sessions.lock, no readiness claim for a component session, and an empty roster is not a danger "còn thiếu 0" row;
  // fails_when=a component session's partial roster is shown as "xong" with "Khóa buổi", an empty roster reads "còn thiếu 0" in danger, or a TA without sessions.lock is offered "Khóa buổi";
  // why_new=red-team finding: the lock CTA trusted a filtered roster and empty rosters;
  // seam=none; no_claim=does not prove lock_class_session_internal's own readiness check
  it("labels overview lock work by attendance readiness and lock permission", () => {
    renderPage({ canLockSessions: true, workspace: withRows(readinessRows) });
    const panel = screen.getByRole("region", { name: "Lớp này cần bạn xử lý" });

    const complete = within(panel).getByText("Buổi 1 chưa khóa").closest("li") as HTMLElement;
    expect(complete).toHaveTextContent("điểm danh 2/2 xong");
    expect(within(complete).getByRole("link", { name: "Khóa buổi" })).toHaveAttribute("href", "/sessions/s-complete");

    const component = within(panel).getByText("Buổi 2 chưa khóa").closest("li") as HTMLElement;
    expect(component).toHaveTextContent("buổi của lớp L-9A26-T2, xem điểm danh ở trang buổi");
    expect(component).not.toHaveTextContent(/xong|còn thiếu/);
    expect(within(component).getByRole("link", { name: "Mở buổi" })).toHaveAttribute("href", "/sessions/s-component");

    const empty = within(panel).getByText("Buổi 3 chưa khóa").closest("li") as HTMLElement;
    expect(empty).toHaveTextContent("Không có học sinh trong danh sách");
    expect(empty).not.toHaveTextContent("còn thiếu");
    expect(empty.querySelector(".bg-danger")).toBeNull();
    expect(within(empty).getByRole("link", { name: "Mở buổi" })).toHaveAttribute("href", "/sessions/s-empty");
    expect(within(panel).queryByRole("link", { name: "Điểm danh" })).not.toBeInTheDocument();

    cleanup();
    renderPage({ canLockSessions: false, workspace: withRows(readinessRows) });
    const taPanel = screen.getByRole("region", { name: "Lớp này cần bạn xử lý" });
    expect(within(taPanel).queryByRole("link", { name: "Khóa buổi" })).not.toBeInTheDocument();
    const taComplete = within(taPanel).getByText("Buổi 1 chưa khóa").closest("li") as HTMLElement;
    expect(within(taComplete).getByRole("link", { name: "Mở buổi" })).toHaveAttribute("href", "/sessions/s-complete");

    cleanup();
    renderPage({ canLockSessions: true });
    expect(screen.getByRole("link", { name: "Điểm danh" })).toHaveAttribute("href", "/sessions/s-pending");
  });

  // Value: protects=the sessions tab's row action and attendance cell follow the same readiness: "Điểm danh" when incomplete, "Khóa buổi" only when complete with sessions.lock, "Mở buổi" with an explained "—" for a component session, and an empty roster says so;
  // fails_when=SessionRowAction ignores canLockSessions or the component/empty-roster cases, or the attendance cell shows a component session's partial tally or "0/0";
  // why_new=red-team finding: the tab offered "Khóa buổi" to TAs and on sessions the page cannot judge;
  // seam=none; no_claim=does not prove the session page enforces sessions.lock
  it("labels the sessions tab actions by attendance readiness and lock permission", () => {
    renderPage({ canLockSessions: true, initialTab: "sessions", workspace: withRows(readinessRows) });
    let table = screen.getByRole("table", { name: "Buổi học của lớp" });
    const rowOf = (ordinal: string) => within(table).getByRole("link", { name: new RegExp(` buổi ${ordinal} ngày `) }).closest("tr") as HTMLElement;

    expect(within(rowOf("B1")).getByRole("link", { name: /^Khóa buổi buổi B1 / })).toHaveAttribute("href", "/sessions/s-complete");
    expect(rowOf("B1")).toHaveTextContent("2/2");

    expect(within(rowOf("B2")).getByRole("link", { name: /^Mở buổi buổi B2 / })).toBeInTheDocument();
    expect(rowOf("B2")).not.toHaveTextContent("2/2");
    expect(within(rowOf("B2")).getByText(/Buổi của lớp L-9A26-T2: danh sách ở đây chỉ gồm học sinh lớp này/)).toHaveClass("sr-only");

    expect(within(rowOf("B3")).getByRole("link", { name: /^Mở buổi buổi B3 / })).toBeInTheDocument();
    expect(rowOf("B3")).toHaveTextContent("Không có học sinh trong danh sách");
    expect(rowOf("B3")).not.toHaveTextContent("0/0");

    expect(within(rowOf("B4")).getByRole("link", { name: /^Điểm danh buổi B4 / })).toHaveAttribute("href", "/sessions/s-incomplete");

    cleanup();
    renderPage({ canLockSessions: false, initialTab: "sessions", workspace: withRows(readinessRows) });
    table = screen.getByRole("table", { name: "Buổi học của lớp" });
    expect(within(table).queryByRole("link", { name: /^Khóa buổi / })).not.toBeInTheDocument();
    expect(within(table).getByRole("link", { name: /^Mở buổi buổi B1 / })).toHaveAttribute("href", "/sessions/s-complete");
  });

  // Value: protects=a class whose component link starts later is already treated as a composite parent: no schedule create/replace/end or batch link, and the notice says from when each future component applies;
  // fails_when=a future-only link still shows "Thay đổi lịch", "Kết thúc lịch", "Thêm lịch học" or "Tạo buổi hàng loạt", or the future component has no "từ dd/mm/yyyy" while a started one gets one;
  // why_new=componentClasses now includes future links (the DB rejects overlapping templates and sessions from effective_from);
  // seam=none; no_claim=does not prove which dates the database accepts before the link starts
  it("treats a future component link as composite and dates it in the notice", () => {
    const activeSchedule: ClassScheduleReadModel = {
      componentCode: null,
      effectiveFrom: "2026-09-07",
      effectiveTo: null,
      endReason: null,
      endTime: "21:30:00",
      id: "schedule-1",
      isActive: true,
      learningMode: "offline",
      meetingUrl: null,
      roomName: "P.101",
      startTime: "19:30:00",
      weekday: 2,
    };
    const base = { activeScheduleCount: 1, schedules: [activeSchedule], weeklySessionCount: 2 };
    const futureComposite = buildDetail({
      ...base,
      componentClasses: [
        { code: "L-9A26-T2", effectiveFrom: "2026-09-07", id: "component-1", name: "Toán 9 ghép thứ 2" },
        { code: "L-9A26-T5", effectiveFrom: "2026-10-27", id: "component-2", name: "Toán 9 ghép thứ 5" },
      ],
    });

    renderPage({ canManageSchedule: true, detail: futureComposite });
    expect(screen.getByText("từ 27/10/2026")).toBeInTheDocument();
    expect(screen.queryByText("từ 07/09/2026")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thay đổi lịch|Chưa thể thay đổi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kết thúc lịch|Chưa thể kết thúc/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm lịch học" })).not.toBeInTheDocument();

    cleanup();
    renderPage({ canManageSchedule: true, detail: futureComposite, initialTab: "sessions" });
    expect(screen.queryByRole("link", { name: /Tạo buổi hàng loạt/ })).not.toBeInTheDocument();

    // Control: the same class without links keeps its schedule actions and batch link.
    cleanup();
    renderPage({ canManageSchedule: true, detail: buildDetail(base) });
    expect(screen.getByRole("button", { name: /Thay đổi lịch|Chưa thể thay đổi/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kết thúc lịch|Chưa thể kết thúc/ })).toBeInTheDocument();
  });

  // Value: protects=after archiving, which leaves the "…" menu without items, focus moves to the success banner instead of the trigger that is about to unmount; other transitions keep focus on the trigger;
  // fails_when=focus stays on the menu trigger after archiving (lost to <body> once the refresh removes it), or a transition that keeps menu items steals focus to the banner;
  // why_new=design review: keyboard users lost their place after archiving a class;
  // seam=changeClassStatusAction is mocked and router.refresh does not re-render; no_claim=does not prove screen reader announcement order
  it("moves focus to the status banner when archiving leaves no menu items", async () => {
    mocks.changeClassStatusAction.mockResolvedValue({ message: "Đã lưu trữ lớp.", status: "success" });
    renderPage({ detail: buildDetail({ status: "closed" }) });

    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động cho lớp" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Lưu trữ lớp/ }));
    const dialog = screen.getByRole("dialog", { name: "Lưu trữ lớp học" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do đổi trạng thái/ }), { target: { value: "Hết năm học" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận lưu trữ" }));

    const banner = await screen.findByText("Đã lưu trữ lớp.");
    const focusTarget = banner.closest<HTMLElement>('[tabindex="-1"]');
    expect(focusTarget).not.toBeNull();
    await waitFor(() => expect(focusTarget).toHaveFocus());

    // Control: closing an active class leaves "Lưu trữ lớp" in the menu, so focus returns to its trigger.
    cleanup();
    mocks.changeClassStatusAction.mockResolvedValue({ message: "Đã đóng lớp.", status: "success" });
    renderPage({ detail: buildDetail({ status: "active" }) });
    const trigger = screen.getByRole("button", { name: "Thêm hành động cho lớp" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: /Đóng lớp/ }));
    const closeDialog = screen.getByRole("dialog", { name: "Đóng lớp học" });
    fireEvent.change(within(closeDialog).getByRole("textbox", { name: /Lý do đổi trạng thái/ }), { target: { value: "Hết năm học" } });
    fireEvent.click(within(closeDialog).getByRole("button", { name: "Xác nhận đóng lớp" }));
    await screen.findByText("Đã đóng lớp.");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  // Value: protects=the header back link and the online-room link keep 44px touch targets below md;
  // fails_when=the links lose min-h-11 or apply it on desktop too;
  // why_new=design review: both links were under 44px on phones;
  // seam=none; no_claim=does not prove the rendered height (jsdom has no layout)
  it("gives the back link and the online-room link 44px touch targets below md", () => {
    const online: ClassScheduleReadModel = {
      componentCode: null,
      effectiveFrom: "2026-09-07",
      effectiveTo: null,
      endReason: null,
      endTime: "21:30:00",
      id: "schedule-online",
      isActive: true,
      learningMode: "online",
      meetingUrl: "https://meet.example.com/room",
      roomName: null,
      startTime: "19:30:00",
      weekday: 2,
    };
    renderPage({ detail: buildDetail({ activeScheduleCount: 1, schedules: [online] }) });
    expect(screen.getByRole("link", { name: "Danh sách lớp" })).toHaveClass("min-h-11", "md:min-h-8");
    expect(screen.getByRole("link", { name: "Mở phòng học trực tuyến (thẻ mới)" })).toHaveClass("min-h-11", "md:min-h-8");
  });
});

describe("ClassDetailPage enroll search", () => {
  const remoteStudent = { fullName: "Ngô Gia Huy", grade: 9, id: "student-huy", lifecycleStatus: "trial", publicCode: "HS27100", registeredMode: "offline" as const };
  const preloadedNgoc = { fullName: "Hoàng Bảo Ngọc", grade: 9, id: "student-ngoc", lifecycleStatus: "trial", publicCode: "HS27001", registeredMode: "online" as const };

  /** What the server's `ilike '%q%'` on name or code returns: case-insensitive but accent-sensitive. */
  function ilikeResult(query: string, pool = [preloadedNgoc, remoteStudent]) {
    const needle = query.toLowerCase();
    return {
      candidates: pool.filter((candidate) => candidate.fullName.toLowerCase().includes(needle) || candidate.publicCode.toLowerCase().includes(needle)),
      status: "success" as const,
      truncated: false,
    };
  }

  // Value: protects=typing two or more characters searches every candidate on the server, only the latest response is shown, and a remote result can be enrolled;
  // fails_when=the dialog only filters the preloaded list, a slow earlier response overwrites a newer one, one character already calls the server, or the chosen remote student is not sent;
  // why_new=the dialog searched only the first 500 preloaded candidates; the mocked results now follow accent-sensitive ILIKE (accented queries);
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

    fireEvent.change(search, { target: { value: "ngô" } });
    await waitFor(() => expect(mocks.searchEnrollmentCandidatesAction).toHaveBeenCalledWith("ngô"));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Đang tìm trong toàn bộ học sinh");
    fireEvent.change(search, { target: { value: "ngô gia" } });
    await waitFor(() => expect(mocks.searchEnrollmentCandidatesAction).toHaveBeenCalledWith("ngô gia"));

    await act(async () => second.resolve(ilikeResult("ngô gia")));
    expect(await within(dialog).findByRole("radio", { name: /Ngô Gia Huy/ })).toBeInTheDocument();
    await act(async () => first.resolve({ candidates: [{ ...remoteStudent, fullName: "Kết quả cũ", id: "stale" }], status: "success", truncated: false }));
    expect(within(dialog).queryByText("Kết quả cũ")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: /Ngô Gia Huy/ }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do thao tác/ }), { target: { value: "Đăng ký" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ghi danh Ngô Gia Huy" }));
    await waitFor(() => expect(mocks.enrollStudentInClassAction).toHaveBeenCalledWith(expect.objectContaining({ studentId: "student-huy" })));
  });

  // Value: protects=an accentless query keeps the preloaded accent-insensitive matches when the accent-sensitive server search returns nothing, and server-only students are added after them;
  // fails_when=a ready server result replaces the local matches ("hoang" loses "Hoàng Bảo Ngọc"), or a server-only student is dropped or duplicated;
  // why_new=review finding: the list showed only server results once the search was ready;
  // seam=searchEnrollmentCandidatesAction is mocked with ILIKE semantics; no_claim=does not prove the real query is accent-sensitive
  it("keeps accentless local matches next to the server results", async () => {
    mocks.searchEnrollmentCandidatesAction.mockImplementation(async (query: string) => ilikeResult(query));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Ghi danh học sinh" }));
    const dialog = screen.getByRole("dialog", { name: "Ghi danh học sinh" });
    const search = within(dialog).getByRole("searchbox", { name: "Tìm học sinh theo tên hoặc mã" });

    fireEvent.change(search, { target: { value: "hoang" } });
    await waitFor(() => expect(mocks.searchEnrollmentCandidatesAction).toHaveBeenCalledWith("hoang"));
    await waitFor(() => expect(within(dialog).queryByRole("status")).not.toBeInTheDocument());
    expect(within(dialog).getByRole("radio", { name: /Hoàng Bảo Ngọc/ })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Không có học sinh khớp/)).not.toBeInTheDocument();

    // A code matches both the preloaded student and a server-only one: each shows once.
    fireEvent.change(search, { target: { value: "HS27" } });
    expect(await within(dialog).findByRole("radio", { name: /Ngô Gia Huy/ })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("radio", { name: /Hoàng Bảo Ngọc/ })).toHaveLength(1);
    expect(search).toHaveAttribute("maxLength", "100");
  });

  // Value: protects=a failed server search shows the action's own message (fixed retry text only for a thrown call) and keeps the preloaded matches usable;
  // fails_when=an error result's message is replaced by generic text, a thrown action leaves the dialog loading forever, or the list empties;
  // why_new=the server search is new; review found the returned message was dropped;
  // seam=searchEnrollmentCandidatesAction is mocked; no_claim=none
  it("shows a retry message when the server search fails", async () => {
    mocks.searchEnrollmentCandidatesAction
      .mockResolvedValueOnce({ message: "Tài khoản hiện tại không có quyền xem học sinh.", status: "error" })
      .mockRejectedValueOnce(new Error("offline"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Ghi danh học sinh" }));
    const dialog = screen.getByRole("dialog", { name: "Ghi danh học sinh" });
    const search = within(dialog).getByRole("searchbox", { name: "Tìm học sinh theo tên hoặc mã" });

    fireEvent.change(search, { target: { value: "hoang" } });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Tài khoản hiện tại không có quyền xem học sinh.");
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

  // Value: protects=an outside press that closes the menu returns focus to the trigger, unless the press lands on a control that takes focus itself;
  // fails_when=closing on an outside press drops focus to the body (the focused item unmounts), or the menu steals focus back from the input the user pressed;
  // why_new=design/red-team review: keyboard users restarted from the top after clicking away;
  // seam=none; no_claim=does not prove real browser mousedown focus order
  it("returns focus to the trigger after an outside press on plain content only", async () => {
    render(
      <>
        <p>Nội dung trang</p>
        <input aria-label="Ô tìm kiếm" />
        <ActionMenu items={items} label="Thêm hành động" onSelect={vi.fn()} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Thêm hành động" });

    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: /Bảo lưu/ })).toHaveFocus();
    fireEvent.pointerDown(screen.getByText("Nội dung trang"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: /Bảo lưu/ })).toHaveFocus();
    const input = screen.getByRole("textbox", { name: "Ô tìm kiếm" });
    fireEvent.pointerDown(input);
    input.focus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await act(() => new Promise((settle) => setTimeout(settle, 10)));
    expect(input).toHaveFocus();
  });

  // Value: protects=menu items keep a 44px touch target below md and their compact height on desktop;
  // fails_when=the item classes lose min-h-11 or apply it on desktop too;
  // why_new=design review: items were 36px on phones;
  // seam=none; no_claim=does not prove the rendered height (jsdom has no layout)
  it("gives menu items a 44px touch target below md", () => {
    render(<ActionMenu items={items} label="Thêm hành động" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động" }));
    for (const menuItem of screen.getAllByRole("menuitem")) {
      expect(menuItem).toHaveClass("min-h-11", "md:min-h-0");
    }
  });
});

describe("formatScheduleSummary", () => {
  const schedule = (weekday: number, startTime = "19:30:00"): ClassScheduleReadModel => ({
    componentCode: null,
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
    endReason: null,
    endTime: "21:30:00",
    id: `schedule-${weekday}-${startTime}`,
    isActive: true,
    learningMode: "offline",
    meetingUrl: null,
    roomName: null,
    startTime,
    weekday,
  });

  // Value: protects=the header never writes Sunday as a "Thứ": weekdays keep "Thứ 2-4", Sunday is spelled out after them;
  // fails_when=a mixed schedule reads "Thứ 2-CN" or "Thứ CN", or a Sunday-only class loses "Chủ nhật";
  // why_new=review finding: "Thứ 2-CN" was shown for classes meeting Monday and Sunday;
  // seam=none; no_claim=none
  it("keeps Sunday outside the Thứ prefix", () => {
    expect(formatScheduleSummary([schedule(1), schedule(0)])).toBe("Thứ 2, Chủ nhật, 19:30–21:30");
    expect(formatScheduleSummary([schedule(0)])).toBe("Chủ nhật, 19:30–21:30");
    expect(formatScheduleSummary([schedule(2), schedule(4), schedule(6)])).toBe("Thứ 3-5-7, 19:30–21:30");
    expect(formatScheduleSummary([schedule(1), schedule(0, "08:00:00")])).toBe("Thứ 2 19:30, Chủ nhật 08:00");
  });
});
