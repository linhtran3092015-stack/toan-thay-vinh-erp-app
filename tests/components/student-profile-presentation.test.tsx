import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudentPaymentsTab } from "@/features/students/detail/components/student-payments-tab";
import { StudentProfilePage } from "@/features/students/detail/student-profile-page";
import {
  summarizeAttendance,
  summarizePaymentRequests,
} from "@/features/students/detail/student-activity-models";
import type { StudentEnrollmentUiModel } from "@/features/students/enrollment/student-enrollment-ui-types";
import type { StudentDetailReadModel } from "@/features/students/read-models";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const enrollmentActions = vi.hoisted(() => ({
  endStudentEnrollmentAction: vi.fn(),
  enrollStudentInClassAction: vi.fn(),
  reserveStudentEnrollmentAction: vi.fn(),
  resumeStudentEnrollmentAction: vi.fn(),
  transferStudentClassAction: vi.fn(),
}));
vi.mock("@/features/students/enrollment/student-enrollment-actions", () => enrollmentActions);

afterEach(cleanup);

const classInfo = {
  code: "L-9A26",
  defaultLearningMode: "offline",
  grade: 9,
  id: "class-9a",
  level: "A" as const,
  name: "Toán 9A tối 2-4-6",
  status: "active",
};

const activeEnrollment = {
  classInfo,
  effectiveFrom: "2026-09-01",
  effectiveTo: null,
  endReason: null,
  id: "enr-1",
  registeredMode: "offline" as const,
  startReason: null,
  status: "active",
  transitionKind: "initial",
};

function buildDetail(overrides: Partial<StudentDetailReadModel> = {}): StudentDetailReadModel {
  return {
    activeEnrollment,
    activeSchedules: [
      { componentCode: null, effectiveFrom: "2026-09-01", endTime: "21:30:00", id: "sch-1", learningMode: "offline", meetingUrl: null, roomName: "Phòng 101", startTime: "19:30:00", weekday: 1 },
    ],
    birthYear: 2011,
    currentGrade: 9,
    enrollmentHistory: [activeEnrollment],
    fullName: "Nguyễn Minh Anh",
    guardians: [
      { email: null, fullName: "Nguyễn Văn Hải", id: "g-1", isPrimary: true, notes: null, phone: "0912 345 678", relationship: "Bố", zalo: null },
    ],
    id: "student-1",
    internalNotes: null,
    learningGoal: null,
    learningLevel: "A",
    lifecycleStatus: "active",
    nickname: null,
    officialStartDate: "2024-09-05",
    primaryGuardian: null,
    provinceCity: "Hà Nội",
    publicCode: "TTV-00123",
    registeredMode: "offline",
    ...overrides,
  };
}

const hidden = { enabled: false, reason: null, visible: false };
const allowed = { enabled: true, reason: null, visible: true };

function buildModel(overrides: Partial<StudentEnrollmentUiModel["actions"]> = {}): StudentEnrollmentUiModel {
  return {
    actions: { end: allowed, enroll: hidden, reserve: allowed, resume: hidden, transfer: { enabled: false, reason: "Chưa có lớp cùng khối còn chỗ.", visible: true }, ...overrides },
    activeEnrollment,
    businessDate: "2026-10-13",
    classOptions: [],
    classOptionsError: null,
    defaultRegisteredMode: "offline",
    latestEnrollment: activeEnrollment,
    transferClassOptions: [],
  };
}

const attendance = summarizeAttendance([
  { actualLearningMode: "offline", classCode: "L-9A26", classId: "class-9a", className: "Toán 9A tối 2-4-6", componentCode: null, id: "a-1", isLateUpdate: false, markedAt: "2026-10-12T14:00:00Z", notebookStatus: "submitted", notes: null, sessionDate: "2026-10-12", sessionId: "s-1", sessionLockedAt: "2026-10-12T15:00:00Z", startTime: "19:30:00", status: "present", testScore: 8.5 },
  { actualLearningMode: "offline", classCode: "L-9A26", classId: "class-9a", className: "Toán 9A tối 2-4-6", componentCode: null, id: "a-2", isLateUpdate: false, markedAt: "2026-10-10T14:00:00Z", notebookStatus: null, notes: null, sessionDate: "2026-10-10", sessionId: "s-2", sessionLockedAt: "2026-10-10T15:00:00Z", startTime: "19:30:00", status: "unexcused_absence", testScore: null },
  { actualLearningMode: "offline", classCode: "L-9A26", classId: "class-9a", className: "Toán 9A tối 2-4-6", componentCode: null, id: "a-3", isLateUpdate: false, markedAt: "2026-10-08T14:00:00Z", notebookStatus: "submitted", notes: null, sessionDate: "2026-10-08", sessionId: "s-3", sessionLockedAt: "2026-10-08T15:00:00Z", startTime: "19:30:00", status: "present", testScore: 7 },
  { actualLearningMode: "offline", classCode: "L-9A26", classId: "class-9a", className: "Toán 9A tối 2-4-6", componentCode: null, id: "a-4", isLateUpdate: false, markedAt: "2026-10-06T14:00:00Z", notebookStatus: "submitted", notes: null, sessionDate: "2026-10-06", sessionId: "s-4", sessionLockedAt: "2026-10-06T15:00:00Z", startTime: "19:30:00", status: "present", testScore: 9 },
]);

const payments = summarizePaymentRequests([
  { bonusSessions: 0, createdAt: "2026-09-27T02:00:00Z", expectedAmountVnd: 2_400_000, id: "pr-1", notes: null, paidAmountVnd: 0, paidAt: null, publicCode: "YC-2610-0187", purchasedSessions: 12, status: "pending", topupType: "renewal" },
  { bonusSessions: 0, createdAt: "2026-08-28T02:00:00Z", expectedAmountVnd: 2_600_000, id: "pr-2", notes: null, paidAmountVnd: 2_600_000, paidAt: "2026-08-29T08:31:00Z", publicCode: "YC-2609-0142", purchasedSessions: 13, status: "paid", topupType: "renewal" },
]);

const ledger = {
  alerts: [],
  balanceSessions: -1,
  entries: [
    { balanceAfter: -1, createdAt: "2026-10-12T14:52:00Z", deltaSessions: -1, effectiveOn: "2026-10-12", entryType: "session_charge", id: "l-1", note: "Khóa buổi B14", referenceCode: "B14", unitPriceVnd: 200_000 },
  ],
  latestEntryAt: "2026-10-12T14:52:00Z",
  ledgerEntryCount: 1,
  totalCreditSessions: 12,
  totalDebitSessions: 13,
};

const ownerProps = {
  attendance,
  canCreatePaymentRequest: true,
  canUpdateStudent: true,
  canViewAttendance: true,
  canViewCare: true,
  canViewClasses: true,
  canViewGuardians: true,
  canViewLedger: true,
  canViewPayments: true,
  canViewSessions: true,
  careCard: <p>Không có công việc chăm sóc đang mở.</p>,
  careTaskCount: 1,
  directoryHref: "/students",
  editHref: "/students/student-1/edit",
  ledgerSummary: ledger,
  payments,
  upcomingSession: { classCode: "L-9A26", className: "Toán 9A tối 2-4-6", endTime: "21:30:00", id: "s-9", learningMode: "offline", roomName: "Phòng 101", sessionDate: "2026-10-14", startTime: "19:30:00", status: "scheduled" },
};

describe("Student profile presentation (design 05)", () => {
  it("shows the header, KPI tiles and overflow actions for an active student with debt", () => {
    render(<StudentProfilePage {...ownerProps} detail={buildDetail()} enrollmentUiModel={buildModel()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Nguyễn Minh Anh" })).toBeInTheDocument();
    expect(screen.getByText("Nợ 1 buổi", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/Phụ huynh: Nguyễn Văn Hải \(Bố\) · 0912 345 678/)).toBeInTheDocument();

    const kpis = screen.getByRole("region", { name: "Chỉ số nhanh" });
    expect(within(kpis).getByText("75%")).toBeInTheDocument();
    expect(within(kpis).getByText("Nợ 1 buổi")).toBeInTheDocument();
    expect(within(kpis).getByText("2.400.000 ₫")).toBeInTheDocument();
    expect(within(kpis).getByText("Thứ 4 14/10 · 19:30")).toBeInTheDocument();

    // Active student: no enroll primary; consequential actions sit in the menu.
    expect(screen.queryByRole("button", { name: "Ghi danh vào lớp" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sửa hồ sơ" })).toHaveAttribute("href", "/students/student-1/edit");

    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Bảo lưu/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Chuyển lớp/ })).toHaveAttribute("aria-disabled", "true");
    expect(within(menu).getByText("Chưa có lớp cùng khối còn chỗ.")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Nghỉ học/ })).toBeInTheDocument();
  });

  it("switches tabs and keeps forbidden/empty states inside the work area", () => {
    render(<StudentProfilePage {...ownerProps} detail={buildDetail()} enrollmentUiModel={buildModel()} />);

    const tablist = screen.getByRole("tablist", { name: "Mục trong hồ sơ học sinh" });
    expect(within(tablist).getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
      "Lớp 1",
      "Điểm danh 4",
      "Thanh toán & số dư buổi 2 việc tồn",
      "Chăm sóc 1",
      "Lịch sử",
    ]);

    // Classes tab is open by default with the active class and its schedule.
    expect(screen.getByRole("link", { name: "Toán 9A tối 2-4-6" })).toHaveAttribute("href", "/classes/class-9a");
    expect(screen.getByText("Thứ 2")).toBeInTheDocument();

    fireEvent.click(within(tablist).getByRole("tab", { name: /Điểm danh/ }));
    const attendanceTable = screen.getByRole("table", { name: "Điểm danh của học sinh" });
    expect(within(attendanceTable).getAllByRole("row")).toHaveLength(5);
    expect(screen.getByRole("group", { name: "Lọc điểm danh theo lớp" }).parentElement).toHaveTextContent("Vắng không phép 1");

    fireEvent.click(within(tablist).getByRole("tab", { name: /Thanh toán/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Còn nợ 2.400.000 ₫.");
    expect(screen.getByRole("link", { name: "Tạo yêu cầu thanh toán" })).toHaveAttribute("href", "/finance/payment-requests/new");
    expect(screen.getByRole("table", { name: "Sổ cái số buổi học của học sinh" })).toBeInTheDocument();

    fireEvent.click(within(tablist).getByRole("tab", { name: "Lịch sử" }));
    expect(screen.getByText("Nhập lớp ban đầu · Toán 9A tối 2-4-6 · Tại lớp")).toBeInTheDocument();
  });

  it("offers the primary enroll action and empty class state for a student without a class", () => {
    const detail = buildDetail({ activeEnrollment: null, activeSchedules: [], enrollmentHistory: [], lifecycleStatus: "waiting_class", officialStartDate: null });
    const model = { ...buildModel({ end: hidden, enroll: allowed, reserve: hidden, transfer: hidden }), activeEnrollment: null, latestEnrollment: null };

    render(<StudentProfilePage {...ownerProps} attendance={summarizeAttendance([])} detail={detail} enrollmentUiModel={model} ledgerSummary={{ ...ledger, balanceSessions: 0, entries: [] }} payments={summarizePaymentRequests([])} upcomingSession={null} />);

    expect(screen.getAllByRole("button", { name: "Ghi danh vào lớp" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Thêm hành động" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Chỉ số nhanh" })).getByText("Chưa có lớp")).toBeInTheDocument();
    expect(screen.getByText("Chưa ghi danh lớp nào")).toBeInTheDocument();
  });

  it("hides money and guardian details from a teaching assistant", () => {
    render(
      <StudentProfilePage
        attendance={attendance}
        canUpdateStudent={false}
        canViewAttendance
        canViewClasses
        canViewGuardians={false}
        detail={buildDetail()}
        directoryHref="/students"
        editHref="/students/student-1/edit"
        enrollmentUiModel={buildModel({ end: hidden, reserve: hidden, transfer: hidden })}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Mục trong hồ sơ học sinh" });
    expect(within(tablist).queryByRole("tab", { name: /Thanh toán/ })).not.toBeInTheDocument();
    expect(within(tablist).queryByRole("tab", { name: /Chăm sóc/ })).not.toBeInTheDocument();
    expect(screen.getByText("Không có quyền xem phụ huynh (guardians.view).")).toBeInTheDocument();
    expect(screen.queryByText(/0912 345 678/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm hành động" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sửa hồ sơ" })).not.toBeInTheDocument();

    const kpis = screen.getByRole("region", { name: "Chỉ số nhanh" });
    expect(within(kpis).getAllByText("Không có quyền")).toHaveLength(3);
    expect(within(kpis).getByText("sessions.view")).toBeInTheDocument();
  });
});

// Generated by /ship test audit (Claude Fable 5.1) — 2026-10-12
// Value: protects=profile actions open the shared enrollment dialog only for enabled operations, the attendance tab narrows by class and surfaces a failed feed, and a deep-linked tab the user may not see falls back safely;
// fails_when=a disabled "Chuyển lớp" menu item opens the dialog, "Bảo lưu" opens nothing, a class chip leaves other classes' rows in the table, a null feed renders as "no absences", or ?tab=payments blanks the work area for a TA;
// why_new=design-05 cases assert the menu's attributes and the default tab contents only; none click a menu item, change the class chip, pass attendance=null, or set initialTab;
// seam=none; no_claim=does not prove the reserve/transfer server actions run (dialog submission is not exercised)
describe("Student profile interactions (design 05)", () => {
  it("opens the enrollment dialog from the overflow menu only for enabled operations", () => {
    render(<StudentProfilePage {...ownerProps} detail={buildDetail()} enrollmentUiModel={buildModel()} />);

    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động" }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: /Chuyển lớp/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: /Bảo lưu/ }));
    const dialog = screen.getByRole("dialog", { name: "Nguyễn Minh Anh" });
    expect(dialog).toHaveTextContent("Bảo lưu");
    expect(dialog).toHaveTextContent("Kết thúc lớp hiện tại và chuyển học viên sang trạng thái Bảo lưu.");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("narrows the attendance table by class chip and keeps the totals for the whole feed", () => {
    const twoClasses = summarizeAttendance([
      ...attendance.items,
      { actualLearningMode: "online", classCode: "L-8B", classId: "class-8b", className: "Toán 8B", componentCode: null, id: "a-5", isLateUpdate: false, markedAt: "2026-09-20T14:00:00Z", notebookStatus: null, notes: null, sessionDate: "2026-09-20", sessionId: "s-5", sessionLockedAt: null, startTime: "19:30:00", status: "excused_absence", testScore: null },
    ]);
    render(<StudentProfilePage {...ownerProps} attendance={twoClasses} detail={buildDetail()} enrollmentUiModel={buildModel()} initialTab="attendance" />);

    const chips = screen.getByRole("group", { name: "Lọc điểm danh theo lớp" });
    expect(within(chips).getAllByRole("button").map((button) => button.textContent)).toEqual(["Tất cả lớp5", "Toán 9A tối 2-4-64", "Toán 8B1"]);

    fireEvent.click(within(chips).getByRole("button", { name: /Toán 8B/ }));
    const table = screen.getByRole("table", { name: "Điểm danh của học sinh" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Toán 8B")).toBeInTheDocument();
    expect(screen.getByText(/Hiển thị 1\/1 buổi gần nhất · buổi chưa khóa có thể còn thay đổi/)).toBeInTheDocument();
    expect(chips.parentElement).toHaveTextContent("Có mặt 3 · Học thêm 0 · Vắng có phép 1 · Vắng không phép 1");

    fireEvent.click(within(chips).getByRole("button", { name: /Tất cả lớp/ }));
    expect(within(screen.getByRole("table", { name: "Điểm danh của học sinh" })).getAllByRole("row")).toHaveLength(6);
  });

  it("shows a failed attendance feed as unknown, never as a clean record", () => {
    render(<StudentProfilePage {...ownerProps} attendance={null} detail={buildDetail()} enrollmentUiModel={buildModel()} initialTab="attendance" />);

    const kpis = screen.getByRole("region", { name: "Chỉ số nhanh" });
    expect(within(kpis).getByText("—")).toBeInTheDocument();
    expect(within(kpis).getByText("chưa tải được")).toBeInTheDocument();
    expect(screen.getByText("Chưa tải được điểm danh; chưa thể kết luận học sinh có vắng hay không.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Lọc điểm danh theo lớp" })).not.toBeInTheDocument();
  });

  // Value: protects=a profile enrollment operation submits once with the student and reason, keeps a server error inside the open dialog, and on success closes it, shows the banner and refreshes;
  // fails_when=the header stops rendering operations.successMessage (silent success), an error closes the dialog, or the hook drops studentId/reason/date from the action call;
  // why_new=the hook moved out of StudentEnrollmentManagement and only dialog opening is tested; no test (base or branch) submitted the dialog; seam=none; no_claim=server-side reserve validation (action mocked)
  it("submits Bảo lưu from the profile, keeps an error in the dialog and announces success in the header", async () => {
    router.refresh.mockClear();
    enrollmentActions.reserveStudentEnrollmentAction
      .mockResolvedValueOnce({ message: "Lớp đã kín lịch bảo lưu.", status: "error" })
      .mockResolvedValueOnce({ message: "Đã bảo lưu học viên.", status: "success", studentId: "student-1" });
    render(<StudentProfilePage {...ownerProps} detail={buildDetail()} enrollmentUiModel={buildModel()} />);

    fireEvent.click(screen.getByRole("button", { name: "Thêm hành động" }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: /Bảo lưu/ }));
    fireEvent.change(screen.getByLabelText(/Lý do thao tác/), { target: { value: "Gia đình đi xa 2 tháng" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận bảo lưu" }));

    const dialog = screen.getByRole("dialog", { name: "Nguyễn Minh Anh" });
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Lớp đã kín lịch bảo lưu."));
    expect(enrollmentActions.reserveStudentEnrollmentAction).toHaveBeenCalledWith({ reason: "Gia đình đi xa 2 tháng", reservedFrom: "2026-10-13", studentId: "student-1" });
    expect(router.refresh).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận bảo lưu" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Đã bảo lưu học viên.")).toBeInTheDocument();
    expect(enrollmentActions.reserveStudentEnrollmentAction).toHaveBeenCalledTimes(2);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  // Generated by /ship test audit pass 2 (Claude Opus 5.5) — 2026-10-12
  // Value: protects=switching a profile tab writes ?tab=<value> in place (no new history entry) and keeps the directory filters in the query, so reload/share reopens that tab; fails_when=changeTab stops syncing the URL, pushes history entries, or drops the other query params; why_new=only the initialTab read side was tested; seam=none; no_claim=does not prove the route passes ?tab back as initialTab on reload (server route untested)
  it("writes the selected tab to the URL without adding history or losing the directory query", () => {
    window.history.replaceState(null, "", "/students/student-1?status=active&page=2");
    const historyLength = window.history.length;
    try {
      render(<StudentProfilePage {...ownerProps} detail={buildDetail()} enrollmentUiModel={buildModel()} />);
      const tablist = screen.getByRole("tablist", { name: "Mục trong hồ sơ học sinh" });

      fireEvent.click(within(tablist).getByRole("tab", { name: "Lịch sử" }));
      let params = new URLSearchParams(window.location.search);
      expect(window.location.pathname).toBe("/students/student-1");
      expect(params.get("tab")).toBe("history");
      expect(params.get("status")).toBe("active");
      expect(params.get("page")).toBe("2");

      fireEvent.click(within(tablist).getByRole("tab", { name: /Thanh toán/ }));
      params = new URLSearchParams(window.location.search);
      expect(params.getAll("tab")).toEqual(["payments"]);
      expect(window.history.length).toBe(historyLength);
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("falls back to the first visible tab when the deep-linked tab is hidden by permission", () => {
    render(
      <StudentProfilePage
        attendance={attendance}
        canUpdateStudent={false}
        canViewAttendance
        canViewClasses
        canViewGuardians={false}
        detail={buildDetail()}
        directoryHref="/students"
        editHref="/students/student-1/edit"
        enrollmentUiModel={buildModel({ end: hidden, reserve: hidden, transfer: hidden })}
        initialTab="payments"
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Mục trong hồ sơ học sinh" });
    expect(within(tablist).getByRole("tab", { name: /^Lớp/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Toán 9A tối 2-4-6" })).toBeVisible();
    expect(screen.queryByRole("table", { name: "Sổ cái số buổi học của học sinh" })).not.toBeInTheDocument();
  });
});

// Value: protects=back link keeps its accessible name with the icon and the payments tab caps rows with a visible count; fails_when=the ArrowLeft swap drops the link text or the slice/footer disappears; why_new=review-cycle behaviors not covered by the design-05 cases; seam=none; no_claim=visual icon rendering
describe("Student profile review fixes", () => {
  it("links back to the directory with an icon instead of a text arrow", () => {
    render(<StudentProfilePage {...ownerProps} detail={buildDetail()} enrollmentUiModel={buildModel()} />);

    const back = screen.getByRole("link", { name: "Danh sách học sinh" });
    expect(back).toHaveAttribute("href", "/students");
    expect(back.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("caps payment requests at the limit and says how many are shown", () => {
    render(<StudentPaymentsTab canCreatePaymentRequest={false} canViewPayments limit={1} payments={payments} />);

    expect(screen.getByText("YC-2610-0187")).toBeInTheDocument();
    expect(screen.queryByText("YC-2609-0142")).not.toBeInTheDocument();
    expect(screen.getByText("Hiển thị 1/2 yêu cầu")).toBeInTheDocument();
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
  });
});
