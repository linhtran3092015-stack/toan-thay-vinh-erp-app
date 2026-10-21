import "server-only";

import { overviewSchema, type AiGradingOverview } from "@/features/ai-grading/settings";
import { getAnthropicApiKey, getCronSecret } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AiGradingOverviewResult =
  | { apiKeyConfigured: boolean; cronConfigured: boolean; data: AiGradingOverview; ok: true }
  | { error: string; ok: false };

/** Cài đặt → Chấm bài AI: settings, spend and queue counts (needs settings.view). */
export async function getAiGradingOverview(): Promise<AiGradingOverviewResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_ai_grading_overview");
    if (error) return { error: "Không tải được cài đặt chấm bài AI.", ok: false };
    const parsed = overviewSchema.safeParse(data);
    if (!parsed.success) return { error: "Dữ liệu chấm bài AI không hợp lệ.", ok: false };
    return { apiKeyConfigured: getAnthropicApiKey() !== null, cronConfigured: getCronSecret() !== null, data: parsed.data, ok: true };
  } catch {
    return { error: "Không tải được cài đặt chấm bài AI.", ok: false };
  }
}
