import type { Database } from "@/types/database.generated";

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
  id: string;
  lineType: string;
  note: string | null;
  payrollStatementId: string;
  unitCount: number | null;
  unitRateVnd: number | null;
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
  workUnits: number;
}

export interface PayrollPeriodRead {
  id: string;
  payDate: string;
  periodMonth: string;
  // Transport the stored value exactly. Payroll 0 must not coerce unknown
  // database states into a mutable client lifecycle.
  status: string;
  statements: readonly PayrollStatementRead[];
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
        id: row.payroll_period_id,
        payDate: row.pay_date,
        periodMonth: row.period_month,
        status: row.period_status,
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
      id: row.payroll_line_item_id,
      lineType: row.line_type,
      note: row.note,
      payrollStatementId: statement.id,
      unitCount: row.unit_count,
      unitRateVnd: row.unit_rate_vnd,
    });
  }

  return [...periods.values()];
}

export type PayrollReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
