"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PARENT_MESSAGE_MAX_CHARS, planMessageParts } from "@/features/parent-messages/comment-template";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getZaloGroupByThread,
  getZaloGroupMembers,
  listZaloAccounts,
  searchZaloGroups,
  sendZaloMessage,
  type ZaloCrmAccount,
  type ZaloCrmGroup,
  type ZaloCrmGroupMember,
} from "@/lib/zalo-crm";

export type ParentMessageActionResult = { message: string; ok: false } | { message: string; ok: true };

async function requirePermission(code: "attendance.mark" | "students.update" | "settings.manage"): Promise<string | null> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok) return "Không thể xác minh quyền. Vui lòng thử lại.";
  if (!permissions.permissions.includes(code)) {
    const labels = {
      "attendance.mark": "gửi tin nhắn phụ huynh (điểm danh buổi học)",
      "settings.manage": "quản lý cài đặt",
      "students.update": "cập nhật hồ sơ học sinh",
    };
    return `Tài khoản hiện tại không có quyền ${labels[code]}.`;
  }
  return null;
}

function rpcErrorMessage(error: { details?: string | null; message: string }): string {
  const message = error.message;
  // The lock reason comes from parent_message_send_block_reason ("Chưa có điểm vở; Chưa điền trợ giảng giám thị").
  if (message.includes("PARENT_MESSAGE_SEND_BLOCKED")) return `Chưa gửi được: ${error.details?.trim() || "tin chưa đủ điều kiện gửi"}.`;
  const known: Record<string, string> = {
    ATTENDANCE_MARK_PERMISSION_DENIED: "Tài khoản hiện tại không có quyền gửi tin nhắn phụ huynh.",
    PARENT_MESSAGE_CONTENT_CHANGED: "Nội dung tin vừa được cập nhật (điểm, nhận xét hoặc mẫu tin). Kiểm tra lại rồi bấm Gửi.",
    PARENT_MESSAGE_CONTENT_INVALID: "Nội dung tin phải có từ 1 đến 6.000 ký tự.",
    PARENT_MESSAGE_NOT_QUEUED: "Tin này không còn ở trạng thái chờ gửi. Tải lại trang.",
    PARENT_MESSAGE_NOT_SENDING: "Không ghi được kết quả gửi vì lượt gửi đã hết hạn. Tải lại trang để xem trạng thái.",
    PARENT_MESSAGE_PARTIALLY_SENT: "Tin đã gửi một phần nên không sửa được nữa.",
    PARENT_MESSAGE_PARTS_CHANGED: "Cách tách tin khác lần gửi trước nên không gửi tiếp được. Báo quản lý kiểm tra.",
    PARENT_MESSAGE_PART_OUT_OF_ORDER: "Không ghi được kết quả gửi. Tải lại trang để xem trạng thái.",
    PARENT_MESSAGE_SENDING: "Tin này đang được gửi. Đợi vài giây rồi tải lại trang.",
    PARENT_MESSAGE_TOO_LONG: "Tin quá dài: cần hơn 3 tin Zalo. Rút gọn nội dung trước khi gửi.",
    REASON_REQUIRED: "Vui lòng nhập lý do.",
    SESSION_MESSAGE_CONTACT_NAME_INVALID: "Nhập tên trợ giảng giám thị (tối đa 120 ký tự).",
    SESSION_MESSAGE_CONTACT_PHONE_INVALID: "Số điện thoại không hợp lệ (8–15 chữ số).",
    SESSION_NOT_FOUND: "Không tìm thấy buổi học.",
    STUDENT_NOT_FOUND: "Không tìm thấy học sinh.",
    STUDENT_UPDATE_PERMISSION_DENIED: "Tài khoản hiện tại không có quyền cập nhật hồ sơ học sinh.",
    ZALO_ACCOUNT_ID_REQUIRED: "Thiếu nick Zalo gửi. Chọn nick trung tâm trong Cài đặt.",
    ZALO_GROUP_ALREADY_LINKED_TO_ANOTHER_STUDENT: "Nhóm Zalo này đã được liên kết với một học sinh khác.",
    ZALO_GROUP_THREAD_ID_REQUIRED: "Thiếu mã nhóm Zalo.",
  };
  for (const [code, text] of Object.entries(known)) if (message.includes(code)) return text;
  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

const messageIdSchema = z.string().uuid();

/** Pause between the parts of one long message (owner decision: 1–2 seconds apart). */
const PART_DELAY_MS = 1500;

/**
 * TA sends one queued message through ZaloCRM. A long message goes as 2–3
 * consecutive Zalo messages; each part is recorded as it goes, so a retry after
 * a failed part resumes there and never repeats a part that already went.
 */
export async function sendParentMessageAction(input: { messageId: string }): Promise<ParentMessageActionResult> {
  const denied = await requirePermission("attendance.mark");
  if (denied) return { message: denied, ok: false };
  const parsed = messageIdSchema.safeParse(input.messageId);
  if (!parsed.success) return { message: "Mã tin không hợp lệ.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { data: row, error: readError } = await supabase
    .from("parent_messages")
    .select("id, status, content")
    .eq("id", parsed.data)
    .maybeSingle();
  if (readError || !row) return { message: "Không tìm thấy tin trong hàng đợi.", ok: false };
  if (row.status !== "queued" && row.status !== "failed") return { message: "Tin này không còn ở trạng thái chờ gửi.", ok: false };
  const plan = planMessageParts(row.content);
  if (!plan.ok) return { message: plan.reason, ok: false };

  // Checks the send lock and freezes the text while this send runs. The hash ties the lock to the
  // exact text split above: if a result or template change re-rendered it meanwhile, nothing is locked.
  const { data: started, error: beginError } = await supabase.rpc("begin_parent_message_send", {
    p_content_md5: createHash("md5").update(row.content, "utf8").digest("hex"),
    p_message_id: parsed.data,
    p_parts_total: plan.parts.length,
  });
  if (beginError || !started) {
    if (beginError?.message.includes("PARENT_MESSAGE_CONTENT_CHANGED")) revalidatePath("/parent-messages");
    return { message: rpcErrorMessage(beginError ?? { message: "" }), ok: false };
  }

  const parts = plan.parts;
  const total = parts.length;

  for (let index = started.parts_sent; index < total; index += 1) {
    if (index > started.parts_sent) await new Promise((resolve) => setTimeout(resolve, PART_DELAY_MS));
    const sent = await sendZaloMessage({
      content: parts[index],
      threadId: started.thread_id,
      threadType: started.thread_type === "user" ? "user" : "group",
      zaloAccountId: started.zalo_account_id,
    });
    const { error } = await supabase.rpc("record_parent_message_part", {
      p_error_message: sent.ok ? undefined : sent.error,
      p_message_id: parsed.data,
      p_part_no: index + 1,
      p_provider_message_id: sent.ok ? (sent.data.messageId ?? undefined) : undefined,
      p_success: sent.ok,
    });
    if (error) {
      revalidatePath("/parent-messages");
      return { message: rpcErrorMessage(error), ok: false };
    }
    if (!sent.ok) {
      revalidatePath("/parent-messages");
      const where = total > 1 ? ` ở tin ${index + 1}/${total}` : "";
      const resume = index > 0 ? ` Bấm Gửi lại để gửi tiếp từ tin ${index + 1}.` : "";
      return { message: `Gửi thất bại${where}: ${sent.error}.${resume}`, ok: false };
    }
  }

  revalidatePath("/parent-messages");
  return { message: total > 1 ? `Đã gửi vào nhóm Zalo (${total} tin liền nhau).` : "Đã gửi vào nhóm Zalo.", ok: true };
}

export async function updateParentMessageContentAction(input: { content: string; messageId: string }): Promise<ParentMessageActionResult> {
  const denied = await requirePermission("attendance.mark");
  if (denied) return { message: denied, ok: false };
  const parsed = z
    .object({ content: z.string().trim().min(1).max(PARENT_MESSAGE_MAX_CHARS), messageId: messageIdSchema })
    .safeParse(input);
  if (!parsed.success) return { message: "Nội dung tin phải có từ 1 đến 6.000 ký tự.", ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_parent_message_content", { p_content: parsed.data.content, p_message_id: parsed.data.messageId });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  revalidatePath("/parent-messages");
  return { message: "Đã lưu nội dung.", ok: true };
}

/** Supervisor name + grading phone for this session's comment messages (footer of the Zalo message). */
export async function setSessionMessageContactAction(input: {
  phone: string;
  sessionId: string;
  supervisorName: string;
}): Promise<ParentMessageActionResult> {
  const denied = await requirePermission("attendance.mark");
  if (denied) return { message: denied, ok: false };
  const parsed = z
    .object({
      phone: z.string().trim().min(1).max(30),
      sessionId: z.string().uuid(),
      supervisorName: z.string().trim().min(1).max(120),
    })
    .safeParse(input);
  if (!parsed.success) return { message: "Nhập tên trợ giảng giám thị và số điện thoại.", ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_session_message_contact", {
    p_class_session_id: parsed.data.sessionId,
    p_grading_contact_phone: parsed.data.phone,
    p_supervisor_name: parsed.data.supervisorName,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  revalidatePath("/parent-messages");
  return { message: "Đã lưu trợ giảng giám thị. Tin nhận xét đang chờ đã cập nhật.", ok: true };
}

export async function skipParentMessageAction(input: { messageId: string; reason: string }): Promise<ParentMessageActionResult> {
  const denied = await requirePermission("attendance.mark");
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ messageId: messageIdSchema, reason: z.string().trim().min(2).max(500) }).safeParse(input);
  if (!parsed.success) return { message: "Vui lòng nhập lý do bỏ qua (2–500 ký tự).", ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("skip_parent_message", { p_message_id: parsed.data.messageId, p_reason: parsed.data.reason });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  revalidatePath("/parent-messages");
  return { message: "Đã bỏ qua tin.", ok: true };
}

// ── Student ↔ Zalo group linking ─────────────────────────────────────────────

export type ZaloGroupSearchResult =
  | { groups: (ZaloCrmGroup & { members?: ZaloCrmGroupMember[] })[]; ok: true; total: number }
  | { message: string; ok: false };

export async function searchZaloGroupsAction(input: { search: string; withMembers?: boolean }): Promise<ZaloGroupSearchResult> {
  const denied = await requirePermission("students.update");
  if (denied) return { message: denied, ok: false };
  const search = input.search.trim().slice(0, 100);
  const result = await searchZaloGroups({ limit: 20, search });
  if (!result.ok) return { message: result.error, ok: false };
  const groups = await Promise.all(
    result.data.groups.map(async (group) => {
      if (!input.withMembers) return group;
      const members = await getZaloGroupMembers(group.externalThreadId);
      return { ...group, members: members.ok ? members.data.slice(0, 12) : [] };
    }),
  );
  return { groups, ok: true, total: result.data.total };
}

export async function linkStudentZaloGroupAction(input: {
  groupName: string | null;
  studentId: string;
  threadId: string;
  zaloAccountId: string;
}): Promise<ParentMessageActionResult> {
  const denied = await requirePermission("students.update");
  if (denied) return { message: denied, ok: false };
  const parsed = z
    .object({
      groupName: z.string().trim().max(200).nullable(),
      studentId: z.string().uuid(),
      threadId: z.string().trim().min(1).max(120),
      zaloAccountId: z.string().trim().min(1).max(120),
    })
    .safeParse(input);
  if (!parsed.success) return { message: "Thông tin nhóm không hợp lệ.", ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("link_student_zalo_group", {
    p_group_name: parsed.data.groupName ?? "",
    p_student_id: parsed.data.studentId,
    p_thread_id: parsed.data.threadId,
    p_zalo_account_id: parsed.data.zaloAccountId,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  revalidatePath(`/students/${parsed.data.studentId}`);
  return { message: "Đã liên kết nhóm sổ liên lạc.", ok: true };
}

export async function unlinkStudentZaloGroupAction(input: { reason: string; studentId: string }): Promise<ParentMessageActionResult> {
  const denied = await requirePermission("students.update");
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ reason: z.string().trim().min(2).max(500), studentId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { message: "Vui lòng nhập lý do gỡ liên kết.", ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unlink_student_zalo_group", { p_reason: parsed.data.reason, p_student_id: parsed.data.studentId });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  revalidatePath(`/students/${parsed.data.studentId}`);
  revalidatePath("/parent-messages");
  return { message: "Đã gỡ liên kết nhóm.", ok: true };
}

export type ZaloLinkCheckResult =
  | { accountStatus: string | null; groupName: string | null; membersCount: number | null; ok: true; present: boolean }
  | { message: string; ok: false };

/** Re-reads the group by its stable thread id (current name, whether the nick is still a member). */
export async function checkStudentZaloGroupAction(input: { threadId: string; zaloAccountId: string }): Promise<ZaloLinkCheckResult> {
  const result = await getZaloGroupByThread(input.threadId, input.zaloAccountId);
  if (!result.ok) return { message: result.error, ok: false };
  if (!result.data) return { accountStatus: null, groupName: null, membersCount: null, ok: true, present: false };
  return {
    accountStatus: result.data.zaloAccount?.status ?? null,
    groupName: result.data.groupName,
    membersCount: result.data.groupMembersCount,
    ok: true,
    present: true,
  };
}

export type ZaloAccountsResult = { accounts: ZaloCrmAccount[]; ok: true } | { message: string; ok: false };

export async function listZaloAccountsAction(): Promise<ZaloAccountsResult> {
  const denied = await requirePermission("settings.manage");
  if (denied) return { message: denied, ok: false };
  const result = await listZaloAccounts();
  return result.ok ? { accounts: result.data, ok: true } : { message: result.error, ok: false };
}
