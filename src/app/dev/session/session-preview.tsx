"use client";

import { AppShell } from "@/components/layout/app-shell";
import type { SessionGradingSubmission } from "@/features/grading-submissions/data";
import type {
  SessionAttendanceStatus,
  SessionDetailReadModel,
  SessionParticipantReadModel,
} from "@/features/sessions/detail-read-models";
import { SessionDetailPage } from "@/features/sessions/session-detail-page";
import { DEFAULT_COMMENT_PHRASES } from "@/features/ai-grading/comment";
import type { ReviewActions } from "@/features/grading-submissions/components/submission-review-panel";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

import { buildSessionTestState, previewSessionTestActions, type SessionTestPreviewState } from "./session-test-fixtures";

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

/** Form submissions (AI grading phase 1): a resubmission, a late one, and present students who did not submit. */
function buildSubmissions(participants: SessionParticipantReadModel[]): SessionGradingSubmission[] {
  const submission = (index: number, overrides: Partial<SessionGradingSubmission>): SessionGradingSubmission => ({
    answerText: "13. x = 18\n14. 8 cm\n15. 257",
    answerTruncated: false,
    attemptNo: 1,
    countsForScore: true,
    id: `sub-${index}`,
    issues: [],
    sessionMatchMethod: "claimed_session",
    studentCode: participants[index].studentCode ?? "",
    studentId: participants[index].studentId,
    studentMatchMethod: "student_code",
    studentName: participants[index].studentName ?? "",
    submittedAt: "2026-10-12T14:31:00Z",
    review: {
      attendanceStatus: participants[index].attendanceStatus,
      feedbackText: null,
      finalScore: null,
      finalVerdicts: null,
      keyVersion: null,
      messageStatus: null,
      note: null,
      paperScore: null,
      praiseBonus: false,
      rankLabel: null,
      result: null,
      reviewedAt: null,
      reviewedByName: null,
      status: "pending",
    },
    ...overrides,
  });
  // AI results (phase 3a): green, yellow with a flag, still grading, red.
  const question = (label: string, verdict: "correct" | "incorrect", answer: string, reason: string, errorLocation = "") => ({
    errorLocation,
    extractedFinalAnswer: answer,
    label,
    noteForParent: "",
    reasonForTeacher: reason,
    verdict,
  });
  const graded = {
    color: "green" as const,
    confidence: "high" as const,
    flags: [],
    gradedAt: "2026-10-12T14:35:00Z",
    keyVersion: 1,
    questions: [
      question("13", "incorrect", "x = 18", "Đáp số 18 sai, đúng là x = 54.", "dòng 1: lấy 36 - 18 thay vì 36 + 18"),
      question("14", "correct", "8 cm", "Đúng đáp án."),
      question("15", "correct", "257", "Đúng đáp án."),
    ],
    rawScore: 6,
    state: "graded" as const,
  };
  return [
    submission(0, { ai: graded, attemptNo: 2, id: "sub-0b", submittedAt: "2026-10-12T14:34:00Z" }),
    submission(0, { ai: { ...graded, state: "not_counted" }, answerText: "13. 17\n14. 8", attemptNo: 1, countsForScore: false, id: "sub-0a" }),
    submission(2, {
      ai: { ...graded, color: "yellow", confidence: "low", flags: ["ambiguous_notation"], rawScore: 7.5 },
      answerText: "Câu 13: x=18\nCâu 14: BM = 14:2 = 7 cm\nCâu 15: 257",
    }),
    submission(3, { ai: { ...graded, color: null, questions: [], rawScore: null, state: "grading" }, sessionMatchMethod: "time_window", studentMatchMethod: "name_birth_year" }),
    submission(1, { ai: { ...graded, color: "red", questions: [], rawScore: null, state: "failed" }, issues: ["outside_window"], submittedAt: "2026-10-12T17:05:00Z" }),
  ];
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
  "ai_grading.view",
  "ai_grading.manage_tests",
  "ai_grading.confirm_key",
  "ai_grading.review",
  "students.view",
  "timekeeping.view",
  "timekeeping.check",
  "notifications.view",
];

/** Review actions in the preview never reach the server. */
const previewReviewActions: ReviewActions = {
  approve: async () => ({ message: "Xem trước: không ghi điểm thật.", ok: true }),
  regrade: async () => ({ message: "Xem trước: không chấm lại thật.", ok: true }),
  setPraise: async () => ({ message: "Xem trước: không lưu.", ok: true }),
  skip: async () => ({ message: "Xem trước: không bỏ qua thật.", ok: true }),
};

export function SessionPreview({
  role,
  state,
  test,
}: {
  role: "owner" | "ta";
  state: SessionPreviewState;
  test: SessionTestPreviewState;
}) {
  const isOwner = role === "owner";
  const permissions = isOwner
    ? DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view")
    : taPermissions;
  const detail = buildDetail(state);
  const testState = buildSessionTestState(test, state === "locked");

  return (
    <AppShell
      authUser={{
        displayName: isOwner ? "Nguyễn Văn Vinh" : "Lê Bích Ngọc",
        email: isOwner ? "vinh@example.com" : "ngoc@example.com",
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
        gradingSubmissions={
          permissions.includes("ai_grading.view") ? { data: buildSubmissions(detail.participants), ok: true } : null
        }
        sessionTest={{ data: testState, ok: true }}
        sessionTestActions={previewSessionTestActions}
        submissionReview={
          permissions.includes("ai_grading.review")
            ? {
                actions: previewReviewActions,
                bands: [
                  { label: "Tiến bộ ít", minScore: 0 },
                  { label: "Tiến bộ vừa", minScore: 5 },
                  { label: "Tiến bộ", minScore: 8 },
                  { label: "Tiến bộ nhiều", minScore: 9 },
                  { label: "Rất tiến bộ", minScore: 10 },
                ],
                canReview: true,
                canWriteResults: permissions.includes("results.manage"),
                editable: detail.lockedAt === null && (detail.status === "in_progress" || detail.status === "completed"),
                key: testState.test?.status === "key_confirmed" ? testState.test.answerKey : null,
                keyVersion: testState.test?.status === "key_confirmed" ? testState.test.answerKeyVersion : 0,
                phrases: DEFAULT_COMMENT_PHRASES,
                sessionId: detail.id,
              }
            : undefined
        }
        messageContact={
          state === "ready" || state === "locked"
            ? { saved: { phone: "0912 345 678", supervisorName: "Cô Lê Bích Ngọc", updatedAt: "2026-10-12T13:00:00Z" }, suggestion: null }
            : { saved: null, suggestion: { phone: "0912 345 678", supervisorName: "Cô Lê Bích Ngọc" } }
        }
      />
    </AppShell>
  );
}
