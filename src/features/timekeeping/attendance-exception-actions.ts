"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { attendanceExceptionDecisionSchema, attendanceExceptionRequestSchema, attendanceExceptionReviewSchema } from "@/features/timekeeping/attendance-exception-schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { TimekeepingEntryActionState } from "@/features/timekeeping/time-entry-action-types";

async function callRpc(name: string, args: Record<string, unknown> = {}) {
  const supabase = await createSupabaseServerClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string, args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  return rpc(name, args);
}

function errorMessage(message: string) {
  if (message.includes("SELF_REVIEW_FORBIDDEN")) return "Bạn không thể tự duyệt công của mình.";
  if (message.includes("ALREADY_DECIDED")) return "Yêu cầu đã được xử lý. Vui lòng tải lại trang.";
  if (message.includes("NOT_CLOSED")) return "Chờ nhân sự kết thúc ca trước khi duyệt.";
  if (message.includes("OPEN_ENTRY_ALREADY_EXISTS")) return "Bạn đang có ca mở. Vui lòng tải lại trang để check-out.";
  if (message.includes("OPEN_ENTRY_NOT_FOUND") || message.includes("USE_ADJUSTMENT")) return "Ca đã kết thúc hoặc qua ngày. Vui lòng tải lại trang và gửi yêu cầu điều chỉnh công.";
  if (message.includes("CUTOFF_REACHED")) return "Không thể mở ca mới sau giờ tự đóng ca (22:30 trợ giảng, 22:45 vị trí khác).";
  return "Chưa ghi nhận được yêu cầu. Vui lòng thử lại hoặc liên hệ quản lý.";
}

export async function requestAttendanceExceptionAction(input: unknown): Promise<TimekeepingEntryActionState> {
  const parsed = attendanceExceptionRequestSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  try {
    const permissions = await getDatabasePermissions();
    if (!permissions.ok || !permissions.permissions.includes("timekeeping.check")) {
      return { status: "error", message: "Không xác minh được quyền chấm công. Vui lòng đăng nhập lại." };
    }
    const { data, error } = await callRpc("request_attendance_exception", {
      p_operation: parsed.data.operation, p_reason: parsed.data.reason,
      p_request_id: parsed.data.requestId, p_time_entry_id: parsed.data.timeEntryId,
    });
    if (error || typeof data !== "string") return { status: "error", message: errorMessage(error?.message ?? "") };
    revalidatePath("/timekeeping");
    return { status: "success", message: "Đã ghi nhận chấm công chờ duyệt. Giờ công này chưa được tính vào tổng đã xác minh." };
  } catch {
    return { status: "error", message: "Chưa nhận được xác nhận từ hệ thống. Giữ nguyên yêu cầu và thử gửi lại khi có mạng." };
  }
}

export async function decideAttendanceExceptionAction(input: unknown): Promise<TimekeepingEntryActionState> {
  const parsed = attendanceExceptionDecisionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  try {
    const permissions = await getDatabasePermissions();
    if (!permissions.ok || !permissions.permissions.includes("timekeeping.approve_adjustment")) {
      return { status: "error", message: "Bạn không có quyền duyệt công." };
    }
    const { error } = await callRpc("decide_attendance_exception", {
      p_entry_id: parsed.data.timeEntryId, p_decision: parsed.data.decision, p_reason: parsed.data.reason,
    });
    if (error) return { status: "error", message: errorMessage(error.message) };
    revalidatePath("/timekeeping");
    revalidatePath("/payroll");
    return { status: "success", message: "Đã lưu quyết định duyệt công." };
  } catch {
    return { status: "error", message: "Chưa xác nhận được quyết định. Vui lòng tải lại trước khi thử lại." };
  }
}

export async function getAttendanceExceptionReviewsAction() {
  try {
    const { data, error } = await callRpc("get_attendance_exception_reviews");
    const parsed = z.array(attendanceExceptionReviewSchema).safeParse(data);
    if (error || !parsed.success) return { ok: false as const, message: "Chưa tải được chấm công chờ duyệt. Vui lòng thử lại." };
    return { ok: true as const, reviews: parsed.data };
  } catch {
    return { ok: false as const, message: "Mất kết nối khi tải chấm công chờ duyệt." };
  }
}
