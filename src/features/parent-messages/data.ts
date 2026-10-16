import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ParentMessageStatus = "queued" | "sent" | "failed" | "skipped" | "expired";

export interface ParentMessageQueueItem {
  attempts: number;
  classCode: string | null;
  classSessionId: string | null;
  content: string;
  /** A TA saved their own text: result changes no longer update it. */
  contentEdited: boolean;
  createdAt: string;
  errorMessage: string | null;
  eventCode: "attendance.unexcused_absence" | "session.comment";
  id: string;
  /** Parts already sent; a retry resumes after them. */
  partsSent: number;
  /** Fixed at the first send (null before). */
  partsTotal: number | null;
  /** Why Gửi is locked (queued/failed only), e.g. "Chưa có điểm vở". */
  sendBlockReason: string | null;
  sentAt: string | null;
  sentByName: string | null;
  sessionDate: string | null;
  skipReason: string | null;
  startTime: string | null;
  status: ParentMessageStatus;
  studentId: string;
  studentName: string;
  studentPublicCode: string;
  threadId: string;
  zaloAccountId: string;
  zaloGroupName: string | null;
}

const rowSchema = z.object({
  attempts: z.number().int(),
  class_code: z.string().nullable(),
  class_session_id: z.string().uuid().nullable(),
  content: z.string(),
  content_edited: z.boolean(),
  created_at: z.string(),
  error_message: z.string().nullable(),
  event_code: z.enum(["attendance.unexcused_absence", "session.comment"]),
  message_id: z.string().uuid(),
  parts_sent: z.number().int(),
  parts_total: z.number().int().nullable(),
  send_block_reason: z.string().nullable(),
  sent_at: z.string().nullable(),
  sent_by_name: z.string().nullable(),
  session_date: z.string().nullable(),
  skip_reason: z.string().nullable(),
  start_time: z.string().nullable(),
  status: z.enum(["queued", "sent", "failed", "skipped", "expired"]),
  student_id: z.string().uuid(),
  student_name: z.string(),
  student_public_code: z.string(),
  thread_id: z.string(),
  zalo_account_id: z.string(),
  zalo_group_name: z.string().nullable(),
});

export type ParentMessageQueueResult = { data: ParentMessageQueueItem[]; ok: true } | { error: string; ok: false };

export async function getParentMessageQueueResult(status: ParentMessageStatus | "all" = "queued", limit = 200): Promise<ParentMessageQueueResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_parent_message_queue", { p_limit: limit, p_status: status });
    if (error) return { error: "Không tải được hàng đợi tin nhắn phụ huynh.", ok: false };
    const parsed = z.array(rowSchema).safeParse(data ?? []);
    if (!parsed.success) return { error: "Dữ liệu hàng đợi không hợp lệ.", ok: false };
    return {
      data: parsed.data.map((row) => ({
        attempts: row.attempts,
        classCode: row.class_code,
        classSessionId: row.class_session_id,
        content: row.content,
        contentEdited: row.content_edited,
        createdAt: row.created_at,
        errorMessage: row.error_message,
        eventCode: row.event_code,
        id: row.message_id,
        partsSent: row.parts_sent,
        partsTotal: row.parts_total,
        sendBlockReason: row.send_block_reason,
        sentAt: row.sent_at,
        sentByName: row.sent_by_name,
        sessionDate: row.session_date,
        skipReason: row.skip_reason,
        startTime: row.start_time,
        status: row.status,
        studentId: row.student_id,
        studentName: row.student_name,
        studentPublicCode: row.student_public_code,
        threadId: row.thread_id,
        zaloAccountId: row.zalo_account_id,
        zaloGroupName: row.zalo_group_name,
      })),
      ok: true,
    };
  } catch {
    return { error: "Không tải được hàng đợi tin nhắn phụ huynh.", ok: false };
  }
}

export interface StudentZaloLink {
  groupNameSnapshot: string | null;
  linkedAt: string | null;
  threadId: string | null;
  zaloAccountId: string | null;
}

export async function getStudentZaloLink(studentId: string): Promise<StudentZaloLink | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("students")
      .select("zalo_group_thread_id, zalo_account_id, zalo_group_name_snapshot, zalo_group_linked_at")
      .eq("id", studentId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      groupNameSnapshot: data.zalo_group_name_snapshot,
      linkedAt: data.zalo_group_linked_at,
      threadId: data.zalo_group_thread_id,
      zaloAccountId: data.zalo_account_id,
    };
  } catch {
    return null;
  }
}

export interface SessionMessageContact {
  phone: string;
  supervisorName: string;
}

export interface SessionMessageContactState {
  /** This session's saved supervisor, if any. */
  saved: (SessionMessageContact & { updatedAt: string }) | null;
  /** The signed-in TA's most recent entry on another session, to pre-fill an empty form. */
  suggestion: SessionMessageContact | null;
}

/** Supervisor name + grading phone shown in the comment message footer (session_message_contacts). */
export async function getSessionMessageContact(sessionId: string): Promise<SessionMessageContactState> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("session_message_contacts")
      .select("supervisor_name, grading_contact_phone, updated_at")
      .eq("class_session_id", sessionId)
      .maybeSingle();
    if (!error && data) {
      return { saved: { phone: data.grading_contact_phone, supervisorName: data.supervisor_name, updatedAt: data.updated_at }, suggestion: null };
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { saved: null, suggestion: null };
    const { data: last } = await supabase
      .from("session_message_contacts")
      .select("supervisor_name, grading_contact_phone")
      .eq("updated_by", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { saved: null, suggestion: last ? { phone: last.grading_contact_phone, supervisorName: last.supervisor_name } : null };
  } catch {
    return { saved: null, suggestion: null };
  }
}
