import "server-only";

import type {
  GradingCreditDashboardEntry,
  GradingCreditReadResult,
} from "@/features/grading-credits/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The dashboard summary's cap; `/grading-credits` asks for more (`GRADING_CREDITS_LIMIT`). */
const DEFAULT_GRADING_CREDITS_LIMIT = 200;

/** `limit` is the RPC's `p_limit` (1-500); callers that cut the list must say how many they asked for. */
export async function getGradingCreditsDashboardResult(
  limit = DEFAULT_GRADING_CREDITS_LIMIT,
): Promise<GradingCreditReadResult<readonly GradingCreditDashboardEntry[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "get_grading_credits_dashboard",
      { p_limit: limit },
    );

    if (error || !data) {
      return { ok: false };
    }

    return {
      data: data.map((entry) => ({
        classCode: entry.class_code,
        className: entry.class_name,
        classSessionId: entry.class_session_id,
        creditUnits: entry.credit_units,
        creditedAt: entry.credited_at,
        graderDisplayName: entry.grader_display_name,
        graderId: entry.grader_id,
        id: entry.grading_credit_id,
        sessionDate: entry.session_date,
        sessionResultId: entry.session_result_id,
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
