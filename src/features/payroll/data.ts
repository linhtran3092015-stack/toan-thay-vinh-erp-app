import "server-only";

import type {
  PayrollDashboardEntry,
  PayrollManagementOverviewRead,
  PayrollPeriodDetailsRead,
  PayrollReadResult,
} from "@/features/payroll/read-models";
import {
  findUnreconciledStatementIds,
  parsePayrollPeriodDetails,
} from "@/features/payroll/read-models";
import {
  MAX_PAYROLL_PERIOD_COUNT,
  RECENT_PAYROLL_PERIOD_COUNT,
} from "@/features/payroll/period-window";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const payrollManagementOverviewSchema = z.object({
  correctionRequests: z.array(z.object({
    id: z.string().uuid(),
    items: z.array(z.object({
      evidenceUrl: z.string().nullable(),
      id: z.string().uuid(),
      itemLabel: z.string(),
      requestedChange: z.string(),
    })),
    payrollPeriodId: z.string().uuid(),
    payrollStatementId: z.string().uuid(),
    requestMessage: z.string(),
    requestedAt: z.string(),
    requestedBy: z.string().uuid(),
    responseMessage: z.string().nullable(),
    staffDisplayName: z.string(),
    status: z.enum(["pending", "accepted", "rejected"]),
  })),
  importBatches: z.array(z.object({
    conflictRows: z.number().int().nonnegative(),
    datasetType: z.enum(["timekeeping", "grading", "renewal_orders", "new_enrollment_orders"]),
    errorRows: z.number().int().nonnegative(),
    fileName: z.string(),
    id: z.string().uuid(),
    periodMonth: z.string(),
    status: z.enum(["pending_review", "approved", "rejected"]),
    totalRows: z.number().int().nonnegative(),
    uploadedAt: z.string(),
    validRows: z.number().int().nonnegative(),
  })),
  issues: z.array(z.object({
    details: z.record(z.string(), z.unknown()),
    id: z.string().uuid(),
    issueCode: z.string(),
    payrollPeriodId: z.string().uuid(),
    periodMonth: z.string(),
    revision: z.number().int().positive(),
    severity: z.enum(["blocking", "warning"]),
    sourceFactId: z.string().uuid().nullable(),
    staffDisplayName: z.string().nullable().optional(),
    staffEmail: z.string().nullable().optional(),
    staffEmployeeCode: z.string().nullable().optional(),
    staffId: z.string().uuid().nullable(),
  })),
});

export async function getPayrollDashboardResult(): Promise<
  PayrollReadResult<readonly PayrollDashboardEntry[]>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_payroll_dashboard");

    if (error) {
      return { ok: false };
    }

    return {
      data: data.map((entry) => ({
        payDate: entry.pay_date,
        payableAmountVnd: entry.payable_amount_vnd,
        payrollPeriodId: entry.payroll_period_id,
        payrollStatementId: entry.payroll_statement_id,
        periodMonth: entry.period_month,
        periodStatus: entry.period_status,
        staffDisplayName: entry.staff_display_name,
        staffEmployeeCode: entry.staff_employee_code || null,
        staffId: entry.staff_id,
        totalDeductionsVnd: entry.total_deductions_vnd,
        totalEarningsVnd: entry.total_earnings_vnd,
        workHours: entry.work_hours,
        workUnits: entry.work_units,
      })),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

export type PayrollDetailsReadResult =
  | { data: PayrollPeriodDetailsRead; ok: true }
  // "unreconciled": a statement's lines did not add up to its totals on two reads.
  | { ok: false; reason: "unavailable" | "unreconciled" };

/**
 * One get_payroll_period_details() call is a single jsonb value built in one
 * snapshot, so its totals and lines agree unless the read was cut, filtered or
 * mangled on the way (the paged read this replaced could drop a line). Payslip
 * totals are summed from the lines, so on a mismatch read once more, then fail
 * closed rather than show totals the lines do not explain.
 */
async function readReconciledPayrollDetails(args: {
  p_payroll_period_id?: string;
  p_payroll_statement_id?: string;
  p_period_limit?: number;
  p_include_payroll_period_id?: string;
}): Promise<PayrollDetailsReadResult> {
  try {
    const supabase = await createSupabaseServerClient();
    let unreconciledIds: string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error } = await supabase.rpc("get_payroll_period_details", args);
      if (error) {
        console.error("PAYROLL_DETAILS_UNAVAILABLE", error.code, error.message);
        return { ok: false, reason: "unavailable" };
      }
      const details = parsePayrollPeriodDetails(data);
      unreconciledIds = findUnreconciledStatementIds(details.periods);
      if (unreconciledIds.length === 0) {
        return { data: details, ok: true };
      }
    }
    console.error("PAYROLL_DETAILS_UNRECONCILED", unreconciledIds.join(","));
    return { ok: false, reason: "unreconciled" };
  } catch (error) {
    console.error("PAYROLL_DETAILS_UNAVAILABLE", error instanceof Error ? error.message : "unknown");
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * The latest `periodCount` periods visible to the viewer, every period still in
 * draft or review, and `includedPeriodId` when given; newest first.
 */
export async function getRecentPayrollPeriodsResult(
  periodCount: number = RECENT_PAYROLL_PERIOD_COUNT,
  includedPeriodId: string | null = null,
): Promise<PayrollDetailsReadResult> {
  const limit = Math.min(Math.max(Math.trunc(periodCount) || RECENT_PAYROLL_PERIOD_COUNT, 1), MAX_PAYROLL_PERIOD_COUNT);
  return readReconciledPayrollDetails(
    includedPeriodId
      ? { p_include_payroll_period_id: includedPeriodId, p_period_limit: limit }
      : { p_period_limit: limit },
  );
}

/** One statement of one period's current calculation run (payslip page and PDF). */
export async function getPayrollStatementDetailsResult(
  payrollPeriodId: string,
  payrollStatementId: string,
): Promise<PayrollDetailsReadResult> {
  return readReconciledPayrollDetails({
    p_payroll_period_id: payrollPeriodId,
    p_payroll_statement_id: payrollStatementId,
  });
}

export async function getPayrollManagementOverviewResult(): Promise<
  PayrollReadResult<PayrollManagementOverviewRead>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const result = await (supabase as unknown as {
      rpc: (name: string) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("get_payroll_management_overview");
    if (result.error) return { ok: false };
    const parsed = payrollManagementOverviewSchema.safeParse(result.data);
    return parsed.success
      ? { data: parsed.data, ok: true }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}
