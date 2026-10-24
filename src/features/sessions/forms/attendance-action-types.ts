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
  /** Skip revalidating the session pages; a bulk mark saves many rows and calls refreshSessionAttendanceAction once. */
  deferRefresh?: boolean;
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
 * Database error codes getAttendanceRpcError recognises (matched as substrings of the RPC error
 * message, in this order). Each one has a user-facing message there, and comes back as `code`.
 */
export const ATTENDANCE_RPC_ERROR_CODES = [
  "ATTENDANCE_LEARNING_MODE_INVALID",
  "ATTENDANCE_MARK_PERMISSION_DENIED",
  "ATTENDANCE_REQUIRES_STARTED_SESSION",
  "ATTENDANCE_STATUS_INVALID",
  "ATTENDANCE_UPDATE_REASON_REQUIRED",
  "AUTHENTICATION_REQUIRED",
  "CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE",
  "CLASS_SESSION_ID_REQUIRED",
  "CLASS_SESSION_IS_LOCKED",
  "CLASS_SESSION_NOT_FOUND",
  "MAIN_ATTENDANCE_REQUIRES_EFFECTIVE_ENROLLMENT",
  "MAIN_ATTENDANCE_REQUIRES_EXISTING_ENROLLMENT",
  "SESSION_ATTENDANCE_ALREADY_EXISTS",
  "SESSION_ATTENDANCE_ID_REQUIRED",
  "SESSION_ATTENDANCE_NOT_FOUND",
  "SESSION_ATTENDANCE_NO_CHANGES",
  "STUDENT_ID_REQUIRED",
  "STUDENT_NOT_FOUND",
  "TRIAL_OR_UNCONFIRMED_STUDENT_CANNOT_BE_MARKED",
] as const;

export type AttendanceRpcErrorCode = (typeof ATTENDANCE_RPC_ERROR_CODES)[number];

/** Codes the action attaches before calling the RPC (permission lookup failed / attendance.mark missing). */
export const ATTENDANCE_CLIENT_ERROR_CODES = [
  "ATTENDANCE_PERMISSION_CHECK_FAILED",
  "ATTENDANCE_MARK_PERMISSION_DENIED",
] as const;

export type AttendanceClientErrorCode = (typeof ATTENDANCE_CLIENT_ERROR_CODES)[number];

export type AttendanceErrorCode = AttendanceRpcErrorCode | AttendanceClientErrorCode;

/**
 * Error codes that apply to the whole session, not one student: retrying the next student would
 * fail the same way, so batch marking stops on these.
 */
export const ATTENDANCE_SESSION_WIDE_ERROR_CODE_LIST = [
  "ATTENDANCE_MARK_PERMISSION_DENIED",
  "ATTENDANCE_PERMISSION_CHECK_FAILED",
  "ATTENDANCE_REQUIRES_STARTED_SESSION",
  "AUTHENTICATION_REQUIRED",
  "CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE",
  "CLASS_SESSION_IS_LOCKED",
  "CLASS_SESSION_NOT_FOUND",
] as const satisfies readonly AttendanceErrorCode[];

export const ATTENDANCE_SESSION_WIDE_ERROR_CODES: ReadonlySet<string> = new Set<AttendanceErrorCode>(
  ATTENDANCE_SESSION_WIDE_ERROR_CODE_LIST,
);

export type AttendanceActionState =
  | {
      /** Stable key for the failure (the matched database error, or a client-side reason); absent for unknown errors. */
      code?: AttendanceErrorCode;
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
