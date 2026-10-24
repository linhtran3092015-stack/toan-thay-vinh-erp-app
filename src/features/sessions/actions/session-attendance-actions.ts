"use server";

import { revalidatePath } from "next/cache";

import type {
  AttendanceActionFieldErrors,
  AttendanceActionState,
  AttendanceErrorCode,
  AttendanceRpcErrorCode,
  MarkSessionAttendanceActionInput,
  UpdateSessionAttendanceActionInput,
} from "@/features/sessions/forms/attendance-action-types";
import {
  markSessionAttendanceSchema,
  refreshSessionAttendanceSchema,
  updateSessionAttendanceSchema,
} from "@/features/sessions/forms/attendance-form-schema";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { permissionDeniedMessage } from "@/lib/permissions/labels";
interface AttendanceError {
  code?: AttendanceErrorCode;
  message: string;
}

function createErrorState(
  message: string,
  fieldErrors?: AttendanceActionFieldErrors,
  code?: AttendanceErrorCode,
): AttendanceActionState {
  return {
    ...(code ? { code } : {}),
    fieldErrors,
    message,
    status: "error",
  };
}

async function getAttendancePermissionError():
  Promise<AttendanceError | null> {
  const permissionResult =
    await getDatabasePermissions();

  if (!permissionResult.ok) {
    return {
      code: "ATTENDANCE_PERMISSION_CHECK_FAILED",
      message:
        "Không thể xác minh quyền điểm danh. Vui lòng đăng nhập lại hoặc thử lại.",
    };
  }

  if (
    !permissionResult.permissions.includes(
      "attendance.mark",
    )
  ) {
    return {
      code: "ATTENDANCE_MARK_PERMISSION_DENIED",
      message: permissionDeniedMessage("attendance.mark"),
    };
  }

  return null;
}

function revalidateAttendanceRoutes(
  classSessionId?: string,
): void {
  revalidatePath("/sessions");

  if (classSessionId) {
    revalidatePath(
      `/sessions/${classSessionId}`,
    );
    return;
  }

  revalidatePath(
    "/sessions/[sessionId]",
    "page",
  );
}

function getAttendanceRpcError(
  message: string,
): AttendanceError {
  // Keyed by ATTENDANCE_RPC_ERROR_CODES: a missing, extra or misspelled code fails typecheck.
  const knownMessages: Record<AttendanceRpcErrorCode, string> = {
    ATTENDANCE_LEARNING_MODE_INVALID:
      "Hình thức học thực tế không hợp lệ.",

    ATTENDANCE_MARK_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền nhập hoặc sửa điểm danh.",

    ATTENDANCE_REQUIRES_STARTED_SESSION:
      "Chỉ có thể điểm danh sau khi buổi học đã bắt đầu.",

    ATTENDANCE_STATUS_INVALID:
      "Trạng thái điểm danh không hợp lệ.",

    ATTENDANCE_UPDATE_REASON_REQUIRED:
      "Bắt buộc nhập lý do cập nhật điểm danh.",

    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE:
      "Buổi học đã hủy nên không thể nhập điểm danh.",

    CLASS_SESSION_ID_REQUIRED:
      "Thiếu mã buổi học cần điểm danh.",

    CLASS_SESSION_IS_LOCKED:
      "Buổi học đã khóa nên không thể thay đổi điểm danh.",

    CLASS_SESSION_NOT_FOUND:
      "Không tìm thấy buổi học cần điểm danh.",

    MAIN_ATTENDANCE_REQUIRES_EFFECTIVE_ENROLLMENT:
      "Học viên không có đăng ký lớp còn hiệu lực tại ngày diễn ra buổi học.",

    MAIN_ATTENDANCE_REQUIRES_EXISTING_ENROLLMENT:
      "Học viên không có hồ sơ đăng ký vào lớp của buổi học.",

    SESSION_ATTENDANCE_ALREADY_EXISTS:
      "Học viên đã có bản ghi điểm danh trong buổi học này.",

    SESSION_ATTENDANCE_ID_REQUIRED:
      "Thiếu mã bản ghi điểm danh cần cập nhật.",

    SESSION_ATTENDANCE_NOT_FOUND:
      "Không tìm thấy bản ghi điểm danh cần cập nhật.",

    SESSION_ATTENDANCE_NO_CHANGES:
      "Thông tin điểm danh mới không có thay đổi.",

    STUDENT_ID_REQUIRED:
      "Thiếu mã học viên cần điểm danh.",

    STUDENT_NOT_FOUND:
      "Không tìm thấy học viên cần điểm danh.",

    TRIAL_OR_UNCONFIRMED_STUDENT_CANNOT_BE_MARKED:
      "Học viên học thử hoặc chưa được xác nhận chính thức không thể điểm danh.",
  };

  for (
    const [databaseMessage, userMessage]
    of Object.entries(knownMessages) as [AttendanceRpcErrorCode, string][]
  ) {
    if (message.includes(databaseMessage)) {
      return {
        code: databaseMessage,
        message: userMessage,
      };
    }
  }

  return {
    message:
      "Không thể cập nhật điểm danh. Dữ liệu chưa được thay đổi.",
  };
}

export async function markSessionAttendanceAction(
  input: MarkSessionAttendanceActionInput,
): Promise<AttendanceActionState> {
  const permissionError =
    await getAttendancePermissionError();

  if (permissionError) {
    return createErrorState(
      permissionError.message,
      undefined,
      permissionError.code,
    );
  }

  const parsed =
    markSessionAttendanceSchema.safeParse(
      input,
    );

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin điểm danh.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase.rpc(
        "mark_session_attendance",
        {
          p_actual_learning_mode:
            parsed.data.actualLearningMode,
          p_attendance_status:
            parsed.data.attendanceStatus,
          p_class_session_id:
            parsed.data.classSessionId,
          p_notes: parsed.data.notes,
          p_student_id:
            parsed.data.studentId,
        },
      );

    if (error) {
      const rpcError =
        getAttendanceRpcError(error.message);

      return createErrorState(
        rpcError.message,
        undefined,
        rpcError.code,
      );
    }

    if (
      !data?.id ||
      !data.class_session_id
    ) {
      return createErrorState(
        "Database không trả về bản ghi điểm danh vừa tạo.",
      );
    }

    // Revalidating re-renders the whole session page into this response, which a bulk mark would
    // pay once per student; it calls refreshSessionAttendanceAction once at its end instead.
    if (parsed.data.deferRefresh !== true) {
      revalidateAttendanceRoutes(
        data.class_session_id,
      );
    }

    return {
      attendanceId: data.id,
      classSessionId:
        data.class_session_id,
      message: "Đã ghi nhận điểm danh.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống điểm danh. Vui lòng thử lại.",
    );
  }
}

export async function updateSessionAttendanceAction(
  input: UpdateSessionAttendanceActionInput,
): Promise<AttendanceActionState> {
  const permissionError =
    await getAttendancePermissionError();

  if (permissionError) {
    return createErrorState(
      permissionError.message,
      undefined,
      permissionError.code,
    );
  }

  const parsed =
    updateSessionAttendanceSchema.safeParse(
      input,
    );

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin cập nhật điểm danh.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase.rpc(
        "update_session_attendance",
        {
          p_actual_learning_mode:
            parsed.data.actualLearningMode,
          p_attendance_status:
            parsed.data.attendanceStatus,
          p_notes:
            parsed.data.notes ?? "",
          p_reason: parsed.data.reason,
          p_session_attendance_id:
            parsed.data.attendanceId,
        },
      );

    if (error) {
      const rpcError =
        getAttendanceRpcError(error.message);

      return createErrorState(
        rpcError.message,
        undefined,
        rpcError.code,
      );
    }

    if (
      !data?.id ||
      !data.class_session_id
    ) {
      return createErrorState(
        "Database không trả về kết quả cập nhật điểm danh.",
      );
    }

    revalidateAttendanceRoutes(
      data.class_session_id,
    );

    return {
      attendanceId: data.id,
      classSessionId:
        data.class_session_id,
      message:
        "Đã cập nhật thông tin điểm danh.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống điểm danh. Vui lòng thử lại.",
    );
  }
}

/**
 * Re-renders the session page and the sessions list once, after a bulk mark saved its rows with
 * deferRefresh (at its end, or when it stops early). Answers
 * `ok: false` without revalidating when the session id is invalid or attendance.mark is gone;
 * the caller then falls back to a plain page refresh.
 */
export async function refreshSessionAttendanceAction(
  classSessionId: string,
): Promise<{ ok: boolean }> {
  const parsed =
    refreshSessionAttendanceSchema.safeParse(
      classSessionId,
    );

  if (!parsed.success) {
    return { ok: false };
  }

  if (await getAttendancePermissionError()) {
    return { ok: false };
  }

  revalidateAttendanceRoutes(parsed.data);

  return { ok: true };
}
