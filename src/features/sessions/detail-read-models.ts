import type {
  SessionKind,
  SessionLearningMode,
  SessionStatus,
} from "@/features/sessions/read-models";

export type SessionAttendanceStatus =
  | "present"
  | "excused_absence"
  | "unexcused_absence"
  | "additional_study";

export type SessionNotebookStatus =
  | "submitted"
  | "not_submitted"
  | "not_required";

export interface SessionParticipantReadModel {
  actualLearningMode:
    | "online"
    | "offline"
    | null;
  attendanceId: string | null;
  attendanceNotes: string | null;
  attendanceStatus:
    | SessionAttendanceStatus
    | null;
  currentGrade: number | null;
  enrollmentClassId: string | null;
  enrollmentId: string | null;
  isLateUpdate: boolean;
  notebookScore: number | null;
  notebookStatus:
    | SessionNotebookStatus
    | null;
  registeredMode: string | null;
  resultComment: string | null;
  resultId: string | null;
  studentCode: string | null;
  studentId: string;
  studentName: string | null;
  testScore: number | null;
}

export interface SessionDetailReadModel {
  attendanceCount: number | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  classCode: string;
  classId: string;
  className: string;
  classStatus: string;
  completedAt: string | null;
  componentCode: string | null;
  endTime: string;
  grade: number;
  id: string;
  learningMode: SessionLearningMode;
  level: string;
  lockedAt: string | null;
  lockReason: string | null;
  meetingUrl: string | null;
  notes: string | null;
  participants: SessionParticipantReadModel[];
  resultCount: number | null;
  roomName: string | null;
  rosterCount: number | null;
  sessionDate: string;
  sessionKind: SessionKind;
  startedAt: string | null;
  startTime: string;
  status: SessionStatus;
}

export type SessionDetailErrorCode =
  | "invalid_response"
  | "query_failed"
  | "session_not_found";

export interface SessionDetailError {
  code: SessionDetailErrorCode;
  message: string;
}

export type SessionDetailResult =
  | {
      detail: SessionDetailReadModel;
      ok: true;
    }
  | {
      error: SessionDetailError;
      ok: false;
    };
