export type SalesCommissionAccrualStatus = "provisional";

export interface SalesCommissionAccrualDashboardEntry {
  id: string;
  leadSourceCode: string;
  leadSourceGroup: "mma" | "sandbox";
  leadSourceName: string;
  recognizedAt: string;
  recognizedRevenueVnd: number;
  saleOwnerDisplayName: string;
  saleOwnerEmployeeCode: string | null;
  saleOwnerId: string;
  sourceCashflowRecordId: string;
  status: SalesCommissionAccrualStatus;
  studentFullName: string;
  studentId: string;
  studentPublicCode: string;
}

export type SalesCommissionAccrualReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
