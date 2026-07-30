import "server-only";

import type {
  PayrollDashboardEntry,
  PayrollPeriodStatus,
  PayrollReadResult,
} from "@/features/payroll/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizePeriodStatus(value: string): PayrollPeriodStatus {
  if (value === "draft" || value === "review" || value === "approved") {
    return value;
  }

  return "draft";
}

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
        periodStatus: normalizePeriodStatus(entry.period_status),
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
