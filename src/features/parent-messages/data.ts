import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ParentMessageStatus = "queued" | "sent" | "failed" | "skipped" | "expired";

export interface ParentMessageQueueItem {
  attempts: number;
  classCode: string | null;
  classSessionId: string | null;
  content: string;
  createdAt: string;
  errorMessage: string | null;
  eventCode: "attendance.unexcused_absence" | "session.comment";
  id: string;
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
  created_at: z.string(),
  error_message: z.string().nullable(),
  event_code: z.enum(["attendance.unexcused_absence", "session.comment"]),
  message_id: z.string().uuid(),
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
        createdAt: row.created_at,
        errorMessage: row.error_message,
        eventCode: row.event_code,
        id: row.message_id,
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
