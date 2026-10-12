import type {
  SessionAttendanceStatus,
} from "@/features/sessions/detail-read-models";

export type AttendanceLearningMode =
  | "online"
  | "offline";

export interface MarkSessionAttendanceActionInput {
  actualLearningMode: AttendanceLearningMode;
  attendanceStatus: SessionAttendanceStatus;
  classSessionId: string;
  notes?: string | null;
  studentId: string;
}

export interface UpdateSessionAttendanceActionInput {
  actualLearningMode: AttendanceLearningMode;
  attendanceId: string;
  attendanceStatus: SessionAttendanceStatus;
  notes?: string | null;
  reason: string;
}

export type AttendanceActionFieldErrors =
  Record<string, string[] | undefined>;

/**
 * Error codes that apply to the whole session, not one student: retrying the next student would
 * fail the same way, so batch marking stops on these.
 */
export const ATTENDANCE_SESSION_WIDE_ERROR_CODES: ReadonlySet<string> = new Set([
  "ATTENDANCE_MARK_PERMISSION_DENIED",
  "ATTENDANCE_PERMISSION_CHECK_FAILED",
  "ATTENDANCE_REQUIRES_STARTED_SESSION",
  "AUTHENTICATION_REQUIRED",
  "CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE",
  "CLASS_SESSION_IS_LOCKED",
  "CLASS_SESSION_NOT_FOUND",
]);

export type AttendanceActionState =
  | {
      /** Stable key for the failure (the matched database error, or a client-side reason); absent for unknown errors. */
      code?: string;
      fieldErrors?: AttendanceActionFieldErrors;
      message: string;
      status: "error";
    }
  | {
      attendanceId: string;
      classSessionId: string;
      message: string;
      status: "success";
    };
