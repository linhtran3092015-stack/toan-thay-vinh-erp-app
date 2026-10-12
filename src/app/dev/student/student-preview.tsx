"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ProfilePanel } from "@/features/students/detail/components/student-profile-shared";
import type {
  StudentAttendanceHistoryItem,
  StudentPaymentRequestItem,
  StudentUpcomingSession,
} from "@/features/students/detail/student-activity-models";
import { summarizeAttendance, summarizePaymentRequests } from "@/features/students/detail/student-activity-models";
import { StudentProfilePage } from "@/features/students/detail/student-profile-page";
import type { StudentEnrollmentUiModel } from "@/features/students/enrollment/student-enrollment-ui-types";
import type { StudentLedgerReadModel } from "@/features/students/ledger-data";
import type { StudentDetailReadModel, StudentEnrollmentReadModel } from "@/features/students/read-models";
import type { StudentTuitionProfile } from "@/features/students/tuition-profile-data";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type StudentPreviewState = "debt" | "clean" | "new" | "reserved";

const class9A = {
  code: "L-9A26",
  defaultLearningMode: "offline",
  grade: 9,
  id: "class-9a",
  level: "A" as const,
  name: "Toán 9A tối 2-4-6",
  status: "active",
};

const classT9C = {
  code: "L-T9C26",
  defaultLearningMode: "offline",
  grade: 9,
  id: "class-t9c",
  level: "CLC" as const,
  name: "Luyện thi vào 10 · T9C",
  status: "active",
};

const class8A = {
  code: "L-8A25",
  defaultLearningMode: "offline",
  grade: 8,
  id: "class-8a",
  level: "A" as const,
  name: "Toán 8A tối 2-4-6",
  status: "closed",
};

const activeEnrollment: StudentEnrollmentReadModel = {
  classInfo: class9A,
  effectiveFrom: "2026-09-01",
  effectiveTo: null,
  endReason: null,
  id: "enr-9a",
  registeredMode: "offline",
  startReason: null,
  status: "active",
  transitionKind: "resume",
};

const pastEnrollment: StudentEnrollmentReadModel = {
  classInfo: class8A,
  effectiveFrom: "2024-09-05",
  effectiveTo: "2025-05-30",
  endReason: "Kết thúc năm học",
  id: "enr-8a",
  registeredMode: "offline",
  startReason: null,
  status: "completed",
  transitionKind: "initial",
};

const reservedEnrollment: StudentEnrollmentReadModel = {
  ...activeEnrollment,
  effectiveTo: "2026-10-05",
  endReason: "Gia đình về quê đến hết tháng 11",
  id: "enr-9a-reserved",
  status: "reserved",
};

function buildDetail(state: StudentPreviewState): StudentDetailReadModel {
  const hasClass = state === "debt" || state === "clean";

  return {
    activeEnrollment: hasClass ? activeEnrollment : null,
    activeSchedules: hasClass
      ? [
          { componentCode: null, effectiveFrom: "2026-09-01", endTime: "21:30:00", id: "sch-1", learningMode: "offline", meetingUrl: null, roomName: "Phòng 101", startTime: "19:30:00", weekday: 1 },
          { componentCode: null, effectiveFrom: "2026-09-01", endTime: "21:30:00", id: "sch-2", learningMode: "offline", meetingUrl: null, roomName: "Phòng 101", startTime: "19:30:00", weekday: 3 },
          { componentCode: null, effectiveFrom: "2026-09-01", endTime: "21:30:00", id: "sch-3", learningMode: "offline", meetingUrl: null, roomName: "Phòng 101", startTime: "19:30:00", weekday: 5 },
        ]
      : [],
    birthYear: 2011,
    currentGrade: 9,
    enrollmentHistory:
      state === "new" ? [] : state === "reserved" ? [reservedEnrollment, pastEnrollment] : [activeEnrollment, pastEnrollment],
    fullName: "Nguyễn Minh Anh",
    guardians: [
      { email: null, fullName: "Nguyễn Văn Hải", id: "g-1", isPrimary: true, notes: null, phone: "0912 345 678", relationship: "Bố", zalo: "0912 345 678" },
      { email: "lan.tran@example.com", fullName: "Trần Thị Lan", id: "g-2", isPrimary: false, notes: null, phone: "0987 654 321", relationship: "Mẹ", zalo: null },
    ],
    id: "student-preview",
    internalNotes:
      state === "new"
        ? null
        : "Bố đi công tác đến 20/10, mẹ hẹn chuyển học phí sau 18/10.\nEm muốn chuyển sang ca tối 3-5-7 từ tháng 11 vì học thêm Anh.",
    learningGoal: "Thi vào 10 chuyên Toán",
    learningLevel: "A",
    lifecycleStatus: state === "new" ? "waiting_class" : state === "reserved" ? "reserved" : "active",
    nickname: "Mina",
    officialStartDate: state === "new" ? null : "2024-09-05",
    primaryGuardian: null,
    provinceCity: "Hà Nội",
    publicCode: "TTV-00123",
    registeredMode: "offline",
  };
}

function buildEnrollmentModel(state: StudentPreviewState, role: "owner" | "ta"): StudentEnrollmentUiModel {
  const may = role === "owner";
  const hasClass = state === "debt" || state === "clean";
  const hidden = { enabled: false, reason: null, visible: false };
  const allowed = { enabled: may, reason: may ? null : "Tài khoản không có quyền thực hiện nghiệp vụ này.", visible: true };

  return {
    actions: {
      end: hasClass ? allowed : hidden,
      enroll: state === "new" ? allowed : hidden,
      reserve: hasClass ? allowed : hidden,
      resume: state === "reserved" ? allowed : hidden,
      transfer: hasClass
        ? may
          ? { enabled: false, reason: "Chưa có lớp cùng khối còn chỗ để chuyển.", visible: true }
          : allowed
        : hidden,
    },
    activeEnrollment: hasClass ? activeEnrollment : null,
    businessDate: "2026-10-13",
    classOptions: [
      { academicYearName: "2026–2027", code: class9A.code, defaultLearningMode: "offline", grade: 9, id: class9A.id, level: "A", name: class9A.name },
      { academicYearName: "2026–2027", code: classT9C.code, defaultLearningMode: "offline", grade: 9, id: classT9C.id, level: "CLC", name: classT9C.name },
    ],
    classOptionsError: null,
    defaultRegisteredMode: "offline",
    latestEnrollment: state === "new" ? null : state === "reserved" ? reservedEnrollment : activeEnrollment,
    transferClassOptions: [],
  };
}

function buildLedger(state: StudentPreviewState): StudentLedgerReadModel {
  const balance = state === "debt" ? -1 : state === "clean" ? 6 : state === "reserved" ? 2 : 0;

  return {
    alerts:
      state === "debt"
        ? [
            {
              alertType: "negative_balance",
              balanceSessions: -1,
              description: "Buổi 12/10 đã bị trừ khi số dư bằng 0. Cần tạo yêu cầu thanh toán hoặc tặng buổi.",
              severity: "danger",
              title: "Số dư buổi âm",
            },
          ]
        : [],
    balanceSessions: balance,
    entries:
      state === "new"
        ? []
        : [
            { balanceAfter: balance, createdAt: "2026-10-12T14:52:00Z", deltaSessions: -1, effectiveOn: "2026-10-12", entryType: "session_charge", id: "l-1", note: "Khóa buổi B14 Toán 9A", referenceCode: "B14", unitPriceVnd: 200_000 },
            { balanceAfter: balance + 1, createdAt: "2026-10-09T14:52:00Z", deltaSessions: -1, effectiveOn: "2026-10-09", entryType: "session_charge", id: "l-2", note: "Khóa buổi B13 Toán 9A", referenceCode: "B13", unitPriceVnd: 200_000 },
            { balanceAfter: balance + 2, createdAt: "2026-10-02T08:31:00Z", deltaSessions: 8, effectiveOn: "2026-10-02", entryType: "payment_credit", id: "l-3", note: "Yêu cầu YC-2610-0188 · SePay", referenceCode: "YC-2610-0188", unitPriceVnd: 250_000 },
            { balanceAfter: balance - 6, createdAt: "2026-09-30T14:52:00Z", deltaSessions: -1, effectiveOn: "2026-09-30", entryType: "session_charge", id: "l-4", note: "Khóa buổi B9 Toán 9A", referenceCode: "B9", unitPriceVnd: 200_000 },
          ],
    latestEntryAt: state === "new" ? null : "2026-10-12T14:52:00Z",
    ledgerEntryCount: state === "new" ? 0 : 4,
    totalCreditSessions: state === "new" ? 0 : 26,
    totalDebitSessions: state === "new" ? 0 : 26 - balance,
  };
}

const tuitionProfile: StudentTuitionProfile = {
  currentRateVnd: 200_000,
  rateHistory: [
    { createdAt: "2026-09-25T03:00:00Z", effectiveFrom: "2026-10-01", reason: "Mức tháng 10 theo bảng phí mới", unitPriceVnd: 200_000 },
    { createdAt: "2026-08-01T03:00:00Z", effectiveFrom: "2026-08-01", reason: "Mức đầu năm", unitPriceVnd: 180_000 },
  ],
  sourceHistory: [{ assignedAt: "2026-08-01", reason: "Giới thiệu bởi phụ huynh em Gia Bảo" }],
  sourceName: "Giới thiệu",
  sources: [
    { id: "src-1", name: "Giới thiệu" },
    { id: "src-2", name: "Facebook" },
  ],
};

const attendanceRows: Array<[string, "9a" | "t9c", string, StudentAttendanceHistoryItem["status"], number | null, string | null]> = [
  ["2026-10-12", "9a", "B14", "present", 8.5, "submitted"],
  ["2026-10-10", "t9c", "B6", "present", 7, "submitted"],
  ["2026-10-09", "9a", "B13", "present", null, "not_submitted"],
  ["2026-10-07", "9a", "B12", "additional_study", 9, "submitted"],
  ["2026-10-05", "9a", "B11", "present", 8, "submitted"],
  ["2026-10-03", "t9c", "B5", "excused_absence", null, null],
  ["2026-10-02", "9a", "B10", "present", 7.5, "submitted"],
  ["2026-09-30", "9a", "B9", "present", 8, "not_required"],
  ["2026-09-28", "9a", "B8", "unexcused_absence", null, null],
  ["2026-09-26", "9a", "B7", "present", 9, "submitted"],
];

function buildAttendance(state: StudentPreviewState) {
  if (state === "new") {
    return summarizeAttendance([]);
  }

  const items: StudentAttendanceHistoryItem[] = attendanceRows.map(([sessionDate, klass, code, status, testScore, notebookStatus], index) => ({
    actualLearningMode: "offline",
    classCode: klass === "9a" ? class9A.code : classT9C.code,
    classId: klass === "9a" ? class9A.id : classT9C.id,
    className: klass === "9a" ? class9A.name : classT9C.name,
    componentCode: null,
    id: `att-${index}`,
    isLateUpdate: index === 2,
    markedAt: `${sessionDate}T14:00:00Z`,
    notebookStatus,
    notes: null,
    sessionDate,
    sessionId: `session-${code}`,
    sessionLockedAt: index === 0 ? null : `${sessionDate}T15:00:00Z`,
    startTime: "19:30:00",
    status,
    testScore,
  }));

  return summarizeAttendance(items);
}

function buildPayments(state: StudentPreviewState) {
  if (state === "new") {
    return summarizePaymentRequests([]);
  }

  const requests: StudentPaymentRequestItem[] = [
    { bonusSessions: 0, createdAt: "2026-09-27T02:00:00Z", expectedAmountVnd: 2_400_000, id: "pr-1", notes: "Học phí T10 · Toán 9A", paidAmountVnd: state === "debt" ? 0 : 2_400_000, paidAt: state === "debt" ? null : "2026-10-02T08:31:00Z", publicCode: "YC-2610-0187", purchasedSessions: 12, status: state === "debt" ? "pending" : "paid", topupType: "renewal" },
    { bonusSessions: 0, createdAt: "2026-09-27T02:00:00Z", expectedAmountVnd: 2_000_000, id: "pr-2", notes: "Học phí T10 · T9C", paidAmountVnd: 2_000_000, paidAt: "2026-10-02T08:31:00Z", publicCode: "YC-2610-0188", purchasedSessions: 8, status: "paid", topupType: "renewal" },
    { bonusSessions: 1, createdAt: "2026-08-28T02:00:00Z", expectedAmountVnd: 2_600_000, id: "pr-3", notes: "Học phí T9 · Toán 9A", paidAmountVnd: 2_600_000, paidAt: "2026-08-29T08:31:00Z", publicCode: "YC-2609-0142", purchasedSessions: 13, status: "paid", topupType: "renewal" },
    { bonusSessions: 0, createdAt: "2026-07-28T02:00:00Z", expectedAmountVnd: 2_400_000, id: "pr-4", notes: "Học phí T8 · Toán 9A", paidAmountVnd: 2_400_000, paidAt: "2026-07-30T08:31:00Z", publicCode: "YC-2608-0097", purchasedSessions: 12, status: "paid", topupType: "new" },
    { bonusSessions: 0, createdAt: "2026-07-01T02:00:00Z", expectedAmountVnd: 2_600_000, id: "pr-5", notes: "Học phí T7 · nháp hủy", paidAmountVnd: 0, paidAt: null, publicCode: "YC-2607-0071", purchasedSessions: 13, status: "cancelled", topupType: "new" },
  ];

  return summarizePaymentRequests(requests);
}

const upcoming: StudentUpcomingSession = {
  classCode: class9A.code,
  className: class9A.name,
  endTime: "21:30:00",
  id: "session-B15",
  learningMode: "offline",
  roomName: "Phòng 101",
  sessionDate: "2026-10-14",
  startTime: "19:30:00",
  status: "scheduled",
};

const taPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "classes.view",
  "sessions.view",
  "attendance.view",
  "attendance.mark",
  "results.view",
  "students.view",
  "timekeeping.view",
  "timekeeping.check",
];

export function StudentPreview({
  initialTab,
  role,
  state,
}: {
  initialTab?: string;
  role: "owner" | "ta";
  state: StudentPreviewState;
}) {
  const permissions = role === "ta" ? taPermissions : DATABASE_PERMISSION_CODES;
  const can = (code: PermissionCode) => permissions.includes(code);
  const detail = buildDetail(state);
  const hasClass = state === "debt" || state === "clean";

  return (
    <AppShell
      authUser={{ displayName: role === "ta" ? "Lê Thu Trang" : "Phạm Thu Hạnh", email: "hanh@toanthayvinh.vn", id: "dev-user", initials: role === "ta" ? "LT" : "PH" }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname="/students/student-preview"
      unreadNotificationCount={4}
    >
      <StudentProfilePage
        attendance={can("attendance.view") ? buildAttendance(state) : undefined}
        canCorrectAcquisitionSource={can("students.correct_acquisition_source")}
        canCreatePaymentRequest={can("payments.create_request")}
        canManageTuitionRates={can("students.manage_tuition_rates")}
        canUpdateStudent={can("students.update")}
        canViewAttendance={can("attendance.view")}
        canViewCare={can("student_care.view")}
        canViewClasses={can("classes.view")}
        canViewGuardians={can("guardians.view")}
        canViewLedger={can("session_ledger.view")}
        canViewPayments={can("payments.view")}
        canViewSessions={can("sessions.view")}
        careCard={
          can("student_care.view") ? (
            <ProfilePanel title="Chăm sóc học viên" titleId="dev-care-title">
              <p className="text-secondary text-text-default">
                {state === "debt" ? "1 công việc đang mở: Gọi phụ huynh về học phí T10 · hạn 13/10 · Thảo." : "Không có công việc chăm sóc đang mở."}
              </p>
            </ProfilePanel>
          ) : null
        }
        careTaskCount={state === "debt" ? 1 : 0}
        detail={detail}
        directoryHref="/students"
        editHref="/students/student-preview/edit"
        enrollmentUiModel={buildEnrollmentModel(state, role)}
        initialTab={initialTab}
        ledgerSummary={can("session_ledger.view") ? buildLedger(state) : null}
        payments={can("payments.view") ? buildPayments(state) : undefined}
        tuitionProfile={tuitionProfile}
        upcomingSession={hasClass ? upcoming : null}
        zaloGroupCard={
          <ProfilePanel title="Nhóm Zalo sổ liên lạc" titleId="dev-zalo-title">
            <p className="text-secondary text-text-muted">Nhóm 9A · Minh Anh · liên kết 05/09/2026.</p>
          </ProfilePanel>
        }
      />
    </AppShell>
  );
}
