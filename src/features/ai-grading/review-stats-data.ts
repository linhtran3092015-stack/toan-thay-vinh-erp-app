import "server-only";

import { REVIEW_STATS_DAYS, reviewerStatsRowSchema, type ReviewerStats } from "@/features/ai-grading/review-stats";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReviewerStatsResult = { ok: true; rows: ReviewerStats[] } | { error: string; ok: false };

/** Approvals of the last 30 days per reviewer (needs settings.view). */
export async function getAiGradingReviewerStats(): Promise<ReviewerStatsResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_ai_grading_review_stats", { p_days: REVIEW_STATS_DAYS });
    if (error) return { error: "Không tải được thống kê duyệt bài.", ok: false };
    const parsed = reviewerStatsRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) return { error: "Dữ liệu thống kê duyệt bài không hợp lệ.", ok: false };
    return { ok: true, rows: parsed.data };
  } catch {
    return { error: "Không tải được thống kê duyệt bài.", ok: false };
  }
}
