import { AppShell } from "@/components/layout/app-shell";
import { DashboardHome } from "@/features/dashboard/components/home/dashboard-home";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import {
  computeTuitionProgress,
  failedFeed,
  forbiddenFeed,
  getDashboardFeedAccess,
  getDashboardLayout,
  getWeekRange,
  readyFeed,
  type DashboardFeed,
  type DashboardHomeReadModel,
  type DashboardSessionRow,
} from "@/features/dashboard/home-models";
import type { AttentionItem, DashboardSectionState, RoleAwareDashboardReadModel } from "@/features/dashboard/read-models";
import { addDays, getVietnamToday } from "@/lib/datetime";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type DashboardPreviewRole = "owner" | "accountant" | "ta";
export type DashboardPreviewState = "normal" | "empty" | "errors";

const accountantPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "reports.view",
  "notifications.view",
  "students.view",
  "classes.view",
  "sessions.view",
  "finance.view",
  "payments.view",
  "payments.create_request",
  "sepay.view",
  "sepay.allocate",
  "sepay.accountant_confirm",
  "cashflow.view",
  "tuition_periods.view",
  "tuition_periods.manage",
  "session_ledger.view",
  "payroll.view",
  "payroll.accountant_reconcile",
  "timekeeping.check",
];

// Assumes a TA role granted classes.view in Cài đặt (seeds give it to owner
// only); without it the session blocks show "Chưa tải được" (hasHiddenClass).
const taPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "notifications.view",
  "classes.view",
  "sessions.view",
  "sessions.manage",
  "sessions.lock",
  "attendance.view",
  "attendance.mark",
  "results.view",
  "results.manage",
  "students.view",
  "timekeeping.view",
  "timekeeping.check",
];

const permissionsByRole: Record<DashboardPreviewRole, readonly PermissionCode[]> = {
  accountant: accountantPermissions,
  owner: DATABASE_PERMISSION_CODES,
  ta: taPermissions,
};

/** Wall clock of the fixture: mid-afternoon, so the schedule shows every session stage. */
const NOW_TIME = "16:05:00";

function session(
  today: string,
  id: string,
  start: string,
  end: string,
  className: string,
  classCode: string,
  room: string,
  status: DashboardSessionRow["status"],
  roster: number,
  recorded: number,
  locked = false,
): DashboardSessionRow {
  return {
    attendance: { absent: Math.min(1, recorded), additional: 0, present: Math.max(0, recorded - Math.min(1, recorded)), unmarked: roster - recorded },
    classCode,
    classId: `class-${id}`,
    className,
    endTime: `${end}:00`,
    id: `session-${id}`,
    learningMode: "offline",
    lockedAt: locked ? `${today}T05:00:00.000Z` : null,
    roomName: room,
    rosterCount: roster,
    sessionDate: today,
    startTime: `${start}:00`,
    status,
  };
}

function todayRows(today: string): DashboardSessionRow[] {
  return [
    session(today, "1", "08:00", "10:00", "Toán 6A sáng 2-4-6", "L-6A26", "P.102", "completed", 16, 16, true),
    session(today, "2", "10:15", "12:15", "Toán 7B sáng 2-4-6", "L-7B26", "P.102", "completed", 15, 14),
    session(today, "3", "13:30", "15:30", "Luyện thi vào 10 · T9C", "L-T9C26", "P.101", "scheduled", 20, 0),
    session(today, "4", "15:00", "17:00", "Toán 7A chiều 2-4", "L-7A26", "P.202", "in_progress", 15, 13),
    session(today, "5", "17:30", "19:30", "Toán 8B chiều 3-5-7", "L-8B26", "P.201", "scheduled", 18, 0),
    session(today, "6", "17:30", "19:30", "Toán 6B chiều 2-4-6", "L-6B26", "P.102", "scheduled", 14, 0),
    session(today, "7", "19:30", "21:30", "Toán 9A tối 2-4-6", "L-9A26", "P.101", "scheduled", 22, 0),
    session(today, "8", "19:30", "21:30", "Toán 8A tối 2-4-6", "L-8A26", "P.201", "scheduled", 20, 0),
    session(today, "9", "19:30", "21:30", "Toán 10 nâng cao tối 2-6", "L-10NC26", "P.202", "cancelled", 12, 0),
  ];
}

const attentionItems: AttentionItem[] = [
  { count: 1, description: "", href: "/payroll", id: "payroll-review", module: "Bảng lương", severity: "danger", title: "" },
  { count: 2, description: "", href: "/advances", id: "advances-pending", module: "Tạm ứng", severity: "warning", title: "" },
  { count: 5, description: "", href: "/finance", id: "payments-overdue", module: "Tài chính", severity: "danger", title: "" },
];

function gate<T>(allowed: boolean, feed: DashboardFeed<T>): DashboardFeed<T> {
  return allowed ? feed : forbiddenFeed;
}

/** The fixture model, gated with the loader's own access rules. */
function buildModel(role: DashboardPreviewRole, state: DashboardPreviewState, today: string): DashboardHomeReadModel {
  const permissions = permissionsByRole[role];
  const has = (code: PermissionCode) => permissions.includes(code);
  const access = getDashboardFeedAccess(permissions);
  const { weekEnd, weekStart } = getWeekRange(today);
  const empty = state === "empty";
  const errors = state === "errors";
  const pick = <T,>(normal: T, emptyValue: T, failsOnErrors = false): DashboardFeed<T> =>
    errors && failsOnErrors ? failedFeed : readyFeed(empty ? emptyValue : normal);

  const tuitionPeriod = { dueOn: addDays(today, 1), endsOn: addDays(today, 17), id: "period-preview", name: "tháng 10/2026", startsOn: addDays(today, -13), status: "locked" as const };
  const tuitionRequests = [
    ...Array.from({ length: 52 }, () => ({ expectedVnd: 6_000_000, paidVnd: 6_000_000, status: "paid" })),
    ...Array.from({ length: 18 }, () => ({ expectedVnd: 6_000_000, paidVnd: 0, status: "pending" })),
  ];

  return {
    awaitingLock: gate(access.awaitingLock, pick({ count: 3, truncated: false }, { count: 0, truncated: false })),
    careOverdue: gate(access.careOverdue, pick(1, 0)),
    crmFollowUps: gate(access.crmFollowUps, pick(2, 0)),
    executive: {
      attention: errors ? failedFeed : readyFeed(empty ? [] : attentionItems),
      receivablesAging: gate(
        has("finance.view") || has("payments.view"),
        pick(
          { collectedVnd: 0, from31To60DaysVnd: 25_400_000, items: [], over60DaysVnd: 13_000_000, totalReceivablesVnd: 146_400_000, under30DaysVnd: 108_000_000 },
          { collectedVnd: 0, from31To60DaysVnd: 0, items: [], over60DaysVnd: 0, totalReceivablesVnd: 0, under30DaysVnd: 0 },
        ),
      ),
      studentStatus: gate(
        has("students.view"),
        pick(
          { activeCount: 312, completedCount: 40, items: [], reservedCount: 3, totalCount: 380, waitingCount: 25 },
          { activeCount: 0, completedCount: 0, items: [], reservedCount: 0, totalCount: 0, waitingCount: 0 },
        ),
      ),
    },
    layout: getDashboardLayout(permissions),
    missingResults: gate(
      access.missingResults,
      pick(
        [{ classCode: "L-8B26", className: "Toán 8B chiều 3-5-7", id: "session-past-2", missing: 2, present: 18, sessionDate: addDays(today, -2), startTime: "17:30:00" }],
        [],
        true,
      ),
    ),
    myMonth: gate(access.myMonth, pick({ gpsShiftCount: 13, month: today.slice(0, 7), pendingAdjustmentCount: 1, shiftCount: 14, workedMinutes: 14 * 390 }, { gpsShiftCount: 0, month: today.slice(0, 7), pendingAdjustmentCount: 0, shiftCount: 0, workedMinutes: 0 }, true)),
    newLeads: gate(access.newLeads, pick(11, 0)),
    newStudents: gate(access.newStudents, pick(7, 0, true)),
    nowTime: NOW_TIME,
    permissions,
    sepay: gate(access.sepay, pick({ count: 3, oldestAt: `${today}T01:14:00.000Z`, totalIsPartial: false, totalVnd: 4_800_000 }, { count: 0, oldestAt: null, totalIsPartial: false, totalVnd: 0 }, true)),
    timekeeping: gate(
      access.timekeeping,
      pick(
        { lastCheckOutAt: null, openEntry: null, policy: { attendanceRadiusM: 100, centerName: "Cơ sở Cầu Giấy", configured: true, continuousGpsTrackingRequired: false, gpsMaxAccuracyM: 100, gpsRequiredForOffline: true, wifiRequiredForOffline: false } },
        { lastCheckOutAt: null, openEntry: { checkInAt: `${today}T07:58:00.000Z`, checkInMode: "offline", id: "entry-preview", workShiftName: "Ca chiều" }, policy: null },
        true,
      ),
    ),
    today,
    todaySessions: gate(access.todaySessions, pick({ rows: todayRows(today), truncated: false }, { rows: [], truncated: false }, true)),
    tuition: gate(access.tuition, pick(computeTuitionProgress(tuitionPeriod, tuitionRequests, today), null)),
    unmarked: gate(
      access.unmarked,
      pick(
        {
          items: [
            { classCode: "L-T9C26", className: "Luyện thi vào 10 · T9C", id: "session-3", reason: "not_started" as const, recorded: null, roster: null, sessionDate: today, startTime: "13:30:00" },
            { classCode: "L-9A26", className: "Toán 9A tối 2-4-6", id: "session-past-1", reason: "incomplete" as const, recorded: 20, roster: 22, sessionDate: addDays(today, -1), startTime: "19:30:00" },
            { classCode: "L-8A26", className: "Toán 8A tối 2-4-6", id: "session-past-2", reason: "not_completed" as const, recorded: null, roster: null, sessionDate: addDays(today, -2), startTime: "19:30:00" },
          ],
          truncated: false,
        },
        { items: [], truncated: false },
        true,
      ),
    ),
    upcomingSession: gate(access.todaySessions, readyFeed(null)),
    weekAttendance: gate(access.weekAttendance, pick({ absent: 70, present: 930 }, { absent: 0, present: 0 })),
    weekEnd,
    weekStart,
  };
}

const hidden = { status: "hidden" } as const;

function section<T>(allowed: boolean, data: T): DashboardSectionState<T> {
  return allowed ? { data, status: "ready" } : hidden;
}

/** A thin analytics fixture: enough to show where "Phân tích" sits under the new layout. */
function buildAnalytics(permissions: readonly PermissionCode[], today: string): RoleAwareDashboardReadModel {
  const has = (code: PermissionCode) => permissions.includes(code);
  const month = today.slice(0, 7);
  return {
    admissionsFunnel: hidden,
    advances: hidden,
    attention: { data: [], status: "ready" },
    availableMonths: [month, `${month.slice(0, 5)}${String(Number(month.slice(5)) - 1).padStart(2, "0")}`],
    availableYears: [Number(month.slice(0, 4))],
    coaching: hidden,
    finance: hidden,
    gradingCredits: hidden,
    kpis: section(has("finance.view"), {
      disbursementChangePercent: -5.2,
      disbursementVnd: 185_000_000,
      netCashflowChangePercent: 12.1,
      netCashflowVnd: 127_000_000,
      receivablesVnd: 146_400_000,
      revenueChangePercent: 8.4,
      revenueVnd: 312_000_000,
      totalStudents: 312,
      totalStudentsChangePercent: 2.3,
    }),
    lastUpdatedAt: `${today}T09:05:00.000Z`,
    operationalHighlights: { data: { activeClassesCount: 24, activeStaffCount: 14, closedCoachingCount: 6, completedSessionsCount: 186, gradingCreditUnits: 42 }, status: "ready" },
    payroll: hidden,
    payrollSummary: hidden,
    receivablesAging: hidden,
    revenueComposition: hidden,
    revenueTrend: hidden,
    selectedMonth: month,
    selectedYear: Number(month.slice(0, 4)),
    studentStatus: section(has("students.view"), {
      activeCount: 312,
      completedCount: 40,
      items: [
        { color: "#16794C", count: 312, key: "active", label: "Đang theo học", percentage: 82.1 },
        { color: "#C06A1B", count: 3, key: "reserved", label: "Bảo lưu / Tạm nghỉ", percentage: 0.8 },
        { color: "#667085", count: 40, key: "completed", label: "Đã hoàn thành / Nghỉ", percentage: 10.5 },
        { color: "#315FCC", count: 25, key: "waiting", label: "Chờ xếp lớp / Quan tâm", percentage: 6.6 },
      ],
      reservedCount: 3,
      totalCount: 380,
      waitingCount: 25,
    }),
    topClasses: hidden,
  };
}

/**
 * Home dashboard preview mirroring `02-tong-quan.dc.html` with fixture data
 * inside the shell. Buttons and links point at real routes; the timekeeping
 * dialog calls a real server action, so look only. The live payroll estimate
 * card is left out because it polls the real estimate endpoint.
 */
export function DashboardPreview({ role, state }: { role: DashboardPreviewRole; state: DashboardPreviewState }) {
  const today = getVietnamToday();
  const model = buildModel(role, state, today);
  const hrefBase = `/dev/dashboard?role=${role}&state=${state}`;

  return (
    <AppShell
      authUser={{
        displayName: role === "ta" ? "Lê Bích Ngọc" : role === "accountant" ? "Phạm Thu Hạnh" : "Nguyễn Văn Vinh",
        email: "preview@example.com",
        id: "dev-user",
        initials: role === "ta" ? "LN" : role === "accountant" ? "PH" : "NV",
      }}
      canCheckTimekeeping={model.permissions.includes("timekeeping.check")}
      centerDisplayName="Toán Thầy Vinh"
      permissions={model.permissions}
      previewPathname="/"
      unreadNotificationCount={role === "ta" ? 2 : 4}
    >
      <DashboardHome
        analytics={<DashboardPage dashboard={buildAnalytics(model.permissions, today)} hrefBase={hrefBase} />}
        centerDisplayName="Cơ sở Cầu Giấy"
        model={model}
        retryHref={hrefBase}
      />
    </AppShell>
  );
}
