"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ClassListPage } from "@/features/classes/class-list-page";
import type { ClassDirectoryItem } from "@/features/classes/read-models";
import type { StudentDirectoryItem } from "@/features/students/read-models";
import type { StudentDirectoryMetrics } from "@/features/students/student-directory-metrics";
import { StudentListPage } from "@/features/students/student-list-page";
import { GradingCreditListPage } from "@/features/grading-credits/grading-credit-list-page";
import { LearningResultsPage } from "@/features/learning-results/learning-results-page";
import { UnlockedSessionQueue } from "@/features/sessions/components/unlocked-session-queue";
import { SESSION_QUEUE_LIMIT } from "@/features/sessions/session-directory-models";
import { SessionListPage } from "@/features/sessions/session-list-page";
import type { PermissionCode } from "@/lib/permissions/types";
import type { StudentLifecycleStatus } from "@/types/domain";

import { advancePreviewPeople } from "./advance-fixtures";
import { AdvancesPreviewBody } from "./advances-preview";
import { AuditPreviewBody } from "./audit-preview";
import { CommissionsPreviewBody } from "./commissions-preview";
import { creditEntries, ownCreditEntries } from "./credit-fixtures";
import { FinanceOrdersPreviewBody } from "./finance-orders-preview";
import { getNotificationPreviewUnreadCount, NotificationsPreviewBody } from "./notifications-preview";
import { PaymentRequestsPreviewBody } from "./payment-requests-preview";
import { getListsPreviewPermissions } from "./preview-permissions";
import { ReportsPreviewBody } from "./reports-preview";
import { cappedResultItems, resultItems } from "./result-fixtures";
import { cappedPreviewSessionQueue, previewSessionQueue, previewSessions, sessionPreviewNowTime, sessionPreviewToday } from "./session-fixtures";
import { SessionLedgerPreviewBody } from "./session-ledger-preview";
import { StaffPreviewBody } from "./staff-preview";

export type ListsPreviewView =
  | "students"
  | "classes"
  | "sessions"
  | "results"
  | "credits"
  | "advances"
  | "staff"
  | "commissions"
  | "finance-orders"
  | "session-ledger"
  | "payment-requests"
  | "notifications"
  | "audit"
  | "reports";
export type ListsPreviewRole = "owner" | "ta" | "accountant";
export type ListsPreviewState = "normal" | "capped" | "empty";

const classNames = [
  "Toán 9A tối 2-4-6",
  "Toán 9B tối 3-5-7",
  "Toán 8B chiều 3-5-7",
  "Toán 7A chiều 2-4",
  "Toán 6A sáng 2-4-6",
];

const people: Array<[string, string, string, StudentLifecycleStatus, number]> = [
  ["Nguyễn Minh Anh", "Nguyễn Văn Hải", "0912 345 678", "active", 0],
  ["Trần Gia Bảo", "Trần Quốc Dũng", "0903 112 233", "reserved", 0],
  ["Lê Hoàng Nam", "Lê Thị Hương", "0978 445 566", "active", 0],
  ["Phạm Thu Hà", "Phạm Văn Toàn", "0966 778 899", "active", 1],
  ["Vũ Đức Huy", "Vũ Thị Nga", "0932 556 677", "active", 1],
  ["Đỗ Khánh Linh", "Đỗ Mạnh Cường", "0918 223 344", "waiting_class", 2],
  ["Bùi Quang Minh", "Bùi Thu Trang", "0975 334 455", "active", 2],
  ["Hoàng Ngọc Mai", "Hoàng Anh Tuấn", "0908 667 788", "withdrawn", 3],
  ["Ngô Tuấn Kiệt", "Ngô Thị Bích", "0944 889 900", "active", 3],
  ["Lý Nhật Quang", "Lý Văn Sơn", "0989 001 122", "active", 4],
  ["Đặng Hải Đăng", "Đặng Văn Lâm", "0911 222 333", "active", 0],
  ["Trịnh Bảo Châu", "Trịnh Thị Lan", "0922 333 444", "reserved", 1],
];

const students: StudentDirectoryItem[] = people.map(([fullName, guardian, phone, status, classIndex], index) => {
  const className = classNames[classIndex];
  const grade = Number(className.match(/Toán (\d+)/)?.[1] ?? 9);
  const hasClass = status !== "waiting_class" && status !== "withdrawn";

  return {
    activeEnrollment: hasClass
      ? {
          classInfo: {
            code: `L-${grade}A26`,
            defaultLearningMode: "offline",
            grade,
            id: `class-${classIndex}`,
            level: "A",
            name: className,
            status: "active",
          },
          effectiveFrom: "2026-09-01",
          effectiveTo: null,
          endReason: null,
          id: `enr-${index}`,
          registeredMode: index % 5 === 0 ? "online" : "offline",
          startReason: null,
          status: "active",
          transitionKind: "initial",
        }
      : null,
    birthYear: 2026 - grade - 6,
    currentGrade: grade,
    fullName,
    id: `student-${index}`,
    learningLevel: index % 3 === 0 ? "B" : "A",
    lifecycleStatus: status,
    nickname: null,
    primaryGuardian: {
      email: null,
      fullName: guardian,
      id: `guardian-${index}`,
      isPrimary: true,
      notes: null,
      phone,
      relationship: "Bố/Mẹ",
      zalo: null,
    },
    publicCode: `TTV-${String(100 + index * 7).padStart(5, "0")}`,
    registeredMode: "offline",
  };
});

// Design 06 sample values; index 5 (waiting for a class) has no attendance in the window.
const attendanceRates = [96, 71, 100, 89, 93, null, 84, 62, 97, 90, 100, 78];
const balances = [-1, 4, 7, 2, 5, 0, 9, 0, 3, 12, 6, 1];
const debts = [2_400_000, 0, 0, 2_400_000, 0, 0, 1_200_000, 0, 0, 0, 0, 600_000];
// Overdue = a pending request older than 14 days; the others are still within term.
const overdueDebt = new Set([0, 3]);

const studentMetrics: StudentDirectoryMetrics = {
  attendanceRate: {
    byStudentId: Object.fromEntries(
      attendanceRates.flatMap((rate, index) => (rate === null ? [] : [[`student-${index}`, rate]])),
    ),
    status: "ready",
  },
  balanceSessions: {
    byStudentId: Object.fromEntries(balances.map((value, index) => [`student-${index}`, value])),
    status: "ready",
  },
  outstandingVnd: {
    byStudentId: Object.fromEntries(
      debts.flatMap((value, index) =>
        value > 0 ? [[`student-${index}`, { amountVnd: value, overdue: overdueDebt.has(index) }]] : [],
      ),
    ),
    status: "ready",
  },
};

const year = { code: "2026-2027", endsOn: "2027-05-31", id: "year-1", isCurrent: true, name: "Năm học 2026–2027", startsOn: "2026-08-01", status: "active" };

const classRows: Array<[string, string, number, "A" | "B" | "CLC", "offline" | "online" | "hybrid", number, number, number | null, string]> = [
  ["Toán 9A tối 2-4-6", "L-9A26", 9, "A", "offline", 3, 3, 22, "active"],
  ["Toán 9B tối 3-5-7", "L-9B26", 9, "A", "offline", 3, 3, 20, "active"],
  ["Luyện thi vào 10 · T9C", "L-T9C26", 9, "CLC", "offline", 1, 1, 24, "active"],
  ["Toán 8B chiều 3-5-7", "L-8B26", 8, "B", "offline", 3, 3, 18, "active"],
  ["Toán 8A tối 2-4-6", "L-8A26", 8, "A", "offline", 3, 3, 20, "active"],
  ["Toán 7A chiều 2-4", "L-7A26", 7, "A", "offline", 2, 2, 15, "active"],
  ["Toán 6A sáng 2-4-6", "L-6A26", 6, "A", "offline", 3, 3, 16, "active"],
  ["Toán 10 nâng cao tối 2-6", "L-10NC26", 10, "CLC", "hybrid", 2, 2, 12, "active"],
  ["Toán 6B chiều 3-5", "L-6B26", 6, "B", "offline", 2, 0, 6, "draft"],
  ["Toán 7B online tối 3-5", "L-7BO26", 7, "A", "online", 2, 2, 9, "draft"],
  ["Toán 9A tối 2-4-6 (2025)", "L-9A25", 9, "A", "offline", 3, 0, null, "closed"],
];

const classes: ClassDirectoryItem[] = classRows.map(([name, code, grade, level, mode, weekly, schedules, count, status], index) => ({
  academicYear: year,
  activeScheduleCount: schedules,
  activeStudentCount: count,
  code,
  defaultLearningMode: mode,
  grade,
  id: `class-${index}`,
  level,
  name,
  notes: null,
  status,
  weeklySessionCount: weekly,
}));

const previewPathnames: Record<ListsPreviewView, string> = {
  advances: "/advances",
  audit: "/audit",
  classes: "/classes",
  commissions: "/commissions",
  credits: "/grading-credits",
  "finance-orders": "/finance/orders",
  notifications: "/notifications",
  "payment-requests": "/finance/payment-requests",
  reports: "/reports",
  results: "/learning-results",
  "session-ledger": "/finance/session-ledger",
  sessions: "/sessions",
  staff: "/staff",
  students: "/students",
};

// Shell users; the advances view uses the same people so "Đơn của bạn" is the signed-in user's row.
const previewShellUsers: Record<ListsPreviewRole, { displayName: string; email: string; id: string; initials: string }> = {
  accountant: { displayName: advancePreviewPeople.accountant.name, email: "hang@example.com", id: advancePreviewPeople.accountant.id, initials: "LH" },
  owner: { displayName: "Phạm Thu Hạnh", email: "hanh@example.com", id: "dev-user", initials: "PH" },
  ta: { displayName: "Trần Thu Hà", email: "ha@example.com", id: "grader-1", initials: "TH" },
};

export function ListsPreview({ role, state, view }: { role: ListsPreviewRole; state: ListsPreviewState; view: ListsPreviewView }) {
  const permissions = getListsPreviewPermissions(role, view, state);
  const can = (code: PermissionCode) => permissions.includes(code);
  // Same permission as the page's canViewAll, so rows and the grader column never disagree:
  // only the owner holds grading_credits.view_all. The accountant holds no grading_credits.view
  // at all (the real route denies it); the preview shows the own-scope layout with the TA's rows.
  const credits = state === "empty" ? [] : can("grading_credits.view_all") ? creditEntries : ownCreditEntries;
  // "capped": a full queue page (partial), so the newest completed session has no queue facts.
  const sessionQueue = state === "capped" ? cappedPreviewSessionQueue : previewSessionQueue;
  // "capped": the items fill the limit, so the panel says "N+" like the route at a full page;
  // the list's partial notice gets the same limit, so both name one number.
  const sessionQueueLimit = state === "capped" ? sessionQueue.items.length : SESSION_QUEUE_LIMIT;
  // The panel's "Lọc danh sách" stays on this preview (same role and state), never the real /sessions.
  const sessionListPath = `/dev/lists?view=sessions${role === "owner" ? "" : `&role=${role}`}${state === "normal" ? "" : `&state=${state}`}`;

  return (
    <AppShell
      authUser={
        view === "advances" && role === "owner"
          ? { displayName: advancePreviewPeople.owner.name, email: "vinh@example.com", id: advancePreviewPeople.owner.id, initials: "NV" }
          : previewShellUsers[role]
      }
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={previewPathnames[view]}
      // The notifications view gives the bell the fixture's own unread total, so the two never disagree.
      unreadNotificationCount={view === "notifications" ? getNotificationPreviewUnreadCount(role, state) : 4}
    >
      {view === "classes" ? (
        <ClassListPage canCreateClass canImportClasses classes={classes} />
      ) : view === "sessions" ? (
        // basePath: filter writes stay on /dev/lists, so a reload re-renders fixtures, never the real route.
        <SessionListPage
          basePath="/dev/lists"
          canLock={can("sessions.lock")}
          canManageSessions={can("sessions.manage")}
          canMarkAttendance={can("attendance.mark")}
          canViewAttendance={can("attendance.view")}
          canViewClasses={can("classes.view")}
          canViewResults={can("results.view")}
          loadedRange={{ dateFrom: null, dateTo: null }}
          nowTime={sessionPreviewNowTime}
          queueItems={state === "empty" ? [] : sessionQueue.items.map(({ id, missingAttendanceCount, rosterCount }) => ({ id, missingAttendanceCount, rosterCount }))}
          queuePanel={
            state === "empty" ? null : (
              <UnlockedSessionQueue
                canLock={can("sessions.lock")}
                canMarkAttendance={can("attendance.mark")}
                limit={sessionQueueLimit}
                listPath={sessionListPath}
                queue={sessionQueue}
                today={sessionPreviewToday}
              />
            )
          }
          queueLimit={sessionQueueLimit}
          queueStatus={state === "capped" ? "partial" : "ok"}
          sessions={state === "empty" ? [] : previewSessions}
          // The fixture clock, so "Hôm nay" and "Tuần này" never drift with the wall clock.
          today={sessionPreviewToday}
        />
      ) : view === "results" ? (
        <LearningResultsPage
          canViewSessions={can("sessions.view")}
          canViewStudents={can("students.view")}
          items={state === "empty" ? [] : state === "capped" ? cappedResultItems : resultItems}
        />
      ) : view === "advances" ? (
        <AdvancesPreviewBody role={role} state={state} />
      ) : view === "staff" ? (
        <StaffPreviewBody role={role} state={state} />
      ) : view === "commissions" ? (
        <CommissionsPreviewBody role={role} state={state} />
      ) : view === "finance-orders" ? (
        <FinanceOrdersPreviewBody role={role} state={state} />
      ) : view === "session-ledger" ? (
        <SessionLedgerPreviewBody role={role} state={state} />
      ) : view === "payment-requests" ? (
        <PaymentRequestsPreviewBody role={role} state={state} />
      ) : view === "notifications" ? (
        <NotificationsPreviewBody role={role} state={state} />
      ) : view === "audit" ? (
        // The shell's own codes decide the route's denial, so nav and body never disagree.
        <AuditPreviewBody permissions={permissions} role={role} state={state} />
      ) : view === "reports" ? (
        <ReportsPreviewBody permissions={permissions} role={role} />
      ) : view === "credits" ? (
        <GradingCreditListPage
          canViewAll={can("grading_credits.view_all")}
          canViewSessions={can("sessions.view")}
          entries={credits}
          // "capped": the loaded rows fill the limit, so older months only get a lower bound.
          limit={state === "capped" ? credits.length : undefined}
          // The same fixture clock, so the default month never drifts.
          today={sessionPreviewToday}
        />
      ) : (
        <StudentListPage canCreateStudent canImportStudents canManageStatus metrics={studentMetrics} students={students} />
      )}
    </AppShell>
  );
}
