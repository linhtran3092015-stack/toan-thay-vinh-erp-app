import "server-only";

import {
  type OwnerPayrollEstimate,
  ownerPayrollEstimateSchema,
  type StaffPayrollEstimate,
  staffPayrollEstimateSchema,
} from "@/features/payroll/estimate/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getMyPayrollEstimateResult(
  month: string,
): Promise<{ data: StaffPayrollEstimate; ok: true } | { error?: string; ok: false }> {
  try {
    const supabase = await createSupabaseServerClient();
    const result = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
      "get_my_payroll_estimate",
      { p_month: month },
    );

    if (result.error) {
      console.error("[getMyPayrollEstimateResult] RPC error:", result.error.message);
      return { error: result.error.message, ok: false };
    }

    const parsed = staffPayrollEstimateSchema.safeParse(result.data);
    if (!parsed.success) {
      console.error("[getMyPayrollEstimateResult] Validation error:", parsed.error.format());
      return { error: "Dữ liệu trả về không đúng định dạng", ok: false };
    }

    return { data: parsed.data, ok: true };
  } catch (error) {
    console.error("[getMyPayrollEstimateResult] Unexpected error:", error);
    return { ok: false };
  }
}

export async function getOwnerPayrollEstimateResult(options: {
  month: string;
  positionCode?: string | null;
}): Promise<{ data: OwnerPayrollEstimate; ok: true } | { error?: string; ok: false }> {
  try {
    const supabase = await createSupabaseServerClient();
    const result = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
      "get_owner_payroll_estimate",
      {
        p_month: options.month,
        p_position_code: options.positionCode ?? null,
      },
    );

    if (result.error) {
      console.error("[getOwnerPayrollEstimateResult] RPC error:", result.error.message);
      return { error: result.error.message, ok: false };
    }

    const parsed = ownerPayrollEstimateSchema.safeParse(result.data);
    if (!parsed.success) {
      console.error("[getOwnerPayrollEstimateResult] Validation error:", parsed.error.format());
      return { error: "Dữ liệu trả về không đúng định dạng", ok: false };
    }

    return { data: parsed.data, ok: true };
  } catch (error) {
    console.error("[getOwnerPayrollEstimateResult] Unexpected error:", error);
    return { ok: false };
  }
}
