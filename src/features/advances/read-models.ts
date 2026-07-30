export type SalaryAdvanceStatus =
  | "approved"
  | "deducted"
  | "rejected"
  | "requested"
  | "review";

export interface SalaryAdvanceDashboardEntry {
  amountVnd: number;
  approvalNote: string | null;
  approvedAt: string | null;
  approvedByDisplayName: string | null;
  deductionPayrollPeriodId: string | null;
  deductionPeriodMonth: string;
  deductedAt: string | null;
  id: string;
  rejectedAt: string | null;
  rejectedByDisplayName: string | null;
  rejectionReason: string | null;
  requestNote: string;
  requestedAt: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByDisplayName: string | null;
  staffDisplayName: string;
  staffEmployeeCode: string | null;
  staffId: string;
  status: SalaryAdvanceStatus;
}

export type SalaryAdvanceReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
