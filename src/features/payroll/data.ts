import "server-only";

import type {
  PayrollDashboardEntry,
  PayrollManagementOverviewRead,
  PayrollPeriodRead,
  PayrollReadResult,
} from "@/features/payroll/read-models";
import {
  enrichPayrollPeriodsWithExplanations,
  normalizePayrollPeriodsWithDetailsRows,
} from "@/features/payroll/read-models";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
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

export async function getPayrollPeriodsWithDetailsResult(): Promise<
  PayrollReadResult<readonly PayrollPeriodRead[]>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const untypedRpcClient = supabase as unknown as {
      rpc: (name: string) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
    const [detailsResult, explanationsResult, paymentResult] = await Promise.all([
      // Every line of every period, paged under PostgREST's max_rows: payslip
      // totals are now summed from these lines, so a cut list would misstate them.
      fetchAllPages((from, to) => supabase.rpc("get_payroll_periods_with_details").range(from, to)),
      untypedRpcClient.rpc("get_payroll_explanations"),
      // Payment facts live on the period row; the details RPC predates them.
      supabase.from("payroll_periods").select("id, paid_at, paid_on, payment_reference"),
    ]);

    if (detailsResult.error || !detailsResult.data || explanationsResult.error || paymentResult.error) {
      return { ok: false };
    }

    const paymentById = new Map(
      (paymentResult.data ?? []).map((row) => [row.id, row]),
    );
    // Pages are separate reads: a write between two requests can shift a row
    // onto the next page too, so keep each line once.
    const seenLineIds = new Set<string>();
    const detailRows = detailsResult.data.filter((row) => {
      if (row.payroll_line_item_id === null) return true;
      if (seenLineIds.has(row.payroll_line_item_id)) return false;
      seenLineIds.add(row.payroll_line_item_id);
      return true;
    });
    const periods = enrichPayrollPeriodsWithExplanations(
      normalizePayrollPeriodsWithDetailsRows(detailRows),
      explanationsResult.data,
    ).map((period) => {
      const payment = paymentById.get(period.id);
      return {
        ...period,
        paidAt: payment?.paid_at ?? null,
        paidOn: payment?.paid_on ?? null,
        paymentReference: payment?.payment_reference ?? null,
      };
    });

    return { data: periods, ok: true };
  } catch {
    return { ok: false };
  }
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
