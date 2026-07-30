export interface GradingCreditDashboardEntry {
  classCode: string;
  className: string;
  classSessionId: string;
  creditUnits: number;
  creditedAt: string;
  graderDisplayName: string;
  graderId: string;
  id: string;
  sessionDate: string;
  sessionResultId: string;
  studentFullName: string;
  studentId: string;
  studentPublicCode: string;
}

export type GradingCreditReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
