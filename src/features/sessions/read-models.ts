export type SessionKind =
  | "regular"
  | "makeup"
  | "additional";

export type SessionLearningMode =
  | "online"
  | "offline"
  | "hybrid";

export type SessionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface SessionDirectoryItem {
  attendanceCount: number | null;
  classCode: string;
  classId: string;
  className: string;
  componentCode: string | null;
  endTime: string;
  grade: number;
  id: string;
  learningMode: SessionLearningMode;
  level: string;
  lockedAt: string | null;
  resultCount: number | null;
  roomName: string | null;
  sessionDate: string;
  sessionKind: SessionKind;
  startTime: string;
  status: SessionStatus;
}

export type SessionDirectoryErrorCode =
  | "invalid_response"
  | "query_failed";

export interface SessionDirectoryError {
  code: SessionDirectoryErrorCode;
  message: string;
}

export type SessionDirectoryResult =
  | {
      ok: true;
      sessions: SessionDirectoryItem[];
    }
  | {
      ok: false;
      error: SessionDirectoryError;
    };
