"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ClassDetailPage, type ClassDetailTuition } from "@/features/classes/class-detail-page";
import type { ClassDetailWorkspace, ClassEnrollmentCandidate } from "@/features/classes/detail/class-detail-data";
import {
  orderClassSessions,
  type AbsenceStreak,
  type ClassSessionRow,
  type ClassStudentRef,
} from "@/features/classes/detail/class-detail-models";
import { buildClassResultMatrix, type ClassEnrollmentRow, type ClassResultEntry } from "@/features/classes/detail/class-roster-models";
import { CLASS_TUITION_PERMISSIONS, type ClassTuitionPeriodOption, type ClassTuitionView } from "@/features/classes/detail/class-tuition-models";
import type { ClassDetailReadModel, ClassScheduleReadModel } from "@/features/classes/read-models";
import { addDays, getVietnamToday } from "@/lib/datetime";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type ClassPreviewState = "active" | "unscheduled" | "draft" | "closed" | "composite";

const taPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "classes.view",
  "sessions.view",
  "sessions.manage",
  "attendance.view",
  "attendance.mark",
  "results.view",
  "results.manage",
  "students.view",
  "timekeeping.view",
  "timekeeping.check",
];

const schedules: ClassScheduleReadModel[] = [1, 3, 5].map((weekday) => ({
  componentCode: null,
  effectiveFrom: "2026-09-07",
  effectiveTo: null,
  endReason: null,
  endTime: "21:30:00",
  id: `schedule-${weekday}`,
  isActive: true,
  learningMode: "offline",
  meetingUrl: null,
  roomName: "P.101",
  startTime: "19:30:00",
  weekday,
}));

function buildDetail(state: ClassPreviewState, today: string): ClassDetailReadModel {
  const hasSchedule = state === "active";

  return {
    academicYear: {
      code: "NH2627",
      endsOn: "2027-05-31",
      id: "year-2627",
      isCurrent: true,
      name: "2026–2027",
      startsOn: "2026-09-01",
      status: "active",
    },
    activeScheduleCount: hasSchedule ? 3 : 0,
    activeStudentCount: state === "active" ? 22 : state === "unscheduled" ? 6 : 0,
    classinUrl: state === "active" ? "https://www.classin.com/" : null,
    code: state === "composite" ? "L-9G26" : "L-9A26",
    // A composite parent ("lớp ghép"): no schedule or sessions of its own. The second
    // link starts in two weeks, so the notice shows "từ dd/mm/yyyy" for it.
    componentClasses:
      state === "composite"
        ? [
            { code: "L-9A26-T2", effectiveFrom: "2026-09-07", id: "class-preview-component-1", name: "Toán 9 ghép · thứ 2" },
            { code: "L-9A26-T5", effectiveFrom: addDays(today, 14), id: "class-preview-component-2", name: "Toán 9 ghép · thứ 5" },
          ]
        : [],
    defaultLearningMode: "offline",
    grade: 9,
    id: "class-preview",
    level: "A",
    name: state === "unscheduled" ? "Toán 9B chiều 3-5" : state === "composite" ? "Toán 9 ghép 2-5" : "Toán 9A tối 2-4-6",
    notes: state === "active" ? "Lớp ôn thi vào 10, ưu tiên đề tổng hợp từ tháng 3." : null,
    schedules: hasSchedule
      ? schedules
      : state === "closed"
        ? schedules.map((schedule) => ({ ...schedule, effectiveTo: "2026-06-30", endReason: "Kết thúc năm học", isActive: false }))
        : [],
    status: state === "unscheduled" || state === "composite" ? "active" : state,
    weeklySessionCount: state === "composite" ? 2 : 3,
  };
}

const presentBySession = [21, 22, 20, 22, 19, 21, 22, 20, 16, 21, 21, 22, 22, 21, 20];

const students: ClassStudentRef[] = [
  "Nguyễn Minh Anh",
  "Trần Gia Bảo",
  "Lê Hoàng Châu",
  "Phạm Đức Duy",
  "Vũ Ngọc Hà",
  "Đỗ Khánh Linh",
].map((fullName, index) => ({ fullName, id: `student-${index + 1}`, publicCode: `HS26${String(index + 1).padStart(3, "0")}` }));

/** Mon/Wed/Fri sessions around today: 15 past (one awaiting lock), one cancelled, the rest ahead. */
function buildSessions(today: string): ClassSessionRow[] {
  const dates: string[] = [];
  let cursor = addDays(today, -40);

  while (dates.length < 36) {
    const weekday = new Date(`${cursor}T00:00:00Z`).getUTCDay();
    if (weekday === 1 || weekday === 3 || weekday === 5) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const past = dates.filter((date) => date < today);
  let presentIndex = 0;

  return orderClassSessions(
    dates.map((date, index) => {
      const isPast = date < today;
      const isLastPast = date === past.at(-1);
      const isCancelled = index === past.length + 2;
      const present = isPast && !isCancelled ? presentBySession[presentIndex++ % presentBySession.length] : 0;

      return {
        attendance: isPast ? { absent: isLastPast ? 22 - present - 1 : 22 - present, additional: index === 4 ? 1 : 0, present, unmarked: isLastPast ? 1 : 0 } : null,
        classCode: "L-9A26",
        classId: "class-preview",
        componentCode: null,
        endTime: "21:30:00",
        id: `session-${index + 1}`,
        learningMode: "offline",
        lockedAt: isPast && !isLastPast && index !== past.length - 2 ? `${date}T15:00:00Z` : null,
        resultCount: isPast ? Math.max(present - 1, 0) : null,
        roomName: "P.101",
        rosterCount: isPast ? 22 : null,
        sessionDate: date,
        sessionKind: index === 20 ? "makeup" : "regular",
        startTime: "19:30:00",
        status: isCancelled ? "cancelled" : isPast ? "completed" : "scheduled",
      };
    }),
  );
}

function buildWorkspace(state: ClassPreviewState, can: (code: PermissionCode) => boolean, today: string): ClassDetailWorkspace {
  const forbidden = { reason: "forbidden", status: "unavailable" } as const;

  if (state !== "active") {
    return {
      absenceStreaks: can("attendance.view") ? { status: "ready", value: [] } : forbidden,
      attendance: can("attendance.view") ? { status: "ready", value: true } : forbidden,
      debt: can("payments.view") ? { status: "ready", value: { outstandingVnd: 0, overdueStudentCount: 0, studentCount: 0 } } : forbidden,
      results: can("results.view") ? { status: "ready", value: true } : forbidden,
      sessions: can("sessions.view") ? { status: "ready", value: { rows: [], truncated: false } } : forbidden,
      students: can("students.view") ? { status: "ready", value: state === "unscheduled" ? students : [] } : forbidden,
      ...buildRosterFeeds(state === "unscheduled" ? students : [], [], can, today),
    };
  }

  const rows = buildSessions(today);
  const completed = rows.filter((row) => row.status === "completed");
  const lastOrdinals = completed.slice(-3).map((row) => row.ordinal ?? 0);
  const streaks: AbsenceStreak[] = [
    { count: 3, ordinals: lastOrdinals, student: students[1] },
    { count: 2, ordinals: lastOrdinals.slice(1), student: students[4] },
  ];
  const roster = Array.from({ length: 22 }, (_, index) =>
    students[index] ?? { fullName: `Học sinh ${index + 1}`, id: `student-${index + 1}`, publicCode: `HS26${String(index + 1).padStart(3, "0")}` },
  );

  return {
    absenceStreaks: can("attendance.view") && can("students.view") ? { status: "ready", value: streaks } : forbidden,
    attendance: can("attendance.view") ? { status: "ready", value: true } : forbidden,
    debt: can("payments.view") ? { status: "ready", value: { outstandingVnd: 9_600_000, overdueStudentCount: 1, studentCount: 4 } } : forbidden,
    results: can("results.view") ? { status: "ready", value: true } : forbidden,
    sessions: can("sessions.view")
      ? {
          status: "ready",
          value: {
            rows: rows.map((row) => ({
              ...row,
              attendance: can("attendance.view") ? row.attendance : null,
              resultCount: can("results.view") ? row.resultCount : null,
            })),
            truncated: false,
          },
        }
      : forbidden,
    students: can("students.view") ? { status: "ready", value: roster } : forbidden,
    ...buildRosterFeeds(roster, rows, can, today),
  };
}

const formerStudents: Array<Pick<ClassEnrollmentRow, "effectiveTo" | "endReason" | "fullName" | "resumedElsewhere" | "status">> = [
  { effectiveTo: null, endReason: "Gia đình đi công tác", fullName: "Ngô Thảo My", status: "reserved" },
  { effectiveTo: null, endReason: "Nghỉ ốm", fullName: "Lâm Quốc Bình", resumedElsewhere: true, status: "reserved" },
  { effectiveTo: "2026-09-30", endReason: "Chuyển sang lớp chiều", fullName: "Đặng Hải Nam", status: "transferred" },
  { effectiveTo: "2026-09-20", endReason: "Nghỉ học", fullName: "Bùi Thu Phương", status: "completed" },
];

/** Students, balances, debts and the results matrix built from the same fixture sessions. */
function buildRosterFeeds(
  roster: readonly ClassStudentRef[],
  rows: readonly ClassSessionRow[],
  can: (code: PermissionCode) => boolean,
  today: string,
): Pick<ClassDetailWorkspace, "balances" | "enrollments" | "resultMatrix" | "studentDebts"> {
  const forbidden = { reason: "forbidden", status: "unavailable" } as const;
  const enrollments: ClassEnrollmentRow[] = [
    ...roster.map((student, index) => ({
      // The third student joined today: transfer and reserve stay disabled with a reason.
      effectiveFrom: index === 2 ? today : "2026-09-07",
      effectiveTo: null,
      endReason: null,
      enrollmentId: `enrollment-${student.id}`,
      fullName: student.fullName,
      publicCode: student.publicCode,
      registeredMode: index === 5 ? ("online" as const) : ("offline" as const),
      status: "active" as const,
      studentId: student.id,
    })),
    ...(roster.length > 0
      ? formerStudents.map((student, index) => ({
          ...student,
          effectiveFrom: "2026-09-07",
          enrollmentId: `enrollment-former-${index + 1}`,
          publicCode: `HS25${String(index + 1).padStart(3, "0")}`,
          registeredMode: "offline" as const,
          studentId: `student-former-${index + 1}`,
        }))
      : []),
  ].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));

  const completed = rows.filter((row) => row.status === "completed");
  const attendance = completed.flatMap((row, sessionIndex) =>
    roster.map((student, studentIndex) => ({
      attendance_status: (sessionIndex * 7 + studentIndex) % 11 === 0 ? "unexcused_absence" : "present",
      class_session_id: row.id,
      student_id: student.id,
    })),
  );
  const results: ClassResultEntry[] = attendance
    .filter((entry, index) => {
      if (entry.attendance_status !== "present") return false;
      const sessionIndex = completed.findIndex((row) => row.id === entry.class_session_id);
      // The newest sessions still miss a few results (light-red cells).
      return !(sessionIndex >= completed.length - 2 && index % 9 === 0);
    })
    .map((entry, index) => ({
      class_session_id: entry.class_session_id,
      student_id: entry.student_id,
      test_score: index % 13 === 0 ? null : Math.min(10, 5 + ((index * 7) % 11) / 2),
    }));
  // A student who moved to another class keeps the scores of their early sessions.
  if (completed.length > 2 && roster.length > 0) {
    results.push(
      { class_session_id: completed[0].id, student_id: "student-former-2", test_score: 7.5 },
      { class_session_id: completed[1].id, student_id: "student-former-2", test_score: 8 },
    );
  }

  return {
    balances: can("students.view") && can("session_ledger.view")
      ? { status: "ready", value: Object.fromEntries(enrollments.map((row, index) => [row.studentId, [8, 3, 0, -1, 12][index % 5]])) }
      : forbidden,
    enrollments: can("students.view") ? { status: "ready", value: enrollments } : forbidden,
    resultMatrix:
      can("results.view") && can("sessions.view") && can("students.view")
        ? {
            status: "ready",
            value: buildClassResultMatrix({
              activeStudents: roster,
              attendance: can("attendance.view") ? attendance : null,
              enrollments,
              results,
              sessions: rows,
            }),
          }
        : forbidden,
    studentDebts: can("students.view") && can("payments.view")
      ? {
          status: "ready",
          value: {
            [roster[1]?.id ?? "none"]: { amountVnd: 2_400_000, overdue: true },
            [roster[3]?.id ?? "none"]: { amountVnd: 1_600_000, overdue: false },
            "student-former-1": { amountVnd: 800_000, overdue: false },
          },
        }
      : forbidden,
  };
}

const tuitionPeriods: ClassTuitionPeriodOption[] = [
  { dueOn: "2026-11-05", endsOn: "2026-11-30", id: "period-11", name: "Học phí tháng 11/2026", startsOn: "2026-11-01", status: "draft" },
  { dueOn: "2026-10-05", endsOn: "2026-10-31", id: "period-10", name: "Học phí tháng 10/2026", startsOn: "2026-10-01", status: "locked" },
  { dueOn: "2026-09-10", endsOn: "2026-09-30", id: "period-09", name: "Học phí tháng 9/2026", startsOn: "2026-09-07", status: "locked" },
];

function buildTuition(roster: readonly ClassStudentRef[], can: (code: PermissionCode) => boolean, draft: boolean): ClassDetailTuition | undefined {
  if (!CLASS_TUITION_PERMISSIONS.every((code) => can(code))) return undefined;

  const period = tuitionPeriods[draft ? 0 : 1];
  const paymentsVisible = !draft && can("payments.view");
  const view: ClassTuitionView = {
    paymentsVisible,
    period,
    rows: roster.slice(0, 12).map((student, index) => {
      const sessions = draft ? 13 : 13 - (index % 4 === 0 ? 2 : 0);
      const amountVnd = sessions * 200_000;
      const itemAmountVnd = index === 4 ? amountVnd + 1_600_000 : amountVnd;
      const paid = [itemAmountVnd, 0, itemAmountVnd / 2, 0][index % 4];

      return {
        amountVnd,
        blockers: draft && index === 3 ? ["MISSING_EFFECTIVE_TUITION_RATE"] : draft && index === 7 ? ["MISSING_PRIMARY_GUARDIAN"] : [],
        fullName: student.fullName,
        includesOtherCharges: !draft && index === 4,
        itemAmountVnd: draft ? null : itemAmountVnd,
        openingBalanceSessions: draft ? [2, 0, -1, 0][index % 4] : null,
        payment: paymentsVisible
          ? { expectedVnd: itemAmountVnd, paidVnd: paid, status: paid === itemAmountVnd ? "paid" : paid > 0 ? "partially_paid" : "pending" }
          : null,
        publicCode: student.publicCode,
        reissued: !draft && index === 5,
        sessions,
        studentId: student.id,
      };
    }),
  };

  return { initialPeriodId: period.id, initialView: view, periods: tuitionPeriods };
}

const candidates: ClassEnrollmentCandidate[] = [
  ["Hoàng Bảo Ngọc", 9],
  ["Ngô Gia Huy", 9],
  ["Bùi Thanh Tâm", 8],
  ["Đặng Quốc Khánh", 9],
  ["Lý Minh Thư", 7],
].map(([fullName, grade], index) => ({
  fullName: fullName as string,
  grade: grade as number,
  id: `candidate-${index + 1}`,
  lifecycleStatus: index < 2 ? "trial" : "interested",
  publicCode: `HS27${String(index + 1).padStart(3, "0")}`,
  registeredMode: index === 1 ? "online" : "offline",
}));

/**
 * Class detail preview mirroring `03-chi-tiet-lop.dc.html` with fixture data.
 * Buttons open the real dialogs; server actions would fail on fixture ids.
 */
export function ClassPreview({
  initialTab,
  role,
  state,
  tuitionPeriod = "locked",
}: {
  initialTab?: string;
  role: "owner" | "ta";
  state: ClassPreviewState;
  /** Which tuition period the fees tab opens on (switching periods calls the real action). */
  tuitionPeriod?: "draft" | "locked";
}) {
  const permissions = role === "ta" ? taPermissions : DATABASE_PERMISSION_CODES;
  const can = (code: PermissionCode) => permissions.includes(code);
  const today = getVietnamToday();
  const detail = buildDetail(state, today);
  const workspace = buildWorkspace(state, can, today);
  const roster = workspace.students.status === "ready" ? workspace.students.value : [];

  return (
    <AppShell
      authUser={{ displayName: role === "ta" ? "Lê Thu Trang" : "Phạm Thu Hạnh", email: "hanh@example.com", id: "dev-user", initials: role === "ta" ? "LT" : "PH" }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname="/classes/class-preview"
      unreadNotificationCount={4}
    >
      <ClassDetailPage
        canBulkCancelSessions={can("sessions.manage") && can("classes.manage_schedule")}
        canEditClass={can("classes.create")}
        canEnrollStudents={can("students.manage_status") && can("students.view")}
        canLockSessions={can("sessions.lock")}
        canReserveStudents={can("students.view") && can("students.reserve")}
        canTransferStudents={can("students.view") && can("students.transfer_class")}
        canManageSchedule={can("classes.manage_schedule")}
        canManageSessions={can("sessions.manage")}
        canViewCare={can("student_care.view")}
        canViewStudentCount={can("students.view")}
        detail={detail}
        enrollmentCandidates={{ candidates, truncated: false }}
        initialTab={initialTab}
        nowTime="12:00"
        today={today}
        transferClassOptions={[
          { academicYearName: "2026–2027", code: "L-9B26", defaultLearningMode: "offline", grade: 9, id: "class-preview-9b", level: "A", name: "Toán 9B chiều 3-5" },
        ]}
        tuition={buildTuition(roster, can, tuitionPeriod === "draft")}
        workspace={workspace}
      />
    </AppShell>
  );
}
