import type { PieceworkSummary } from "@/features/payroll/payslip-sections";

export type PayslipPeriodStatus = "draft" | "review" | "approved";

export interface PayslipBankAccountInfo {
  accountHolderName: string;
  accountNumberMasked: string;
  bankName: string;
}

export interface PayslipEmployeeInfo {
  avatarUrl: string | null;
  bankAccount: PayslipBankAccountInfo | null;
  department: string | null;
  displayName: string;
  employeeCode: string | null;
  joinedAt: string | null;
  positionLabel: string;
  staffId: string;
}

export interface PayslipPeriodInfo {
  currentRevision: number;
  feedbackClosedAt: string | null;
  feedbackOpenedAt: string | null;
  id: string;
  lastCalculatedAt: string | null;
  payDate: string;
  payDateFormatted: string;
  periodEndDate: string;
  periodMonth: string;
  periodMonthFormatted: string;
  periodStartDate: string;
  status: string;
  statusLabel: string;
}

export interface PayslipLineItem {
  amountFormatted: string;
  amountVnd: number;
  direction: "earning" | "deduction";
  formulaExplanation: string | null;
  id: string;
  label: string;
  lineType: string;
  note: string | null;
  quantity: number | null;
  unitLabel: string | null;
  unitRateFormatted: string | null;
  unitRateVnd: number | null;
}

export interface WorkHoursDetail {
  dailyRateFormatted: string;
  dailyRateVnd: number;
  factorText: string | null;
  mode: "offline" | "online" | "general";
  modeLabel: string;
  subtotalFormatted: string;
  subtotalVnd: number;
  workHoursFormatted: string;
  workMinutes: number;
}

export interface GradingDetail {
  creditsCount: number;
  explanation: string;
  poolAmountFormatted: string | null;
  subtotalFormatted: string;
  subtotalVnd: number;
}

export interface CommissionDetail {
  basisRevenueFormatted: string;
  basisRevenueVnd: number;
  gradeLabel: string | null;
  ratePercentage: string;
  subtotalFormatted: string;
  subtotalVnd: number;
}

export interface PayslipTotals {
  amountInWords: string;
  grossFormatted: string;
  /** "Tổng thu nhập" as staff read it: net of the piecework offset and manual deductions. */
  grossVnd: number;
  netFormatted: string;
  netVnd: number;
  totalDeductionsFormatted: string;
  /** Real deductions only (advances). */
  totalDeductionsVnd: number;
  workHours: number;
  workMinutes: number;
  workUnits: number;
}

export interface PayslipDocumentData {
  breakdowns: {
    commissions: readonly CommissionDetail[];
    grading: GradingDetail | null;
    workHours: readonly WorkHoursDetail[];
  };
  /** Manual adjustments (tăng and giảm); not counted as deductions. */
  adjustments: readonly PayslipLineItem[];
  /** Real deductions only (advances); the piecework offset lives in `piecework`. */
  deductions: readonly PayslipLineItem[];
  /** Earnings without manual adjustments. */
  earnings: readonly PayslipLineItem[];
  employee: PayslipEmployeeInfo;
  isStale: boolean;
  period: PayslipPeriodInfo;
  /** Present when the staff member is paid lương cứng + lương khoán above a floor. */
  piecework: PieceworkSummary | null;
  statementId: string;
  totals: PayslipTotals;
}

export type PayslipResult =
  | {
      data: PayslipDocumentData;
      ok: true;
    }
  | {
      error:
        | "NOT_AUTHENTICATED"
        | "PERMISSION_DENIED"
        | "PERIOD_NOT_FOUND"
        | "STATEMENT_NOT_FOUND"
        | "STATEMENT_STALE"
        | "STATEMENT_CALCULATION_MISMATCH";
      message: string;
      ok: false;
      suggestedCurrentStatementId?: string;
    };
