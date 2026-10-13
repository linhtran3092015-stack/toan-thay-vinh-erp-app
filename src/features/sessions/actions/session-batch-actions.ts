"use server";

import { revalidatePath } from "next/cache";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type CreateBatchSessionsPayload,
  createBatchSessionsPayloadSchema,
} from "../forms/session-batch-schema";
import type { ExistingSessionSnapshot } from "../batch-data";

import { permissionDeniedMessage } from "@/lib/permissions/labels";
const batchRpcErrorMessages: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  SESSIONS_MANAGE_PERMISSION_DENIED: "Tài khoản hiện tại không có quyền tạo buổi học.",
  CLASS_NOT_FOUND: "Không tìm thấy lớp học.",
  CLASS_NOT_ACTIVE: "Lớp học chưa ở trạng thái đang hoạt động nên không thể tạo buổi.",
  CLASS_SESSION_REQUIRES_ACTIVE_CLASS: "Lớp học chưa ở trạng thái đang hoạt động nên không thể tạo buổi.",
  CLASS_SESSION_REQUIRES_ACTIVE_ACADEMIC_YEAR: "Năm học của lớp chưa kích hoạt nên không thể tạo buổi.",
  SCHEDULE_TEMPLATE_CLASS_MISMATCH: "Khung lịch không thuộc lớp này.",
  CLASS_SESSION_SCHEDULE_CLASS_MISMATCH: "Khung lịch không thuộc lớp này.",
  CLASS_SESSION_SCHEDULE_NOT_EFFECTIVE: "Có buổi nằm ngoài thời gian hiệu lực của khung lịch.",
  CLASS_SESSION_WEEKDAY_MISMATCH: "Có buổi không đúng thứ trong tuần của khung lịch.",
  COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION: "Lớp ghép không tạo buổi trực tiếp; hãy tạo ở lớp thành phần.",
  COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE: "Lớp ghép không có lịch cố định riêng; lịch học nằm ở các lớp thành phần.",
  INVALID_SESSION_TIME: "Giờ bắt đầu phải trước giờ kết thúc.",
  INVALID_COMPONENT_CODE: "Mã thành phần không hợp lệ.",
};

function getBatchRpcErrorMessage(rawMessage: string | null): string {
  if (!rawMessage) return "Không thể lưu buổi học vào cơ sở dữ liệu.";
  const code = Object.keys(batchRpcErrorMessages).find((key) => rawMessage.includes(key));
  if (code) return batchRpcErrorMessages[code];
  if (rawMessage.includes("duplicate key")) {
    return "Có buổi học trùng với buổi đã tồn tại. Vui lòng kiểm tra lại danh sách.";
  }
  return "Không thể lưu buổi học vào cơ sở dữ liệu. Vui lòng thử lại hoặc liên hệ quản trị viên.";
}

export interface BatchSessionActionResult {
  status: "success" | "error";
  message: string;
  createdCount?: number;
  sessionIds?: string[];
  fieldErrors?: Record<string, string[]>;
}

export async function checkBatchSessionConflictsAction(
  classId: string,
  dates: string[],
): Promise<{ ok: true; existing: ExistingSessionSnapshot[] } | { ok: false; error: string }> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("sessions.manage")) {
    return { ok: false, error: "Tài khoản không có quyền sessions.manage." };
  }

  if (!classId || dates.length === 0) {
    return { ok: true, existing: [] };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("class_sessions")
      .select("session_date, start_time, end_time, schedule_template_id")
      .eq("class_id", classId)
      .neq("status", "cancelled")
      .in("session_date", dates);

    if (error) {
      return { ok: false, error: "Không thể kiểm tra trùng lịch: " + error.message };
    }

    const existing: ExistingSessionSnapshot[] = (data ?? []).map((row) => ({
      sessionDate: row.session_date,
      startTime: row.start_time,
      endTime: row.end_time,
      scheduleTemplateId: row.schedule_template_id,
    }));

    return { ok: true, existing };
  } catch {
    return { ok: false, error: "Lỗi kết nối khi kiểm tra trùng lịch." };
  }
}

export async function createBatchSessionsAction(
  payload: CreateBatchSessionsPayload,
): Promise<BatchSessionActionResult> {
  // 1. Permission check
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok) {
    return {
      status: "error",
      message: "Không thể xác minh quyền quản lý buổi học.",
    };
  }

  if (!permissionResult.permissions.includes("sessions.manage")) {
    return {
      status: "error",
      message: permissionDeniedMessage("sessions.manage"),
    };
  }

  // 2. Validate payload schema
  const parsed = createBatchSessionsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstErrorMessage =
      Object.values(fieldErrors).flat()[0] ?? "Dữ liệu tạo buổi học hàng loạt không hợp lệ.";
    return {
      status: "error",
      message: firstErrorMessage,
      fieldErrors,
    };
  }

  const { classId, sessions, reason } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    // 3. Authenticate current user
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return {
        status: "error",
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      };
    }

    // 4. Verify class and academic year status
    const { data: classRow, error: classErr } = await supabase
      .from("classes")
      .select(`
        id,
        code,
        name,
        status,
        academic_year_id,
        academic_years (
          id,
          status
        )
      `)
      .eq("id", classId)
      .single();

    if (classErr || !classRow) {
      return {
        status: "error",
        message: "Không tìm thấy lớp học cần tạo buổi.",
      };
    }

    if (classRow.status !== "active") {
      return {
        status: "error",
        message: `Lớp ${classRow.code} hiện không ở trạng thái hoạt động (active).`,
      };
    }

    // Supabase returns foreign key relation either as single object or array
    const academicYear = Array.isArray(classRow.academic_years)
      ? classRow.academic_years[0]
      : classRow.academic_years;

    if (!academicYear || academicYear.status !== "active") {
      return {
        status: "error",
        message: "Năm học của lớp chưa ở trạng thái hoạt động.",
      };
    }

    // 5. Query existing sessions for this class to filter out duplicates
    const requestedDates = sessions.map((s) => s.sessionDate);
    const { data: existingSessionsData } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time, schedule_template_id")
      .eq("class_id", classId)
      .neq("status", "cancelled")
      .in("session_date", requestedDates);

    const existingRows = existingSessionsData ?? [];

    const nonDuplicateSessions = sessions.filter((s) => {
      const isDuplicate = existingRows.some((ex) => {
        if (ex.session_date !== s.sessionDate) return false;
        if (s.scheduleTemplateId && ex.schedule_template_id === s.scheduleTemplateId) {
          return true;
        }
        return ex.start_time.slice(0, 5) === s.startTime.slice(0, 5);
      });
      return !isDuplicate;
    });

    if (nonDuplicateSessions.length === 0) {
      return {
        status: "error",
        message: "Tất cả các buổi học được chọn đã tồn tại trên hệ thống.",
      };
    }

    // 6. Build batch payload for RPC
    const recordsToInsert = nonDuplicateSessions.map((s) => ({
      session_date: s.sessionDate,
      start_time: s.startTime.length === 5 ? `${s.startTime}:00` : s.startTime,
      end_time: s.endTime.length === 5 ? `${s.endTime}:00` : s.endTime,
      learning_mode: s.learningMode,
      session_kind: s.sessionKind,
      schedule_template_id: s.scheduleTemplateId ?? null,
      component_code: s.componentCode ?? null,
      room_name: s.roomName ?? null,
      meeting_url: s.meetingUrl ?? null,
      notes: s.notes ?? null,
    }));

    let createdCount = 0;
    let createdSessionIds: string[] = [];

    // 7. Try invoking the security-definer RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)(
      "create_batch_class_sessions",
      {
        p_class_id: classId,
        p_sessions: recordsToInsert,
        p_reason: reason || "Tạo buổi học hàng loạt",
      },
    );

    if (!rpcErr && rpcData) {
      createdCount = (rpcData as { created_count?: number })?.created_count ?? 0;
      createdSessionIds = (rpcData as { session_ids?: string[] })?.session_ids ?? [];
    } else {
      // The RPC is the only write path: its permission, class-status and
      // template checks must not be bypassed when it rejects the batch.
      return {
        status: "error",
        message: getBatchRpcErrorMessage(rpcErr?.message ?? null),
      };
    }

    if (createdCount === 0 && nonDuplicateSessions.length > 0) {
      return {
        status: "error",
        message: "Không có buổi học nào được tạo thành công.",
      };
    }

    // 8. Revalidate paths
    revalidatePath("/sessions");
    revalidatePath(`/classes/${classId}`);

    const skippedMsg =
      sessions.length > createdCount
        ? ` (đã tự động bỏ qua ${sessions.length - createdCount} buổi bị trùng)`
        : "";

    return {
      status: "success",
      message: `Đã tạo thành công ${createdCount} buổi học cho lớp ${classRow.code}${skippedMsg}.`,
      createdCount,
      sessionIds: createdSessionIds,
    };
  } catch {
    return {
      status: "error",
      message: "Không thể kết nối tới cơ sở dữ liệu để tạo buổi học.",
    };
  }
}
