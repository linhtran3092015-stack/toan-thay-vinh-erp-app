"use client";

import { AppShell } from "@/components/layout/app-shell";
import type {
  SessionAttendanceStatus,
  SessionDetailReadModel,
  SessionParticipantReadModel,
} from "@/features/sessions/detail-read-models";
import { SessionDetailPage } from "@/features/sessions/session-detail-page";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type SessionPreviewState = "live" | "pending" | "ready" | "locked";

const names: Array<[string, string]> = [
  ["Nguyễn Minh Anh", "TTV-00123"],
  ["Trần Gia Bảo", "TTV-00131"],
  ["Lê Hoàng Nam", "TTV-00098"],
  ["Phạm Thu Hà", "TTV-00144"],
  ["Vũ Đức Huy", "TTV-00102"],
  ["Đỗ Khánh Linh", "TTV-00156"],
  ["Bùi Quang Minh", "TTV-00117"],
  ["Hoàng Ngọc Mai", "TTV-00160"],
  ["Ngô Tuấn Kiệt", "TTV-00171"],
  ["Lý Nhật Quang", "TTV-00088"],
];

const statuses: Array<SessionAttendanceStatus | null> = [
  "present",
  "unexcused_absence",
  "present",
  "additional_study",
  "excused_absence",
  "present",
  "present",
  "present",
  "present",
  "present",
];

function buildParticipants(state: SessionPreviewState): SessionParticipantReadModel[] {
  return names.map(([studentName, studentCode], index) => {
    const base = statuses[index];
    const attendanceStatus = state === "live" ? (index < 4 ? base : null) : base;
    const eligible = attendanceStatus === "present" || attendanceStatus === "additional_study";
    // "pending": one present student (index 7) still has no result, which blocks nothing but shows the gap.
    const hasResult = eligible && state !== "live" && !(state === "pending" && index === 7);

    return {
      actualLearningMode: attendanceStatus ? (index === 1 ? null : "offline") : null,
      attendanceId: attendanceStatus ? `att-${index}` : null,
      attendanceNotes:
        index === 0 ? "Nợ 1 buổi, kế toán đã nhắc 10/10" : index === 4 ? "Phụ huynh báo 09:12 · không trừ buổi" : null,
      attendanceStatus,
      currentGrade: 9,
      enrollmentClassId: "class-9a",
      enrollmentId: `enr-${index}`,
      isLateUpdate: false,
      notebookScore: hasResult ? (index % 3 === 0 ? 9 : 8) : null,
      notebookStatus: hasResult ? (index === 3 ? "not_submitted" : "submitted") : null,
      registeredMode: index === 3 ? "online" : "offline",
      resultComment: hasResult && index === 0 ? "Tiến bộ phần hình" : null,
      resultId: hasResult ? `res-${index}` : null,
      studentCode,
      studentId: `student-${index}`,
      studentName,
      testScore: hasResult ? [8.5, null, 9, 7, null, 8, 8.5, 7.5, 9, 6][index] ?? 8 : null,
    };
  });
}

function buildDetail(state: SessionPreviewState): SessionDetailReadModel {
  const participants = buildParticipants(state);
  const locked = state === "locked";

  return {
    attendanceCount: participants.filter((participant) => participant.attendanceStatus).length,
    cancellationReason: null,
    cancelledAt: null,
    classCode: "L-9A26",
    classId: "class-9a",
    className: "Toán 9A tối 2-4-6",
    classStatus: "active",
    completedAt: state === "live" ? null : "2026-10-12T14:30:00Z",
    componentCode: null,
    endTime: "21:30:00",
    grade: 9,
    id: "11111111-1111-4111-8111-111111111111",
    learningMode: "offline",
    level: "A",
    lockedAt: locked ? "2026-10-12T14:52:00Z" : null,
    lockReason: locked ? "Đã đối soát điểm danh và kết quả cuối buổi" : null,
    meetingUrl: null,
    notes: null,
    participants,
    previousSessionDate: null,
    rescheduleCount: 0,
    resultCount: participants.filter((participant) => participant.resultId).length,
    roomName: "Phòng 101",
    rosterCount: participants.length,
    sessionDate: "2026-10-12",
    sessionKind: "regular",
    startedAt: "2026-10-12T12:30:00Z",
    startTime: "19:30:00",
    status: state === "live" ? "in_progress" : "completed",
  };
}

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
  "notifications.view",
];

export function SessionPreview({ role, state }: { role: "owner" | "ta"; state: SessionPreviewState }) {
  const isOwner = role === "owner";
  const permissions = isOwner
    ? DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view")
    : taPermissions;
  const detail = buildDetail(state);

  return (
    <AppShell
      authUser={{
        displayName: isOwner ? "Nguyễn Văn Vinh" : "Lê Bích Ngọc",
        email: isOwner ? "vinh@toanthayvinh.vn" : "ngoc@toanthayvinh.vn",
        id: "dev-user",
        initials: isOwner ? "NV" : "LN",
      }}
      canCheckTimekeeping={!isOwner}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={`/sessions/${detail.id}`}
      unreadNotificationCount={2}
    >
      <SessionDetailPage
        additionalStudyCandidates={[]}
        canLockSession={permissions.includes("sessions.lock")}
        canManageResults={permissions.includes("results.manage")}
        canManageSessions={permissions.includes("sessions.manage")}
        canMarkAttendance={permissions.includes("attendance.mark")}
        canReverseLedger={permissions.includes("session_ledger.reverse")}
        canViewAttendance={permissions.includes("attendance.view")}
        canViewPayroll={permissions.includes("payroll.view")}
        canViewResults={permissions.includes("results.view")}
        canViewStudents={permissions.includes("students.view")}
        detail={detail}
      />
    </AppShell>
  );
}
