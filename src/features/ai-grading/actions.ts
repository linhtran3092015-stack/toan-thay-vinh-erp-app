"use server";

import { revalidatePath } from "next/cache";

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
