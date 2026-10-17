/** Rows the directory loads (the RPC maximum); the page says so when it was reached. */
export const LEARNING_RESULTS_LIMIT = 500;

export type LearningResultNotebookStatus =
  | "pending"
  | "submitted"
  | "not_submitted"
  | "not_required";

export interface LearningResultDirectoryItem {
  classCode: string;
  classGrade: number;
  classId: string;
  classLevel: string;
  className: string;
  classSessionId: string;
  currentGrade: number;
  gradedAt: string | null;
  lockedAt: string | null;
  notebookScore: number | null;
  notebookStatus: LearningResultNotebookStatus;
  resultComment: string | null;
  resultId: string;
  sessionDate: string;
  sessionStatus: string;
  studentCode: string;
  studentId: string;
  studentName: string;
  testScore: number | null;
}

export type LearningResultsDirectoryResult =
  | {
      data: LearningResultDirectoryItem[];
      ok: true;
    }
  | {
      error: {
        code: "invalid_response" | "query_failed";
        message: string;
      };
      ok: false;
    };
