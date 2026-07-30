import "server-only";

import type {
  SalesCommissionAccrualDashboardEntry,
  SalesCommissionAccrualReadResult,
} from "@/features/commissions/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeLeadSourceGroup(value: string): "mma" | "sandbox" {
  return value === "sandbox" ? "sandbox" : "mma";
}

export async function getSalesCommissionAccrualsDashboardResult(): Promise<
  SalesCommissionAccrualReadResult<
    readonly SalesCommissionAccrualDashboardEntry[]
  >
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "get_sales_commission_accruals_dashboard",
      { p_limit: 200 },
    );

    if (error || !data) {
      return { ok: false };
    }

    return {
      data: data.map((entry) => ({
        id: entry.sales_commission_accrual_id,
        leadSourceCode: entry.lead_source_code,
        leadSourceGroup: normalizeLeadSourceGroup(entry.lead_source_group),
        leadSourceName: entry.lead_source_name,
        recognizedAt: entry.recognized_at,
        recognizedRevenueVnd: entry.recognized_revenue_vnd,
        saleOwnerDisplayName: entry.sale_owner_display_name,
        saleOwnerEmployeeCode: entry.sale_owner_employee_code,
        saleOwnerId: entry.sale_owner_id,
        sourceCashflowRecordId: entry.source_cashflow_record_id,
        status: "provisional",
        studentFullName: entry.student_full_name,
        studentId: entry.student_id,
        studentPublicCode: entry.student_public_code,
      })),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}
