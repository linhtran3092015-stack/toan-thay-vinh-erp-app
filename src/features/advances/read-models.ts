export type KnownSalaryAdvanceStatus =
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
  /**
   * Transport the server value exactly. Presentation handles unsupported
   * statuses read-only rather than fabricating a known lifecycle state.
   */
  status: string;
}

export type SalaryAdvanceReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
