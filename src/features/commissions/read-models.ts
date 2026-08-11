export type KnownSalesCommissionAccrualStatus = "provisional";
export type KnownSalesCommissionSourceGroup = "mma" | "sandbox";

export interface SalesCommissionAccrualDashboardEntry {
  id: string;
  leadSourceCode: string;
  /** Transports the server value exactly for safe unsupported-value presentation. */
  leadSourceGroup: string;
  leadSourceName: string;
  recognizedAt: string;
  recognizedRevenueVnd: number;
  saleOwnerDisplayName: string;
  saleOwnerEmployeeCode: string | null;
  saleOwnerId: string;
  sourceCashflowRecordId: string;
  /** Transports the server value exactly; the feature owns read-only presentation. */
  status: string;
  studentFullName: string;
  studentId: string;
  studentPublicCode: string;
}

export type SalesCommissionAccrualReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
