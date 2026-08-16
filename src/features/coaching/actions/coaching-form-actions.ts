"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { coachingQuestionTypes } from "@/features/coaching/forms/coaching-form-types";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

type ActionState = { message: string; status: "error" | "success"; formId?: string; linkUrl?: string };

const questionSchema = z.object({
  configuration: z.record(z.string(), z.unknown()),
  description: z.string().max(4000),
  required: z.boolean(),
  title: z.string().trim().min(1).max(1000),
  type: z.enum(coachingQuestionTypes),
});
const draftSchema = z.object({ formId: z.string().uuid().nullable(), instructions: z.string().max(4000), name: z.string().trim().min(1).max(240), questions: z.array(questionSchema).min(0).max(100), title: z.string().trim().min(1).max(240) });

async function permitted(code: string): Promise<string | null> {
  const result = await getDatabasePermissions();
  if (!result.ok) return "Không thể xác minh quyền. Vui lòng đăng nhập lại.";
  return result.permissions.includes(code as never) ? null : `Tài khoản hiện tại không có quyền ${code}.`;
}

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (text.includes("COACHING_FORM_QUESTION_INVALID")) return "Cấu hình câu hỏi chưa hợp lệ.";
  if (text.includes("COACHING_FORM_QUESTIONS_REQUIRED")) return "Cần có ít nhất một câu hỏi trước khi xuất bản.";
  if (text.includes("COACHING_FORM_VERSION_IMMUTABLE")) return "Phiên bản đã xuất bản không thể chỉnh sửa.";
  if (text.includes("COACHING_LINK_INVALID")) return "Liên kết hoặc thời hạn không hợp lệ.";
  return "Không thể lưu dữ liệu Coaching. Dữ liệu chưa được thay đổi.";
}

export async function saveCoachingFormDraftAction(input: z.infer<typeof draftSchema>): Promise<ActionState> {
  const denied = await permitted("coaching_forms.manage"); if (denied) return { status: "error", message: denied };
  const parsed = draftSchema.safeParse(input); if (!parsed.success) return { status: "error", message: "Vui lòng kiểm tra lại biểu mẫu." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("save_coaching_form_draft", { p_form_id: (parsed.data.formId ?? null) as unknown as string, p_instructions: parsed.data.instructions, p_name: parsed.data.name, p_questions: parsed.data.questions as unknown as Json, p_title: parsed.data.title });
    if (error || !data?.[0]?.form_id) return { status: "error", message: message(error) };
    revalidatePath("/coaching/forms"); revalidatePath(`/coaching/forms/${data[0].form_id}`);
    return { status: "success", message: "Đã lưu bản nháp biểu mẫu.", formId: data[0].form_id };
  } catch (error) { return { status: "error", message: message(error) }; }
}

export async function publishCoachingFormAction(formVersionId: string): Promise<ActionState> {
  const denied = await permitted("coaching_forms.publish"); if (denied) return { status: "error", message: denied };
  try { const s = await createSupabaseServerClient(); const { data, error } = await s.rpc("publish_coaching_form_version", { p_form_version_id: formVersionId }); if (error || !data?.[0]?.form_id) return { status: "error", message: message(error) }; revalidatePath("/coaching/forms"); revalidatePath(`/coaching/forms/${data[0].form_id}`); return { status: "success", message: "Đã xuất bản phiên bản biểu mẫu." }; } catch (error) { return { status: "error", message: message(error) }; }
}

export async function createCoachingFormVersionDraftAction(formId: string): Promise<ActionState> {
  const denied = await permitted("coaching_forms.manage"); if (denied) return { status: "error", message: denied };
  try { const s = await createSupabaseServerClient(); const { error } = await s.rpc("create_coaching_form_version_draft", { p_form_id: formId }); if (error) return { status: "error", message: message(error) }; revalidatePath(`/coaching/forms/${formId}`); return { status: "success", message: "Đã tạo bản nháp phiên bản mới." }; } catch (error) { return { status: "error", message: message(error) }; }
}

export async function issueCoachingPublicLinkAction(input: { coachingRecordId: string; formVersionId: string; expiresAt: string }): Promise<ActionState> {
  const denied = await permitted("coaching_links.manage"); if (denied) return { status: "error", message: denied };
  const parsed = z.object({ coachingRecordId: z.string().uuid(), formVersionId: z.string().uuid(), expiresAt: z.string().datetime({ offset: true }) }).safeParse(input); if (!parsed.success) return { status: "error", message: "Thời hạn liên kết không hợp lệ." };
  const token = randomBytes(32).toString("base64url"); const tokenHash = createHash("sha256").update(token).digest("hex");
  try { const s = await createSupabaseServerClient(); const { error } = await s.rpc("issue_coaching_public_link", { p_coaching_record_id: parsed.data.coachingRecordId, p_expires_at: parsed.data.expiresAt, p_form_version_id: parsed.data.formVersionId, p_token_hash: tokenHash }); if (error) return { status: "error", message: message(error) }; revalidatePath(`/coaching/${parsed.data.coachingRecordId}`); return { status: "success", message: "Đã tạo liên kết. Hãy sao chép ngay vì token không được lưu dạng rõ.", linkUrl: `/coaching/form/${token}` }; } catch (error) { return { status: "error", message: message(error) }; }
}

export async function revokeCoachingPublicLinkAction(input: { coachingRecordId: string; linkId: string; reason: string }): Promise<ActionState> {
  const denied = await permitted("coaching_links.manage"); if (denied) return { status: "error", message: denied };
  const parsed = z.object({ coachingRecordId: z.string().uuid(), linkId: z.string().uuid(), reason: z.string().trim().min(1).max(1000) }).safeParse(input); if (!parsed.success) return { status: "error", message: "Cần nêu lý do thu hồi liên kết." };
  try { const s = await createSupabaseServerClient(); const { error } = await s.rpc("revoke_coaching_public_link", { p_link_id: parsed.data.linkId, p_reason: parsed.data.reason }); if (error) return { status: "error", message: message(error) }; revalidatePath(`/coaching/${parsed.data.coachingRecordId}`); return { status: "success", message: "Đã thu hồi liên kết." }; } catch (error) { return { status: "error", message: message(error) }; }
}
