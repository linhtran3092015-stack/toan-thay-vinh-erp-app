import type {
  SessionNotebookStatus,
} from "@/features/sessions/detail-read-models";

export interface RecordSessionResultActionInput {
  classSessionId: string;
  comment?: string | null;
  notebookScore?: number | null;
  notebookStatus: SessionNotebookStatus;
  studentId: string;
  testScore?: number | null;
}

export interface UpdateSessionResultActionInput {
  comment?: string | null;
  notebookScore?: number | null;
  notebookStatus: SessionNotebookStatus;
  reason: string;
  resultId: string;
  testScore?: number | null;
}

export interface LockSessionActionInput {
  reason: string;
  sessionId: string;
}

export type ResultActionFieldErrors =
  Record<string, string[] | undefined>;

export type SessionResultActionState =
  | {
      fieldErrors?: ResultActionFieldErrors;
      message: string;
      status: "error";
    }
  | {
      classSessionId: string;
      message: string;
      resultId: string;
      status: "success";
    };

export type SessionLockActionState =
  | {
      fieldErrors?: ResultActionFieldErrors;
      message: string;
      status: "error";
    }
  | {
      message: string;
      sessionId: string;
      status: "success";
    };
