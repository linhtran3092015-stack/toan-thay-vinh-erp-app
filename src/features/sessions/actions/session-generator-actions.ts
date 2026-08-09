"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface DryRunSessionGenerationParams {
  academicYearId: string;
  startDate: string;
  endDate: string;
}

export interface MaterializeSessionGenerationParams {
  academicYearId: string;
  startDate: string;
  endDate: string;
  allowBackfill?: boolean;
  reason?: string;
}

export async function dryRunClassSessionGenerationAction(params: DryRunSessionGenerationParams) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return { success: false, error: "AUTHENTICATED_USER_REQUIRED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("dry_run_class_session_generation", {
    p_academic_year_id: params.academicYearId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function materializeClassSessionsAction(params: MaterializeSessionGenerationParams) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return { success: false, error: "AUTHENTICATED_USER_REQUIRED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("materialize_class_sessions", {
    p_academic_year_id: params.academicYearId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_allow_backfill: params.allowBackfill ?? false,
    p_reason: params.reason ?? "Bulk class session generation",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/sessions");
  revalidatePath("/classes");

  return { success: true, data };
}
