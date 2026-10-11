import type { Database } from "@/types/database.generated";
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

type GeneratedPayrollPeriodsWithDetailsRow = Database["public"]["Functions"]["get_payroll_periods_with_details"]["Returns"][number];

export type PayrollPeriodsWithDetailsRow =
  GeneratedPayrollPeriodsWithDetailsRow;

type MutablePayrollStatement = Omit<PayrollStatementRead, "lines"> & {
  lines: PayrollLineRead[];
};

type MutablePayrollPeriod = Omit<PayrollPeriodRead, "statements"> & {
  statements: MutablePayrollStatement[];
};

/**
 * Preserves the server-owned flat ordering while grouping the read-only
 * Payroll 0 snapshot by its stable period, statement, and line identifiers.
 */
export function normalizePayrollPeriodsWithDetailsRows(
  rows: readonly PayrollPeriodsWithDetailsRow[],
): readonly PayrollPeriodRead[] {
  const periods = new Map<string, MutablePayrollPeriod>();
  const statements = new Map<string, MutablePayrollStatement>();

  for (const row of rows) {
    if (
      row.payroll_period_id === null ||
      row.period_month === null ||
      row.pay_date === null ||
      row.period_status === null
    ) {
      throw new Error("PAYROLL_DETAILS_PERIOD_ROW_INCOMPLETE");
    }

    let period = periods.get(row.payroll_period_id);

    if (!period) {
      period = {
        blockingIssueCount: 0,
        currentRevision: 1,
        feedbackClosedAt: null,
        feedbackOpenedAt: null,
        id: row.payroll_period_id,
        lastCalculatedAt: null,
        payDate: row.pay_date,
        periodMonth: row.period_month,
        status: row.period_status,
        pendingCorrectionCount: 0,
        statements: [],
      };
      periods.set(period.id, period);
    }

    if (row.payroll_statement_id === null) {
      continue;
    }

    let statement = statements.get(row.payroll_statement_id);

    if (!statement) {
      if (
        row.staff_id === null ||
        row.staff_display_name === null ||
        row.work_units === null ||
        row.work_hours === null ||
        row.total_earnings_vnd === null ||
        row.total_deductions_vnd === null ||
        row.payable_amount_vnd === null
      ) {
        throw new Error("PAYROLL_DETAILS_STATEMENT_ROW_INCOMPLETE");
      }

      statement = {
        id: row.payroll_statement_id,
        lines: [],
        payableAmountVnd: row.payable_amount_vnd,
        payrollPeriodId: row.payroll_period_id,
        staffDisplayName: row.staff_display_name,
        staffEmployeeCode: row.staff_employee_code,
        staffId: row.staff_id,
        totalDeductionsVnd: row.total_deductions_vnd,
        totalEarningsVnd: row.total_earnings_vnd,
        workHours: row.work_hours,
        workMinutes: row.work_hours * 60,
        workUnits: row.work_units,
      };
      statements.set(statement.id, statement);
      period.statements.push(statement);
    }

    if (row.payroll_line_item_id === null) {
      continue;
    }

    if (
      row.line_type === null ||
      row.line_direction === null ||
      row.line_amount_vnd === null
    ) {
      throw new Error("PAYROLL_DETAILS_LINE_ROW_INCOMPLETE");
    }

    statement.lines.push({
      amountVnd: row.line_amount_vnd,
      direction: row.line_direction,
      evidenceSnapshot: {},
      formulaSnapshot: {},
      id: row.payroll_line_item_id,
      lineType: row.line_type,
      note: row.note,
      payrollStatementId: statement.id,
      policyCode: null,
      quantity: row.unit_count,
      sourceKind: null,
      unitCount: row.unit_count,
      unitLabel: null,
      unitRateVnd: row.unit_rate_vnd,
      workMinutes: null,
    });
  }

  return [...periods.values()];
}

const payrollExplanationsSchema = z.object({
  lines: z.array(z.object({
    evidenceSnapshot: z.record(z.string(), z.unknown()),
    formulaSnapshot: z.record(z.string(), z.unknown()),
    id: z.string(),
    policyCode: z.string().nullable(),
    quantity: z.number().nullable(),
    sourceKind: z.string().nullable(),
    unitLabel: z.string().nullable(),
    workMinutes: z.number().int().nonnegative().nullable(),
  })),
  periods: z.array(z.object({
    blockingIssueCount: z.number().int().nonnegative(),
    currentRevision: z.number().int().positive(),
    feedbackClosedAt: z.string().nullable(),
    feedbackOpenedAt: z.string().nullable(),
    id: z.string(),
    lastCalculatedAt: z.string().nullable().optional().default(null),
    pendingCorrectionCount: z.number().int().nonnegative(),
  })),
  statements: z.array(z.object({
    id: z.string(),
    workMinutes: z.number().int().nonnegative(),
  })),
});

export function enrichPayrollPeriodsWithExplanations(
  periods: readonly PayrollPeriodRead[],
  payload: unknown,
): readonly PayrollPeriodRead[] {
  const parsed = payrollExplanationsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("PAYROLL_EXPLANATIONS_INVALID");
  }

  const periodById = new Map(parsed.data.periods.map((period) => [period.id, period]));
  const statementById = new Map(parsed.data.statements.map((statement) => [statement.id, statement]));
  const lineById = new Map(parsed.data.lines.map((line) => [line.id, line]));

  return periods.map((period) => {
    const explanation = periodById.get(period.id);
    return {
      ...period,
      ...(explanation ?? {}),
      statements: period.statements.map((statement) => ({
        ...statement,
        workMinutes: statementById.get(statement.id)?.workMinutes ?? statement.workMinutes,
        lines: statement.lines.map((line) => ({
          ...line,
          ...(lineById.get(line.id) ?? {}),
        })),
      })),
    };
  });
}

export type PayrollReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
