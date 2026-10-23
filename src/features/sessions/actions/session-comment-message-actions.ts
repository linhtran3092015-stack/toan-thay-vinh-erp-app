"use server";

import { z } from "zod";

import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CommentMessageResult = { message: string; ok: false } | { ok: true; text: string };

/**
 * "Sao chép tin Zalo": the whole parent comment message exactly as the Zalo queue renders it, in
 * one piece, so a TA can paste it into Zalo by hand with a single copy.
 */
export async function getSessionCommentMessageAction(input: { resultId: string }): Promise<CommentMessageResult> {
  const parsed = z.object({ resultId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { message: "Kết quả không hợp lệ.", ok: false };
  const permissions = await getDatabasePermissions();
  if (!permissions.ok) return { message: "Không thể xác minh quyền. Vui lòng thử lại.", ok: false };
  if (!permissions.permissions.includes("results.view") && !permissions.permissions.includes("results.manage")) {
    return { message: permissionDeniedMessage("results.view"), ok: false };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_session_comment_message", { p_result_id: parsed.data.resultId });
    if (error) return { message: "Không dựng được tin nhận xét. Tải lại trang rồi thử lại.", ok: false };
    if (typeof data !== "string" || data.trim() === "") return { message: "Kết quả này chưa có nhận xét.", ok: false };
    return { ok: true, text: data };
  } catch {
    return { message: "Không kết nối được máy chủ. Vui lòng thử lại.", ok: false };
  }
}
