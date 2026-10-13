// Value: protects=the class page's students, results and fees tabs (step 5b part 2): each is hidden when its data is forbidden, the students chips filter by enrolment status, a student who joined today cannot be transferred or reserved yet (reason shown), the results tab reports missing scores, and an unlocked tuition period says so and names its blockers;
// fails_when=a forbidden feed still shows its tab, the default chip hides active students or the reserved chip does not reveal the reserved row, "Chuyển lớp"/"Bảo lưu" are enabled for an enrolment starting today, the missing-score count disappears, the draft banner is dropped, or a blocker code is shown raw;
// why_new=these tabs are new in step 5b part 2 and the workspace test only covers the overview and sessions tabs;
// seam=server actions and the router are mocked at module boundaries and the workspace is a fixture; no_claim=does not prove the loader fills the feeds correctly or that the transfer/reserve RPCs accept the dialog's input
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClassDetailPage } from "@/features/classes/class-detail-page";
import type { ClassDetailWorkspace } from "@/features/classes/detail/class-detail-data";
import { forbiddenClassDetailWorkspace, orderClassSessions, type ClassSessionRow } from "@/features/classes/detail/class-detail-models";
import { buildClassResultMatrix, type ClassEnrollmentRow } from "@/features/classes/detail/class-roster-models";
import { ClassTuitionTab } from "@/features/classes/detail/components/class-tuition-tab";
import type { ClassTuitionPeriodOption, ClassTuitionView } from "@/features/classes/detail/class-tuition-models";
import type { ClassDetailReadModel } from "@/features/classes/read-models";

const mocks = vi.hoisted(() => ({
  loadClassTuitionPeriodAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/classes/actions/class-tuition-actions", () => ({ loadClassTuitionPeriodAction: mocks.loadClassTuitionPeriodAction }));
vi.mock("@/features/students/enrollment/student-enrollment-actions", () => ({
  endStudentEnrollmentAction: vi.fn(),
  enrollStudentInClassAction: vi.fn(),
  reserveStudentEnrollmentAction: vi.fn(),
  resumeStudentEnrollmentAction: vi.fn(),
  transferStudentClassAction: vi.fn(),
}));
vi.mock("@/features/classes/actions/class-actions", () => ({ changeClassStatusAction: vi.fn() }));
vi.mock("@/features/classes/actions/class-enrollment-search-actions", () => ({ searchEnrollmentCandidatesAction: vi.fn() }));
vi.mock("@/features/sessions/actions/session-lifecycle-actions", () => ({ cancelClassSessionsAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TODAY = "2026-10-13";

const detail: ClassDetailReadModel = {
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
};

function enrollment(overrides: Partial<ClassEnrollmentRow> & Pick<ClassEnrollmentRow, "enrollmentId" | "fullName" | "studentId">): ClassEnrollmentRow {
  return {
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
    endReason: null,
    publicCode: null,
    registeredMode: "offline",
    status: "active",
    ...overrides,
  };
}

const enrollments: ClassEnrollmentRow[] = [
  enrollment({ enrollmentId: "e-an", fullName: "An", publicCode: "HS1", studentId: "a" }),
  enrollment({ effectiveFrom: TODAY, enrollmentId: "e-bao", fullName: "Bảo", publicCode: "HS2", studentId: "b" }),
  enrollment({ effectiveTo: "2026-09-20", enrollmentId: "e-cuc", fullName: "Cúc", publicCode: "HS3", status: "reserved", studentId: "c" }),
  enrollment({ effectiveTo: "2026-09-25", enrollmentId: "e-dung", fullName: "Dũng", publicCode: "HS4", status: "transferred", studentId: "d" }),
];

const completedSession: Omit<ClassSessionRow, "ordinal"> = {
  attendance: null,
  classCode: "L-9A26",
  classId: "class-1",
  componentCode: null,
  endTime: "21:30:00",
  id: "s1",
  learningMode: "offline",
  lockedAt: null,
  resultCount: null,
  roomName: "P.101",
  rosterCount: null,
  sessionDate: "2026-10-09",
  sessionKind: "regular",
  startTime: "19:30:00",
  status: "completed",
};

const activeStudents = [
  { fullName: "An", id: "a", publicCode: "HS1" },
  { fullName: "Bảo", id: "b", publicCode: "HS2" },
];

/** Both active students were present at the completed session and neither has a result: two missing cells. */
const resultMatrix = buildClassResultMatrix({
  activeStudents,
  attendance: [
    { attendance_status: "present", class_session_id: "s1", student_id: "a" },
    { attendance_status: "present", class_session_id: "s1", student_id: "b" },
  ],
  enrollments,
  results: [],
  sessions: orderClassSessions([completedSession]),
});

function readyWorkspace(overrides: Partial<ClassDetailWorkspace> = {}): ClassDetailWorkspace {
  return {
    ...forbiddenClassDetailWorkspace,
    balances: { status: "ready", value: { a: 3 } },
    enrollments: { status: "ready", value: enrollments },
    resultMatrix: { status: "ready", value: resultMatrix },
    studentDebts: { status: "ready", value: { a: { amountVnd: 1_200_000, overdue: true } } },
    students: { status: "ready", value: activeStudents },
    ...overrides,
  };
}

function renderPage(props: Partial<Parameters<typeof ClassDetailPage>[0]> = {}) {
  return render(
    <ClassDetailPage
      canEditClass
      canManageSchedule={false}
      canReserveStudents
      canViewStudentCount
      canTransferStudents
      detail={detail}
      nowTime="12:00"
      today={TODAY}
      transferClassOptions={[{ academicYearName: "2026–2027", code: "L-9B26", defaultLearningMode: "offline", grade: 9, id: "class-2", level: "A", name: "Toán 9B" }]}
      workspace={readyWorkspace()}
      {...props}
    />,
  );
}

const tablist = () => screen.getByRole("tablist", { name: "Mục trong lớp học" });
const studentsTable = () => screen.getByRole("table", { name: "Học sinh của lớp" });

const sepPeriod: ClassTuitionPeriodOption = { dueOn: "2026-10-10", endsOn: "2026-09-30", id: "period-sep", name: "Học phí tháng 9", startsOn: "2026-09-01", status: "locked" };
const octPeriod: ClassTuitionPeriodOption = { dueOn: null, endsOn: "2026-10-31", id: "period-oct", name: "Học phí tháng 10", startsOn: "2026-10-01", status: "draft" };

const draftView: ClassTuitionView = {
  paymentsVisible: false,
  period: octPeriod,
  rows: [
    {
      amountVnd: 0,
      blockers: ["MISSING_EFFECTIVE_TUITION_RATE"],
      fullName: "An",
      includesOtherCharges: false,
      itemAmountVnd: null,
      openingBalanceSessions: 0,
      payment: null,
      publicCode: "HS1",
      sessions: 2,
      studentId: "a",
    },
  ],
};

describe("ClassDetailPage students, results and fees tabs visibility", () => {
  // Value: protects=design 03's "hidden, not disabled" for the new tabs: a viewer without the data sees no tab, a viewer with it sees each, and a failed read keeps the tab with an error;
  // fails_when=a forbidden enrolments/results feed or an undefined tuition prop still renders a tab, a ready feed hides its tab, or a failed feed hides the tab instead of explaining;
  // why_new=the three tabs are new in step 5b part 2;
  // seam=none; no_claim=does not prove the route computes these props from the viewer's permissions
  it("hides each tab without its data and shows it with the data", () => {
    const { unmount } = renderPage({ workspace: forbiddenClassDetailWorkspace });

    expect(within(tablist()).queryByRole("tab", { name: /Học sinh/ })).not.toBeInTheDocument();
    expect(within(tablist()).queryByRole("tab", { name: /Kết quả/ })).not.toBeInTheDocument();
    expect(within(tablist()).queryByRole("tab", { name: /Học phí/ })).not.toBeInTheDocument();
    unmount();

    renderPage({ tuition: { initialPeriodId: "period-oct", initialView: draftView, periods: [octPeriod] } });

    // The students tab counts active students; the results tab flags the two missing cells.
    expect(within(tablist()).getByRole("tab", { name: /Học sinh/ })).toHaveTextContent("2");
    expect(within(tablist()).getByRole("tab", { name: /Kết quả/ })).toHaveTextContent("2");
    expect(within(tablist()).getByRole("tab", { name: /Học phí/ })).toBeInTheDocument();
  });

  it("hides only the fees tab when the tuition prop is undefined", () => {
    renderPage();

    expect(within(tablist()).getByRole("tab", { name: /Học sinh/ })).toBeInTheDocument();
    expect(within(tablist()).getByRole("tab", { name: /Kết quả/ })).toBeInTheDocument();
    expect(within(tablist()).queryByRole("tab", { name: /Học phí/ })).not.toBeInTheDocument();
  });

  it("keeps a tab whose read failed and explains it", () => {
    renderPage({
      tuition: null,
      workspace: readyWorkspace({
        enrollments: { reason: "failed", status: "unavailable" },
        resultMatrix: { reason: "failed", status: "unavailable" },
      }),
    });

    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học sinh/ }));
    expect(screen.getByText("Chưa tải được danh sách học sinh của lớp")).toBeInTheDocument();
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Kết quả/ }));
    expect(screen.getByText("Chưa tải được kết quả học tập của lớp")).toBeInTheDocument();
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học phí/ }));
    expect(screen.getByText("Chưa tải được danh sách kỳ thu")).toBeInTheDocument();
  });
});

describe("ClassStudentsTab", () => {
  const openStudentsTab = () => fireEvent.click(within(tablist()).getByRole("tab", { name: /Học sinh/ }));

  // Value: protects=the students tab opens on the active students and each chip shows its own enrolment status, with the balance and debt columns filled from the feeds;
  // fails_when=the default chip lists reserved or transferred students, the "Bảo lưu" chip does not show the reserved row, or the debt/balance values are not taken from the feeds;
  // why_new=step 5b part 2 added the tab and its chips;
  // seam=none; no_claim=does not prove the filter state survives a reload
  it("opens on Đang học and filters with the chips", () => {
    renderPage();
    openStudentsTab();

    const table = within(studentsTable());
    expect(table.getByRole("link", { name: "An" })).toHaveAttribute("href", "/students/a");
    expect(table.getByRole("link", { name: "Bảo" })).toBeInTheDocument();
    expect(table.queryByRole("link", { name: "Cúc" })).not.toBeInTheDocument();
    expect(table.queryByRole("link", { name: "Dũng" })).not.toBeInTheDocument();
    // Debt is the student's open debt across classes; overdue is called out.
    expect(table.getByText(/quá hạn/)).toBeInTheDocument();

    const chips = within(screen.getByRole("group", { name: "Lọc học sinh theo trạng thái ghi danh" }));
    expect(chips.getByRole("button", { name: /Đang học/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(chips.getByRole("button", { name: /Bảo lưu/ }));
    expect(within(studentsTable()).getByRole("link", { name: "Cúc" })).toBeInTheDocument();
    expect(within(studentsTable()).queryByRole("link", { name: "An" })).not.toBeInTheDocument();
    // Only active rows can be moved.
    expect(screen.queryByRole("button", { name: /Thao tác ghi danh cho/ })).not.toBeInTheDocument();

    fireEvent.click(chips.getByRole("button", { name: /Đã rời lớp/ }));
    expect(within(studentsTable()).getByRole("link", { name: "Dũng" })).toBeInTheDocument();
  });

  // Value: protects=the transfer and reserve RPCs only accept an enrolment that started before today, so the row menu offers both but disables them with the reason for a student who joined today;
  // fails_when="Chuyển lớp" or "Bảo lưu" is enabled for an enrolment starting today, the reason is not shown, or an earlier enrolment is blocked;
  // why_new=step 5b part 2 added row actions to the class students tab;
  // seam=transfer/reserve server actions are mocked; no_claim=does not prove the dialogs submit the right payload
  it("disables Chuyển lớp and Bảo lưu with a reason for a student who joined today", () => {
    renderPage();
    openStudentsTab();

    fireEvent.click(within(studentsTable()).getByRole("button", { name: "Thao tác ghi danh cho Bảo" }));
    const transfer = screen.getByRole("menuitem", { name: /Chuyển lớp/ });
    const reserve = screen.getByRole("menuitem", { name: /Bảo lưu/ });

    expect(transfer).toHaveAttribute("aria-disabled", "true");
    expect(reserve).toHaveAttribute("aria-disabled", "true");
    expect(within(transfer).getByText(/mới vào lớp hôm nay/)).toBeInTheDocument();
    expect(within(reserve).getByText(/mới vào lớp hôm nay/)).toBeInTheDocument();
    fireEvent.click(transfer);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("enables both actions for a student who joined before today", () => {
    renderPage();
    openStudentsTab();

    fireEvent.click(within(studentsTable()).getByRole("button", { name: "Thao tác ghi danh cho An" }));

    expect(screen.getByRole("menuitem", { name: /Chuyển lớp/ })).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("menuitem", { name: /Bảo lưu/ })).not.toHaveAttribute("aria-disabled");
  });

  // Value: protects=a roster row's Bảo lưu and Chuyển lớp submit carry the row's own enrolment id as expectedEnrollmentId, so a roster left open after the student moved is refused server-side instead of acting on the student's new class;
  // fails_when=the roster model stops passing activeEnrollment.id (the field is dropped or taken from another row), so the actions run without the stale-enrolment check;
  // why_new=the pre-landing review added expectedEnrollmentId; no test submitted a dialog from the class roster;
  // seam=transfer/reserve server actions are mocked; no_claim=does not prove the action refuses a stale id (student-enrollment-actions.test.ts)
  it.each([
    ["Bảo lưu", "Xác nhận bảo lưu", "reserveStudentEnrollmentAction", { reservedFrom: TODAY }],
    ["Chuyển lớp", "Xác nhận chuyển lớp", "transferStudentClassAction", { effectiveFrom: TODAY, targetClassId: "class-2" }],
  ] as const)("passes the row's enrolment id as expectedEnrollmentId when submitting %s", async (menuLabel, confirmLabel, actionName, extra) => {
    const actions = await import("@/features/students/enrollment/student-enrollment-actions");
    vi.mocked(actions[actionName]).mockResolvedValue({ message: "Xong.", status: "success", studentId: "a" } as never);
    renderPage();
    openStudentsTab();

    fireEvent.click(within(studentsTable()).getByRole("button", { name: "Thao tác ghi danh cho An" }));
    fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(menuLabel) }));
    fireEvent.change(screen.getByLabelText(/Lý do thao tác/), { target: { value: "Gia đình đổi chỗ ở" } });
    fireEvent.click(screen.getByRole("button", { name: confirmLabel }));

    await waitFor(() => expect(actions[actionName]).toHaveBeenCalledTimes(1));
    expect(actions[actionName]).toHaveBeenCalledWith(expect.objectContaining({ ...extra, expectedEnrollmentId: "e-an", reason: "Gia đình đổi chỗ ở", studentId: "a" }));
  });

  // Value: protects=when transfer targets failed to load or none exist, "Chuyển lớp" is disabled with the matching reason while "Bảo lưu" stays available;
  // fails_when=a null (failed) class list is treated as "no other class", an empty list leaves transfer enabled (empty dialog), or the reserve action is blocked by the class list;
  // why_new=the existing row-action tests always pass a non-empty transferClassOptions;
  // seam=none; no_claim=does not prove getTransferClassOptions filters active classes (route and loader mocked)
  it.each([
    [null, "Không tải được danh sách lớp đang hoạt động."],
    [[], "Không có lớp đang hoạt động khác để chuyển sang."],
  ])("disables only Chuyển lớp when transfer targets are %j", (transferClassOptions, reason) => {
    renderPage({ transferClassOptions });
    openStudentsTab();

    fireEvent.click(within(studentsTable()).getByRole("button", { name: "Thao tác ghi danh cho An" }));
    const transfer = screen.getByRole("menuitem", { name: /Chuyển lớp/ });

    expect(transfer).toHaveAttribute("aria-disabled", "true");
    expect(within(transfer).getByText(reason)).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Bảo lưu/ })).not.toHaveAttribute("aria-disabled");
  });

  // Value: protects=design 03 "hidden, not disabled" for the roster's balance and debt columns: forbidden feeds drop the columns, failed feeds keep them with "—" and say what failed;
  // fails_when=a viewer without session_ledger.view/payments.view still sees an empty column, or a failed read is shown as "Không nợ"/a zero balance with no notice;
  // why_new=the other students-tab tests use ready balance and debt feeds;
  // seam=none; no_claim=does not prove the loader maps permissions to these feed states (class-detail-data.test.ts)
  it("hides forbidden balance and debt columns and explains failed ones", () => {
    const forbidden = { reason: "forbidden", status: "unavailable" } as const;
    const failed = { reason: "failed", status: "unavailable" } as const;
    const { unmount } = renderPage({ workspace: readyWorkspace({ balances: forbidden, studentDebts: forbidden }) });
    openStudentsTab();

    expect(within(studentsTable()).queryByRole("columnheader", { name: "Số dư buổi" })).not.toBeInTheDocument();
    expect(within(studentsTable()).queryByRole("columnheader", { name: "Công nợ" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa tải được/)).not.toBeInTheDocument();
    unmount();

    renderPage({ workspace: readyWorkspace({ balances: failed, studentDebts: failed }) });
    openStudentsTab();

    expect(screen.getByText("Chưa tải được số dư buổi và công nợ; tải lại trang để thử lại.")).toBeInTheDocument();
    const table = within(studentsTable());
    expect(table.getByRole("columnheader", { name: "Số dư buổi" })).toBeInTheDocument();
    expect(table.getByRole("columnheader", { name: "Công nợ" })).toBeInTheDocument();
    expect(table.queryByText("Không nợ")).not.toBeInTheDocument();
    expect(table.queryByText(/quá hạn/)).not.toBeInTheDocument();
  });

  it("offers no row actions without the reserve and transfer permissions", () => {
    renderPage({ canReserveStudents: false, canTransferStudents: false });
    openStudentsTab();

    expect(screen.queryByRole("button", { name: /Thao tác ghi danh cho/ })).not.toBeInTheDocument();
  });

  // Value: protects=a class that is no longer active (closed) offers no transfer or reserve row actions even to a role holding both permissions;
  // fails_when=canTransfer/canReserve stop checking detail.status, so staff can move students out of a closed class from its roster;
  // why_new=the page gates the row actions on detail.status === "active" and no test used a non-active class;
  // seam=none; no_claim=does not prove the transfer/reserve RPCs reject a closed source class
  it("offers no row actions on a class that is not active", () => {
    renderPage({ detail: { ...detail, status: "closed" } });
    openStudentsTab();

    expect(within(studentsTable()).getByRole("link", { name: "An" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thao tác ghi danh cho/ })).not.toBeInTheDocument();
  });

  // Value: protects=a reserved student who resumed in another class is listed under "Đã rời lớp" with "Đã học lại lớp khác", not under "Bảo lưu";
  // fails_when=the students tab filters on status alone (the student still looks reserved here) or shows the plain "Bảo lưu" badge;
  // why_new=resumedElsewhere is new in the pre-landing review fixes;
  // seam=the enrolments feed is a fixture; no_claim=does not prove the loader sets the flag (class-detail-data.test.ts)
  it("lists a student who resumed in another class under Đã rời lớp", () => {
    const resumed = enrollment({ effectiveTo: "2026-09-20", enrollmentId: "e-em", fullName: "Em", resumedElsewhere: true, status: "reserved", studentId: "e" });
    renderPage({ workspace: readyWorkspace({ enrollments: { status: "ready", value: [...enrollments, resumed] } }) });
    openStudentsTab();

    const chips = within(screen.getByRole("group", { name: "Lọc học sinh theo trạng thái ghi danh" }));
    fireEvent.click(chips.getByRole("button", { name: /Bảo lưu/ }));
    expect(within(studentsTable()).getByRole("link", { name: "Cúc" })).toBeInTheDocument();
    expect(within(studentsTable()).queryByRole("link", { name: "Em" })).not.toBeInTheDocument();

    fireEvent.click(chips.getByRole("button", { name: /Đã rời lớp/ }));
    const row = within(studentsTable()).getByRole("link", { name: "Em" }).closest("tr") as HTMLElement;
    expect(within(row).getByText("Đã học lại lớp khác")).toBeInTheDocument();
    expect(within(row).queryByText("Bảo lưu")).not.toBeInTheDocument();
  });
});

describe("ClassResultsTab", () => {
  // Value: protects=the results tab tells the team how many present students still lack a result at a finished session;
  // fails_when=the missing count text is dropped or the count differs from the matrix, or an unread attendance feed claims everything is entered;
  // why_new=step 5b part 2 added the results tab;
  // seam=none; no_claim=does not prove the cell colours or paging
  it("reports the number of cells missing a result", () => {
    renderPage();
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Kết quả/ }));

    expect(screen.getByText("2 ô chưa nhập điểm")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa nhập").length).toBeGreaterThanOrEqual(2);
  });

  // Value: protects=a class with more than 8 started sessions opens on the newest 8 and the older/newer buttons page by 8, disabled at each end;
  // fails_when=the oldest sessions show first, a page skips or repeats columns, or a paging button stays enabled past the end;
  // why_new=the other results tests use a single session, so paging never ran;
  // seam=none; no_claim=does not prove the sticky name column or horizontal scrolling
  it("opens on the newest sessions and pages to older ones", () => {
    const sessions = Array.from({ length: 10 }, (_, index) => ({
      ...completedSession,
      id: `s${index + 1}`,
      ordinal: index + 1,
      sessionDate: `2026-09-${String(index + 1).padStart(2, "0")}`,
    }));
    const matrix = buildClassResultMatrix({ activeStudents, attendance: [], enrollments, results: [], sessions: orderClassSessions(sessions) });
    renderPage({ workspace: readyWorkspace({ resultMatrix: { status: "ready", value: matrix } }) });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Kết quả/ }));

    const table = () => within(screen.getByRole("table", { name: "Kết quả kiểm tra của học sinh theo buổi" }));
    const sessionHeaders = () => table().getAllByRole("link", { name: /^B\d+/ }).map((link) => link.getAttribute("href"));
    const older = screen.getByRole("button", { name: "Xem các buổi cũ hơn" });
    const newer = screen.getByRole("button", { name: "Xem các buổi mới hơn" });

    expect(screen.getByText("Buổi B3 – B10")).toBeInTheDocument();
    expect(sessionHeaders()).toEqual(["s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"].map((id) => `/sessions/${id}`));
    expect(newer).toBeDisabled();
    expect(older).toBeEnabled();

    fireEvent.click(older);
    expect(screen.getByText("Buổi B1 – B2")).toBeInTheDocument();
    expect(sessionHeaders()).toEqual(["/sessions/s1", "/sessions/s2"]);
    expect(older).toBeDisabled();
    expect(newer).toBeEnabled();

    fireEvent.click(newer);
    expect(screen.getByText("Buổi B3 – B10")).toBeInTheDocument();
  });

  // Value: protects=a gap at a locked session renders "—" (screen readers: "Không nhập") and is not counted, the tab then reports complete entry with the "chưa khóa" wording, and per-session averages sit in a final "Trung bình buổi" row;
  // fails_when=an unrecorded cell renders as a red "Chưa nhập" cell or blank, the missing count includes locked gaps, the completion copy is the old wording, or the averages row is dropped;
  // why_new=the review added the "unrecorded" cell, the new completion copy and the averages row;
  // seam=the matrix is built with the real buildClassResultMatrix; no_claim=does not prove the cell colours
  it("shows a locked gap as not entered and averages per session in the last row", () => {
    const lockedSession = { ...completedSession, lockedAt: "2026-10-10T00:00:00Z" };
    const matrix = buildClassResultMatrix({
      activeStudents,
      attendance: [
        { attendance_status: "present", class_session_id: "s1", student_id: "a" },
        { attendance_status: "present", class_session_id: "s1", student_id: "b" },
      ],
      enrollments,
      results: [{ class_session_id: "s1", student_id: "b", test_score: 8 }],
      sessions: orderClassSessions([lockedSession]),
    });
    renderPage({ workspace: readyWorkspace({ resultMatrix: { status: "ready", value: matrix } }) });

    expect(within(tablist()).getByRole("tab", { name: /Kết quả/ })).not.toHaveTextContent(/\d/);
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Kết quả/ }));

    const table = within(screen.getByRole("table", { name: "Kết quả kiểm tra của học sinh theo buổi" }));
    const anRow = within(table.getByRole("rowheader", { name: "An" }).closest("tr") as HTMLElement);
    const unrecorded = anRow.getByText("Không nhập");
    expect(unrecorded).toHaveClass("sr-only");
    expect(unrecorded.closest("td")).toHaveTextContent(/^KhóaKhông nhập$/);
    expect(anRow.queryByText("Chưa nhập")).not.toBeInTheDocument();
    expect(screen.queryByText(/ô chưa nhập điểm/)).not.toBeInTheDocument();
    expect(screen.getByText("Đã nhập đủ kết quả cho học sinh của lớp có mặt ở các buổi chưa khóa.")).toBeInTheDocument();

    const averages = within(table.getByRole("rowheader", { name: "Trung bình buổi" }).closest("tr") as HTMLElement);
    expect(averages.getByText("8,0")).toBeInTheDocument();
  });

  // Value: protects=the results tab always says the table lists only students enrolled in this class (extra-study students from other classes are absent) and names the 400-session cap only when the sessions feed was truncated;
  // fails_when=the "không có trong bảng" note is dropped or becomes conditional, the cap sentence shows for a complete feed, or it is missing (or shows the wrong limit) when the page's sessions feed is truncated;
  // why_new=the review added the note and ClassDetailPage passing workspace.sessions.value.truncated into ClassResultsTab;
  // seam=sessions feed is a fixture and the real ClassDetailPage wires truncated; no_claim=does not prove the loader sets truncated (class-detail-data.test.ts)
  it("always notes that extra-study students are not in the table and names the session cap only when truncated", () => {
    const notTruncated = { rows: orderClassSessions([completedSession]), truncated: false };
    const { unmount } = renderPage({ workspace: readyWorkspace({ sessions: { status: "ready", value: notTruncated } as ClassDetailWorkspace["sessions"] }) });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Kết quả/ }));

    expect(screen.getByText(/học sinh học thêm từ lớp khác không có trong bảng/)).toBeInTheDocument();
    expect(screen.queryByText(/chỉ tính 400 buổi mới nhất/)).not.toBeInTheDocument();
    unmount();

    renderPage({ workspace: readyWorkspace({ sessions: { status: "ready", value: { ...notTruncated, truncated: true } } as ClassDetailWorkspace["sessions"] }) });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Kết quả/ }));

    expect(screen.getByText(/học sinh học thêm từ lớp khác không có trong bảng/)).toBeInTheDocument();
    expect(screen.getByText(/Lớp có hơn 400 buổi: bảng và điểm trung bình chỉ tính 400 buổi mới nhất/)).toBeInTheDocument();
  });

  it("does not claim complete entry when attendance was not read", () => {
    const withoutAttendance = buildClassResultMatrix({
      activeStudents,
      attendance: null,
      enrollments,
      results: [],
      sessions: orderClassSessions([completedSession]),
    });
    renderPage({ workspace: readyWorkspace({ resultMatrix: { status: "ready", value: withoutAttendance } }) });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Kết quả/ }));

    expect(screen.queryByText(/chưa nhập điểm/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đã nhập đủ kết quả/)).not.toBeInTheDocument();
    expect(screen.getByText(/Không đọc được điểm danh/)).toBeInTheDocument();
  });
});

describe("ClassTuitionTab", () => {
  const tuition = { initialPeriodId: "period-oct", initialView: draftView, periods: [octPeriod, sepPeriod] };

  // Value: protects=the fees tab's pending badge counts students who still owe in a payments-visible period (paid/cancelled excluded), and a school with no period yet gets guidance and a link to the tuition periods page instead of an empty picker;
  // fails_when=paid or cancelled requests are counted, the badge shows without payments.view, periods=[] renders the tuition table or crashes, or the "Mở Kỳ thu học phí" link is dropped or points elsewhere;
  // why_new=the badge and the no-period branch were not exercised;
  // seam=none; no_claim=does not prove the route's default-period choice (class-detail-route.test.tsx)
  it("counts owing students on the tab and guides when there is no period", () => {
    const base = draftView.rows[0];
    const owingView: ClassTuitionView = {
      paymentsVisible: true,
      period: sepPeriod,
      rows: [
        { ...base, payment: { expectedVnd: 800_000, paidVnd: 300_000, status: "partially_paid" }, studentId: "a" },
        { ...base, fullName: "Bảo", payment: { expectedVnd: 500_000, paidVnd: 0, status: "pending" }, studentId: "b" },
        { ...base, fullName: "Cúc", payment: { expectedVnd: 500_000, paidVnd: 500_000, status: "paid" }, studentId: "c" },
        { ...base, fullName: "Dũng", payment: { expectedVnd: 500_000, paidVnd: 0, status: "cancelled" }, studentId: "d" },
      ],
    };
    const { unmount } = renderPage({ tuition: { initialPeriodId: "period-sep", initialView: owingView, periods: [sepPeriod] } });
    expect(within(tablist()).getByRole("tab", { name: /Học phí/ })).toHaveTextContent("2");
    unmount();

    const { unmount: unmountHidden } = renderPage({ tuition: { initialPeriodId: "period-sep", initialView: { ...owingView, paymentsVisible: false }, periods: [sepPeriod] } });
    expect(within(tablist()).getByRole("tab", { name: /Học phí/ })).not.toHaveTextContent(/\d/);
    unmountHidden();

    renderPage({ tuition: { initialPeriodId: "", initialView: null, periods: [] } });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học phí/ }));
    expect(screen.getByText(/Chưa có kỳ thu học phí nào/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Kỳ thu")).not.toBeInTheDocument();
    // The empty state points to where periods are created.
    expect(screen.getByRole("link", { name: "Mở Kỳ thu học phí" })).toHaveAttribute("href", "/finance/tuition-periods");
  });

  // Value: protects=an unlocked period is labelled as an estimate that bills every class on lock, and the lock blockers are shown in words;
  // fails_when=the "Kỳ thu chưa khóa" banner is missing for a draft period, or a blocker code is rendered raw instead of its label from tuitionBlockerLabels;
  // why_new=step 5b part 2 added the read-only tuition tab;
  // seam=the period-switch server action is mocked; no_claim=does not prove the preview numbers match the period page
  it("explains a draft period and labels its blockers", () => {
    renderPage({ tuition });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học phí/ }));

    expect(screen.getByText("Kỳ thu chưa khóa")).toBeInTheDocument();
    const table = within(screen.getByRole("table", { name: "Học phí của học sinh trong lớp theo kỳ thu" }));
    expect(table.getByText("Thiếu đơn giá có hiệu lực vào ngày học")).toBeInTheDocument();
    expect(table.queryByText("MISSING_EFFECTIVE_TUITION_RATE")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mở kỳ thu để khóa/ })).toHaveAttribute("href", "/finance/tuition-periods/period-oct");
  });

  it("loads another period through the action and drops the draft banner for a locked one", async () => {
    mocks.loadClassTuitionPeriodAction.mockResolvedValue({
      status: "success",
      view: {
        paymentsVisible: true,
        period: sepPeriod,
        rows: [
          {
            amountVnd: 800_000,
            blockers: [],
            fullName: "An",
            includesOtherCharges: false,
            itemAmountVnd: 800_000,
            openingBalanceSessions: null,
            payment: { expectedVnd: 800_000, paidVnd: 300_000, status: "partially_paid" },
            publicCode: "HS1",
            sessions: 4,
            studentId: "a",
          },
        ],
      } satisfies ClassTuitionView,
    });
    renderPage({ tuition });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học phí/ }));

    fireEvent.change(screen.getByLabelText("Kỳ thu"), { target: { value: "period-sep" } });

    // Shown in both the table and the narrow-screen list, with the finance module's label.
    await waitFor(() => expect(screen.getAllByText("Thanh toán một phần").length).toBeGreaterThan(0));
    expect(mocks.loadClassTuitionPeriodAction).toHaveBeenCalledWith("class-1", "period-sep");
    expect(screen.queryByText("Kỳ thu chưa khóa")).not.toBeInTheDocument();
  });

  // Value: protects=a period that was locked after the page loaded shows its locked layout (payments, no draft banner) once the switch returns it;
  // fails_when=the layout follows the stale period list shipped with the page instead of the freshly loaded view's status;
  // why_new=review pass 3 found the tab reading locked/draft from the page's period list only;
  // seam=the period-switch server action is mocked; no_claim=does not prove the action reads the period fresh (class-tuition-actions.test.ts)
  it("uses the loaded view's status when the period was locked after the page loaded", async () => {
    const staleSep = { ...sepPeriod, status: "draft" as const };
    mocks.loadClassTuitionPeriodAction.mockResolvedValue({
      status: "success",
      view: {
        paymentsVisible: true,
        period: sepPeriod,
        rows: [
          {
            amountVnd: 800_000,
            blockers: [],
            fullName: "An",
            includesOtherCharges: false,
            itemAmountVnd: 800_000,
            openingBalanceSessions: null,
            payment: { expectedVnd: 800_000, paidVnd: 300_000, status: "partially_paid" },
            publicCode: "HS1",
            sessions: 4,
            studentId: "a",
          },
        ],
      } satisfies ClassTuitionView,
    });
    renderPage({ tuition: { ...tuition, periods: tuition.periods.map((option) => (option.id === sepPeriod.id ? staleSep : option)) } });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học phí/ }));

    fireEvent.change(screen.getByLabelText("Kỳ thu"), { target: { value: "period-sep" } });

    await waitFor(() => expect(screen.getAllByText("Thanh toán một phần").length).toBeGreaterThan(0));
    expect(screen.queryByText("Kỳ thu chưa khóa")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở kỳ thu" })).toBeInTheDocument();
  });

  // Value: protects=a failed period switch says so instead of showing an empty table, and a slow earlier pick never overwrites the period the viewer picked last;
  // fails_when=an error result is rendered as an empty or stale table, or the requestRef guard is dropped so a late error for an abandoned period hides the current period's rows;
  // why_new=the existing switch test covers only one successful pick;
  // seam=the period-switch server action is mocked; no_claim=does not prove the action's own permission gate (class-tuition-actions.test.ts)
  it("shows a failed switch and ignores a slower earlier pick", async () => {
    renderPage({ tuition });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học phí/ }));
    const select = () => screen.getByLabelText("Kỳ thu");

    mocks.loadClassTuitionPeriodAction.mockResolvedValueOnce({ message: "Lỗi kỳ 9", status: "error" });
    fireEvent.change(select(), { target: { value: "period-sep" } });
    // isPending clears after the action settles: the message replaces the loading state in the table frame and the narrow-screen list.
    await waitFor(() => expect(screen.queryAllByText("Đang tải học phí của kỳ…")).toHaveLength(0));
    expect(screen.getAllByText("Lỗi kỳ 9")).toHaveLength(2);
    expect(screen.queryByText("Chưa tải được dữ liệu.")).not.toBeInTheDocument();

    // From September, pick October (slow), then September again (fast); October's late error must not win.
    const sepView: ClassTuitionView = {
      paymentsVisible: true,
      period: sepPeriod,
      rows: [{ ...draftView.rows[0], blockers: [], itemAmountVnd: 800_000, openingBalanceSessions: null, payment: { expectedVnd: 800_000, paidVnd: 300_000, status: "partially_paid" } }],
    };
    let settleOct: (value: unknown) => void = () => {};
    mocks.loadClassTuitionPeriodAction.mockReturnValueOnce(new Promise((resolve) => (settleOct = resolve)));
    mocks.loadClassTuitionPeriodAction.mockResolvedValueOnce({ status: "success", view: sepView });
    fireEvent.change(select(), { target: { value: "period-oct" } });
    fireEvent.change(select(), { target: { value: "period-sep" } });
    await act(async () => settleOct({ message: "Lỗi muộn", status: "error" }));

    await waitFor(() => expect(screen.getAllByText("Thanh toán một phần").length).toBeGreaterThan(0));
    expect(mocks.loadClassTuitionPeriodAction).toHaveBeenNthCalledWith(2, "class-1", "period-oct");
    expect(mocks.loadClassTuitionPeriodAction).toHaveBeenNthCalledWith(3, "class-1", "period-sep");
    expect(screen.queryByText("Lỗi muộn")).not.toBeInTheDocument();
    expect(screen.queryByText("Lỗi kỳ 9")).not.toBeInTheDocument();
  });

  // Value: protects=a period switch whose server action REJECTS (dropped request, stale action id after a deploy) stays inside the tab with a retry message, the page header stays, and the previous metrics stay visible but busy while the switch is pending;
  // fails_when=the rejection escapes startTransition to the page's error boundary (header and tabs gone), the message is not shown in the table frame and the list, or the metrics vanish while loading;
  // why_new=the review added the try/catch around loadClassTuitionPeriodAction and the pending summary; the existing failure test only covers a resolved error result;
  // seam=the period-switch server action is mocked; no_claim=does not prove how Next.js surfaces a stale action id
  it("keeps a rejected switch inside the tab and the previous metrics while pending", async () => {
    renderPage({ tuition });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học phí/ }));

    let rejectSep: (reason: unknown) => void = () => {};
    mocks.loadClassTuitionPeriodAction.mockReturnValueOnce(new Promise((_resolve, reject) => (rejectSep = reject)));
    fireEvent.change(screen.getByLabelText("Kỳ thu"), { target: { value: "period-sep" } });

    // Pending: October's metrics stay, marked busy.
    await waitFor(() => expect(screen.getByText("Học sinh có buổi tính phí").closest("dl")).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByText("Buổi dự kiến")).toBeInTheDocument();

    await act(async () => rejectSep(new Error("Failed to fetch")));

    await waitFor(() => expect(screen.getAllByText("Không kết nối được máy chủ để tải kỳ thu này; thử lại.")).toHaveLength(2));
    expect(screen.getByRole("heading", { level: 1, name: "Toán 9A tối 2-4-6" })).toBeInTheDocument();
    expect(within(tablist()).getByRole("tab", { name: /Học phí/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Học sinh có buổi tính phí")).not.toBeInTheDocument();
  });

  // Value: protects=a locked period with a reissued item says so under "Tổng phiếu" and explains that ticket columns are the current (reissued) ticket's, and the student metric counts only students charged sessions;
  // fails_when=the "đã phát hành lại" note or the explanation is dropped for a reissued row, or a zero-session row is counted in "Học sinh có buổi tính phí";
  // why_new=the review added row.reissued and changed studentCount to rows with sessions > 0;
  // seam=the initial view is a fixture; no_claim=does not prove the loader sets reissued (class-tuition-data.test.ts)
  it("notes a reissued ticket and counts only charged students", () => {
    const base = { ...draftView.rows[0], blockers: [], openingBalanceSessions: null };
    const lockedView: ClassTuitionView = {
      paymentsVisible: true,
      period: sepPeriod,
      rows: [
        { ...base, amountVnd: 400_000, itemAmountVnd: 350_000, payment: { expectedVnd: 350_000, paidVnd: 0, status: "pending" }, reissued: true, sessions: 2 },
        { ...base, amountVnd: 0, fullName: "Bảo", itemAmountVnd: 0, payment: null, reissued: false, sessions: 0, studentId: "b" },
      ],
    };
    renderPage({ tuition: { initialPeriodId: "period-sep", initialView: lockedView, periods: [sepPeriod] } });
    fireEvent.click(within(tablist()).getByRole("tab", { name: /Học phí/ }));

    const table = within(screen.getByRole("table", { name: "Học phí của học sinh trong lớp theo kỳ thu" }));
    expect(table.getAllByText("đã phát hành lại")).toHaveLength(1);
    expect(table.getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(screen.getByText(/phiếu phát hành lại nếu có/)).toBeInTheDocument();
    expect(screen.getByText("Học sinh có buổi tính phí").nextElementSibling).toHaveTextContent("1");
  });

  // Value: protects=a router refresh (e.g. after a transfer on the students tab) ships a new default-period view and the tab shows it, but never overwrites the period the viewer switched to;
  // fails_when=the tab keeps the view loaded at mount after initialView changes for the same period, or it replaces a switched-to period's rows with the refreshed default period's rows;
  // why_new=the review added the syncedInitialView adoption in ClassTuitionTab; before it a refresh left stale rows;
  // seam=the period-switch server action is mocked and ClassTuitionTab is rendered directly; no_claim=does not prove router.refresh re-runs the route's tuition loader
  it("adopts a refreshed initial view for the same period but not after the viewer switched period", async () => {
    const rowFor = (fullName: string, studentId: string) => ({ ...draftView.rows[0], fullName, studentId });
    const refreshedView: ClassTuitionView = { ...draftView, rows: [rowFor("Bảo", "b")] };
    const props = { classId: "class-1", initialPeriodId: "period-oct", periods: [octPeriod, sepPeriod] };
    const { rerender } = render(<ClassTuitionTab {...props} initialView={draftView} />);

    expect(screen.getAllByText("An").length).toBeGreaterThan(0);
    rerender(<ClassTuitionTab {...props} initialView={refreshedView} />);

    expect(screen.getAllByText("Bảo").length).toBeGreaterThan(0);
    expect(screen.queryByText("An")).not.toBeInTheDocument();

    // Switch to September, then another refresh of the default (October) view arrives.
    const sepView: ClassTuitionView = {
      paymentsVisible: true,
      period: sepPeriod,
      rows: [{ ...rowFor("Cúc", "c"), blockers: [], itemAmountVnd: 800_000, openingBalanceSessions: null, payment: { expectedVnd: 800_000, paidVnd: 300_000, status: "partially_paid" } }],
    };
    mocks.loadClassTuitionPeriodAction.mockResolvedValueOnce({ status: "success", view: sepView });
    fireEvent.change(screen.getByLabelText("Kỳ thu"), { target: { value: "period-sep" } });
    await waitFor(() => expect(screen.getAllByText("Cúc").length).toBeGreaterThan(0));

    rerender(<ClassTuitionTab {...props} initialView={{ ...draftView, rows: [rowFor("Dũng", "d")] }} />);

    expect(screen.getAllByText("Cúc").length).toBeGreaterThan(0);
    expect(screen.queryByText("Dũng")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Kỳ thu")).toHaveValue("period-sep");
  });
});
