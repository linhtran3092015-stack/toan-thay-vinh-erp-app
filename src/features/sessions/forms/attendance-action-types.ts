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

export type AttendanceActionState =
  | {
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
