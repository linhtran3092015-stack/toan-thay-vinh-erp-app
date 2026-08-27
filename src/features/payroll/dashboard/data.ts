import "server-only";

import { z } from "zod";

import { buildPayrollDashboardData } from "@/features/payroll/dashboard/aggregate";
import type { PayrollDashboardResult } from "@/features/payroll/dashboard/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const dashboardSourceSchema = z.object({
  composition: z.array(z.object({
    amountVnd: z.number().int(),
    direction: z.enum(["earning", "deduction"]),
    lineType: z.string(),
    month: z.string(),
  })),
  periods: z.array(z.object({
    month: z.string(),
    status: z.string(),
  })),
  positionOptions: z.array(z.object({
    code: z.string().nullable(),
  })),
  selectedMonth: z.string(),
  selectedPositionCode: z.string().nullable(),
  statements: z.array(z.object({
    month: z.string(),
    payableAmountVnd: z.number().int(),
    payrollStatementId: z.string().uuid(),
    periodStatus: z.string(),
    positionCode: z.string().nullable(),
    staffDisplayName: z.string(),
    staffEmployeeCode: z.string().nullable(),
    staffId: z.string().uuid(),
    totalDeductionsVnd: z.number().int(),
    totalEarningsVnd: z.number().int(),
  })),
});

export async function getOwnerPayrollDashboardResult(options: {
  positionCode: string | null;
  selectedMonth: string;
}): Promise<PayrollDashboardResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.rpc(
      "get_owner_payroll_dashboard",
      options.positionCode
        ? {
            p_position_code: options.positionCode,
            p_selected_month: options.selectedMonth,
          }
        : { p_selected_month: options.selectedMonth },
    );

    if (result.error) return { ok: false };
    const parsed = dashboardSourceSchema.safeParse(result.data);
    if (!parsed.success) return { ok: false };

    return {
      data: buildPayrollDashboardData(parsed.data),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}
