export type LearningResultNotebookStatus =
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

export interface LearningResultFiltersState {
  classId: string;
  dateFrom: string;
  dateTo: string;
  grade: string;
  notebookStatus: string;
  search: string;
  scoreStatus: string;
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
