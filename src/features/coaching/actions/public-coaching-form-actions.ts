"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

export type PublicSubmissionState = { message: string; status: "error" | "success" };

export async function submitPublicCoachingFormAction(
  token: string,
  answers: Record<string, unknown>,
): Promise<PublicSubmissionState> {
  const parsed = z.object({ token: z.string().min(32).max(256), answers: z.record(z.string().uuid(), z.unknown()) }).safeParse({ token, answers });
  if (!parsed.success) return { status: "error", message: "Dữ liệu phiếu không hợp lệ." };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("submit_public_coaching_form", { p_answers: parsed.data.answers as Json, p_token: parsed.data.token });
    if (!error) return { status: "success", message: "Phiếu Coaching đã được gửi thành công." };
    if (error.message.includes("COACHING_PUBLIC_LINK_SUBMITTED")) return { status: "error", message: "Phiếu này đã được gửi." };
    if (error.message.includes("COACHING_PUBLIC_LINK_EXPIRED")) return { status: "error", message: "Liên kết đã hết hạn." };
    if (error.message.includes("COACHING_PUBLIC_LINK_REVOKED")) return { status: "error", message: "Liên kết không còn hiệu lực." };
    if (error.message.includes("COACHING_PUBLIC_ANSWER_REQUIRED")) return { status: "error", message: "Vui lòng trả lời các câu hỏi bắt buộc." };
    return { status: "error", message: "Câu trả lời chưa hợp lệ. Vui lòng kiểm tra lại." };
  } catch { return { status: "error", message: "Không thể gửi phiếu lúc này. Vui lòng thử lại." }; }
}
