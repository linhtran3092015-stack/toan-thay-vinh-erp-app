import "server-only";

import { queueRowSchema, todaySchema, type AiGradingQueueSession, type AiGradingToday } from "@/features/ai-grading/queue";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AiGradingQueueResult =
  | { ok: true; sessions: AiGradingQueueSession[]; today: AiGradingToday | null }
  | { error: string; ok: false };

export async function getAiGradingQueue(range: { from: string; to: string }): Promise<AiGradingQueueResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const [sessions, today] = await Promise.all([
      supabase.rpc("list_ai_grading_sessions", { p_from: range.from, p_to: range.to }),
      supabase.rpc("get_ai_grading_today"),
    ]);
    if (sessions.error) return { error: "Không tải được danh sách buổi chấm bài AI.", ok: false };
    const rows = queueRowSchema.array().safeParse(sessions.data ?? []);
    if (!rows.success) return { error: "Dữ liệu chấm bài AI không hợp lệ.", ok: false };
    const todayParsed = today.error ? null : todaySchema.safeParse(today.data);
    return { ok: true, sessions: rows.data, today: todayParsed?.success ? todayParsed.data : null };
  } catch {
    return { error: "Không tải được danh sách buổi chấm bài AI.", ok: false };
  }
}
