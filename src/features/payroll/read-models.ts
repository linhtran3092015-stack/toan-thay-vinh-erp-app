import { z } from "zod";

export type PayrollPeriodStatus = "draft" | "review" | "approved";

export interface PayrollDashboardEntry {
  payDate: string;
  payableAmountVnd: number;
  payrollPeriodId: string;
  payrollStatementId: string;
  periodMonth: string;
  // The legacy dashboard reader must preserve unknown stored states instead
  // of fabricating a mutable lifecycle value.
  periodStatus: string;
  staffDisplayName: string;
  staffEmployeeCode: string | null;
  staffId: string;
  totalDeductionsVnd: number;
  totalEarningsVnd: number;
  workHours: number;
  workUnits: number;
}

export interface PayrollLineRead {
  amountVnd: number;
  direction: string;
  evidenceSnapshot: Record<string, unknown>;
  formulaSnapshot: Record<string, unknown>;
  id: string;
  lineType: string;
  note: string | null;
  payrollStatementId: string;
  policyCode: string | null;
  quantity: number | null;
  sourceKind: string | null;
  unitCount: number | null;
  unitLabel: string | null;
  unitRateVnd: number | null;
  workMinutes: number | null;
}

export interface PayrollStatementRead {
  id: string;
  lines: readonly PayrollLineRead[];
  payableAmountVnd: number;
  payrollPeriodId: string;
  staffDisplayName: string;
  staffEmployeeCode: string | null;
  staffId: string;
  totalDeductionsVnd: number;
  totalEarningsVnd: number;
  workHours: number;
  workMinutes: number;
  workUnits: number;
}

export interface PayrollPeriodRead {
  blockingIssueCount: number;
  currentRevision: number;
  feedbackClosedAt: string | null;
  feedbackOpenedAt: string | null;
  id: string;
  lastCalculatedAt: string | null;
  payDate: string;
  periodMonth: string;
  // Transport the stored value exactly. Payroll 0 must not coerce unknown
  // database states into a mutable client lifecycle.
  status: string;
  pendingCorrectionCount: number;
  statements: readonly PayrollStatementRead[];
  /** Set once the approved period has been marked paid; it is then final. */
  paidAt?: string | null;
  paidOn?: string | null;
  paymentReference?: string | null;
}

export interface PayrollCorrectionRequestRead {
  id: string;
  items: readonly {
    evidenceUrl: string | null;
    id: string;
    itemLabel: string;
    requestedChange: string;
  }[];
  payrollPeriodId: string;
  payrollStatementId: string;
  requestMessage: string;
  requestedAt: string;
  requestedBy: string;
  responseMessage: string | null;
  staffDisplayName: string;
  status: "pending" | "accepted" | "rejected";
}

export interface PayrollImportBatchRead {
  conflictRows: number;
  datasetType: "timekeeping" | "grading" | "renewal_orders" | "new_enrollment_orders";
  errorRows: number;
  fileName: string;
  id: string;
  periodMonth: string;
  status: "pending_review" | "approved" | "rejected";
  totalRows: number;
  uploadedAt: string;
  validRows: number;
}

export interface PayrollCalculationIssueRead {
  details: Record<string, unknown>;
  id: string;
  issueCode: string;
  payrollPeriodId: string;
  periodMonth: string;
  revision: number;
  severity: "blocking" | "warning";
  sourceFactId: string | null;
  staffId: string | null;
  staffDisplayName?: string | null;
  staffEmployeeCode?: string | null;
  staffEmail?: string | null;
}

export interface PayrollManagementOverviewRead {
  correctionRequests: readonly PayrollCorrectionRequestRead[];
  importBatches: readonly PayrollImportBatchRead[];
  issues: readonly PayrollCalculationIssueRead[];
}

const payrollDetailsLineSchema = z.object({
  amountVnd: z.number().int(),
  direction: z.string(),
  evidenceSnapshot: z.record(z.string(), z.unknown()),
  formulaSnapshot: z.record(z.string(), z.unknown()),
  id: z.string(),
  lineType: z.string(),
  note: z.string().nullable(),
  policyCode: z.string().nullable(),
  quantity: z.number().nullable(),
  sourceKind: z.string().nullable(),
  unitCount: z.number().int().nullable(),
  unitLabel: z.string().nullable(),
  unitRateVnd: z.number().int().nullable(),
  workMinutes: z.number().int().nonnegative().nullable(),
});

const payrollDetailsStatementSchema = z.object({
  id: z.string(),
  lines: z.array(payrollDetailsLineSchema),
  payableAmountVnd: z.number().int(),
  payrollPeriodId: z.string(),
  staffDisplayName: z.string(),
  staffEmployeeCode: z.string().nullable(),
  staffId: z.string(),
  totalDeductionsVnd: z.number().int(),
  totalEarningsVnd: z.number().int(),
  workHours: z.number().int(),
  workMinutes: z.number().int().nonnegative(),
  workUnits: z.number().int(),
});

const payrollPeriodDetailsSchema = z.object({
  olderPeriodCount: z.number().int().nonnegative(),
  periods: z.array(z.object({
    blockingIssueCount: z.number().int().nonnegative(),
    currentRevision: z.number().int().positive().nullable(),
    feedbackClosedAt: z.string().nullable(),
    feedbackOpenedAt: z.string().nullable(),
    id: z.string(),
    lastCalculatedAt: z.string().nullable(),
    paidAt: z.string().nullable(),
    paidOn: z.string().nullable(),
    payDate: z.string(),
    paymentReference: z.string().nullable(),
    pendingCorrectionCount: z.number().int().nonnegative(),
    periodMonth: z.string(),
    statements: z.array(payrollDetailsStatementSchema),
    status: z.string(),
  })),
  staleStatement: z.object({ currentStatementId: z.string().nullable() }).nullable(),
});

export interface PayrollPeriodDetailsRead {
  /** Visible periods older than the ones returned (list reads only). */
  olderPeriodCount: number;
  periods: readonly PayrollPeriodRead[];
  /** Set when the requested statement belongs to an earlier calculation run. */
  staleStatement: { currentStatementId: string | null } | null;
}

/** Parses get_payroll_period_details(); throws on a payload that breaks the contract. */
export function parsePayrollPeriodDetails(payload: unknown): PayrollPeriodDetailsRead {
  const parsed = payrollPeriodDetailsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("PAYROLL_PERIOD_DETAILS_INVALID");
  }

  return {
    olderPeriodCount: parsed.data.olderPeriodCount,
    periods: parsed.data.periods.map((period) => ({
      ...period,
      // A period without a calculation run has no statements; show it as the
      // first revision, as the earlier reader did.
      currentRevision: period.currentRevision ?? 1,
      statements: period.statements.map((statement) => ({
        ...statement,
        lines: statement.lines.map((line) => ({ ...line, payrollStatementId: statement.id })),
      })),
    })),
    staleStatement: parsed.data.staleStatement,
  };
}

/**
 * Payslip totals are summed from the statement's lines, so the lines must add
 * up to the totals the reader returned with them. The RPC builds both from the
 * same rows in one snapshot, so this is a check on the read itself (a cut,
 * filtered or mangled payload), not on stored data: returns the ids of
 * statements whose earning lines, deduction lines or payable disagree.
 */
export function findUnreconciledStatementIds(periods: readonly PayrollPeriodRead[]): string[] {
  const unreconciled: string[] = [];
  for (const period of periods) {
    for (const statement of period.statements) {
      let earningsVnd = 0;
      let deductionsVnd = 0;
      for (const line of statement.lines) {
        if (line.direction === "earning") earningsVnd += line.amountVnd;
        else if (line.direction === "deduction") deductionsVnd += line.amountVnd;
      }
      if (
        earningsVnd !== statement.totalEarningsVnd
        || deductionsVnd !== statement.totalDeductionsVnd
        || statement.totalEarningsVnd - statement.totalDeductionsVnd !== statement.payableAmountVnd
      ) {
        unreconciled.push(statement.id);
      }
    }
  }
  return unreconciled;
}

/** What to tell a viewer when a read did not reconcile: recalculating is a payroll.manage action. */
export function getUnreconciledReadMessage(canRecalculate: boolean): string {
  return canRecalculate
    ? "Các dòng lương chưa khớp với tổng của phiếu lương. Vui lòng tải lại sau ít phút; nếu vẫn lỗi, mở kỳ lương và bấm Tính lại."
    : "Các dòng lương chưa khớp với tổng của phiếu lương. Vui lòng tải lại sau ít phút; nếu vẫn lỗi, báo quản lý lương.";
}

export type PayrollReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
