export type PayrollPeriodStatus = "draft" | "review" | "approved";

export interface PayrollDashboardEntry {
  payDate: string;
  payableAmountVnd: number;
  payrollPeriodId: string;
  payrollStatementId: string;
  periodMonth: string;
  periodStatus: PayrollPeriodStatus;
  staffDisplayName: string;
  staffEmployeeCode: string | null;
  staffId: string;
  totalDeductionsVnd: number;
  totalEarningsVnd: number;
  workHours: number;
  workUnits: number;
}

export type PayrollReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
