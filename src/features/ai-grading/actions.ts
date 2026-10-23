"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PHRASE_SLOTS, type PhraseSlot } from "@/features/ai-grading/comment";
import { kickGradingWorker } from "@/features/ai-grading/kick";
import { aiGradingSettingsPayload, aiGradingSettingsSchema, type AiGradingSettings } from "@/features/ai-grading/settings";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AiGradingActionResult = { message: string; ok: boolean };

const PAGE_PATH = "/settings/ai-grading";
const OWNER_ONLY = "Chỉ chủ trung tâm (quyền settings.manage) được sửa cài đặt chấm bài AI.";

async function canManageSettings(): Promise<boolean> {
  const permissions = await getDatabasePermissions();
  return permissions.ok && permissions.permissions.includes("settings.manage");
}

function rpcMessage(message: string): string {
  if (message.includes("SYSTEM_SETTINGS_PERMISSION_DENIED")) return OWNER_ONLY;
  if (message.includes("SYSTEM_SETTINGS_INVALID_AI_BUDGET")) return "Trần chi phí ngày phải là số nguyên từ 1 đến 200 USD.";
  if (message.includes("SYSTEM_SETTINGS_INVALID_VALUE")) return "Có lựa chọn không hợp lệ. Tải lại trang rồi thử lại.";
  return "Không lưu được cài đặt. Vui lòng thử lại.";
}

export async function updateAiGradingSettingsAction(input: AiGradingSettings): Promise<AiGradingActionResult> {
  const parsed = aiGradingSettingsSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Cài đặt không hợp lệ.", ok: false };
  if (!(await canManageSettings())) return { message: OWNER_ONLY, ok: false };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("update_system_settings", { p_values: aiGradingSettingsPayload(parsed.data) });
    if (error) return { message: rpcMessage(error.message), ok: false };
    if (parsed.data.enabled) kickGradingWorker("settings_saved");
    revalidatePath(PAGE_PATH);
    return {
      message: parsed.data.enabled ? "Đã lưu. Chấm bài AI đang bật." : "Đã lưu. Chấm bài AI đang tắt: bài nộp chờ đến khi bật lại.",
      ok: true,
    };
  } catch {
    return { message: "Không thể kết nối hệ thống cài đặt.", ok: false };
  }
}

/** "Chạy lại ngay": clears a pause after the owner fixed its cause (credit, key, limit). */
export async function resumeAiGradingAction(): Promise<AiGradingActionResult> {
  if (!(await canManageSettings())) return { message: OWNER_ONLY, ok: false };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("resume_ai_grading");
    if (error) return { message: rpcMessage(error.message), ok: false };
    kickGradingWorker("resumed");
    revalidatePath(PAGE_PATH);
    return { message: "Đã cho chạy lại. Nếu nguyên nhân chưa hết, hàng đợi sẽ tự dừng lại và báo tiếp.", ok: true };
  } catch {
    return { message: "Không thể kết nối hệ thống cài đặt.", ok: false };
  }
}

const phrasesSchema = z
  .array(z.object({ slot: z.enum(PHRASE_SLOTS), text: z.string().trim().min(1, "Câu mẫu không được để trống.").max(500, "Mỗi câu tối đa 500 ký tự.") }))
  .max(120);

/** Owner replaces the comment phrase library (every slot keeps at least one phrase). */
export async function updateGradingPhrasesAction(input: Array<{ slot: PhraseSlot; text: string }>): Promise<AiGradingActionResult> {
  const parsed = phrasesSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Câu mẫu không hợp lệ.", ok: false };
  const missing = PHRASE_SLOTS.filter((slot) => !parsed.data.some((phrase) => phrase.slot === slot));
  if (missing.length > 0) return { message: "Mỗi ô cần ít nhất một câu mẫu.", ok: false };
  if (!(await canManageSettings())) return { message: OWNER_ONLY, ok: false };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("set_grading_comment_phrases", { p_phrases: parsed.data });
    if (error) {
      if (error.message.includes("GRADING_PHRASES_SLOT_COUNT")) return { message: "Mỗi ô cần từ 1 đến 20 câu mẫu.", ok: false };
      if (error.message.includes("GRADING_PHRASES_INVALID")) return { message: "Có câu mẫu trống hoặc quá 500 ký tự.", ok: false };
      return { message: rpcMessage(error.message), ok: false };
    }
    revalidatePath(PAGE_PATH);
    return { message: `Đã lưu ${parsed.data.length} câu mẫu. Bản nháp nhận xét mới dùng ngay; nhận xét đã duyệt không đổi.`, ok: true };
  } catch {
    return { message: "Không thể kết nối hệ thống cài đặt.", ok: false };
  }
}
