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
  /** Every attendance row of the session, any status (walk-ins included); null without attendance.view. */
  attendanceCount: number | null;
  /** Free-text reason; set for every cancelled session. */
  cancellationReason?: string | null;
  classCode: string;
  classId: string;
  className: string;
  componentCode: string | null;
  endTime: string;
  grade: number;
  /** Whether the session has a meeting link; the link itself never reaches the list. */
  hasMeetingUrl?: boolean;
  id: string;
  learningMode: SessionLearningMode;
  level: string;
  lockedAt: string | null;
  /** Roster marks (present, excused or unexcused absence: statuses only roster students hold); null without attendance.view. */
  markedRosterCount?: number | null;
  /** Every result row of the session (comment-only rows too); null without results.view. */
  resultCount: number | null;
  /** Students who may receive a result (present or additional_study); null without attendance.view. */
  resultEligibleCount?: number | null;
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
