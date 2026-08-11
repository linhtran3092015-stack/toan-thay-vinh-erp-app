import "server-only";

import type {
  SalaryAdvanceDashboardEntry,
  SalaryAdvanceReadResult,
} from "@/features/advances/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSalaryAdvancesDashboardResult(): Promise<
  SalaryAdvanceReadResult<readonly SalaryAdvanceDashboardEntry[]>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_salary_advances_dashboard");

    if (error || !data) {
      return { ok: false };
    }

    return {
      data: data.map((entry) => ({
        amountVnd: entry.amount_vnd,
        approvalNote: entry.approval_note,
        approvedAt: entry.approved_at,
        approvedByDisplayName: entry.approved_by_display_name,
        deductionPayrollPeriodId: entry.deduction_payroll_period_id,
        deductionPeriodMonth: entry.deduction_period_month,
        deductedAt: entry.deducted_at,
        id: entry.salary_advance_id,
        rejectedAt: entry.rejected_at,
        rejectedByDisplayName: entry.rejected_by_display_name,
        rejectionReason: entry.rejection_reason,
        requestNote: entry.request_note,
        requestedAt: entry.requested_at,
        reviewNote: entry.review_note,
        reviewedAt: entry.reviewed_at,
        reviewedByDisplayName: entry.reviewed_by_display_name,
        staffDisplayName: entry.staff_display_name,
        staffEmployeeCode: entry.staff_employee_code,
        staffId: entry.staff_id,
        status: entry.advance_status,
      })),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}
