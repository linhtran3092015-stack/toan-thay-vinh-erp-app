import "server-only";

import { COMMISSIONS_DEFAULT_LIMIT } from "@/features/commissions/commission-directory-models";
import type {
  SalesCommissionAccrualDashboardEntry,
  SalesCommissionAccrualReadResult,
} from "@/features/commissions/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * `limit` is the RPC's `p_limit` (1-500, newest first by recognized_on). The
 * default (`COMMISSIONS_DEFAULT_LIMIT`, 200) is the RPC's own default and the
 * page's fallback; /commissions asks for 500 (`COMMISSIONS_LIMIT`) and tells
 * the page so it can flag a possibly cut month.
 */
export async function getSalesCommissionAccrualsDashboardResult(
  limit = COMMISSIONS_DEFAULT_LIMIT,
): Promise<
  SalesCommissionAccrualReadResult<
    readonly SalesCommissionAccrualDashboardEntry[]
  >
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "get_sales_commission_accruals_dashboard",
      { p_limit: limit },
    );

    if (error || !data) {
      return { ok: false };
    }

    return {
      data: data.map((entry) => ({
        id: entry.sales_commission_accrual_id,
        leadSourceCode: entry.lead_source_code,
        leadSourceGroup: entry.lead_source_group,
        leadSourceName: entry.lead_source_name,
        recognizedAt: entry.recognized_at,
        recognizedOn: entry.recognized_on,
        recognizedRevenueVnd: entry.recognized_revenue_vnd,
        saleOwnerDisplayName: entry.sale_owner_display_name,
        saleOwnerEmployeeCode: entry.sale_owner_employee_code,
        saleOwnerId: entry.sale_owner_id,
        sourceCashflowRecordId: entry.source_cashflow_record_id,
        status: entry.accrual_status,
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
