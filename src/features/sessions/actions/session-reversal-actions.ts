"use server";

import { revalidatePath } from "next/cache";

import type {
  ReversalActionFieldErrors,
  ReverseSessionChargeActionInput,
  ReverseSessionChargeActionState,
} from "@/features/sessions/forms/reversal-action-types";
import { reverseSessionChargeSchema } from "@/features/sessions/forms/reversal-form-schema";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createReversalErrorState(
  message: string,
  fieldErrors?: ReversalActionFieldErrors,
): ReverseSessionChargeActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function getReversalPermissionError(): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền thao tác. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes("session_ledger.reverse")) {
    return "Tài khoản hiện tại không có quyền hoàn buổi học (session_ledger.reverse).";
  }

  return null;
}

function getReversalRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    SESSION_ATTENDANCE_ID_REQUIRED:
      "Thiếu mã lượt điểm danh cần hoàn buổi.",

    SESSION_CHARGE_ALREADY_REVERSED:
      "Lượt điểm danh này đã được hoàn buổi trước đó.",

    SESSION_CHARGE_NOT_FOUND:
      "Không tìm thấy lượt trừ buổi hợp lệ để hoàn lại.",

    SESSION_LEDGER_REVERSE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền hoàn buổi học.",

    SESSION_REVERSAL_REASON_REQUIRED:
      "Bắt buộc nhập lý do hoàn buổi.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể xử lý hoàn buổi học. Dữ liệu chưa được thay đổi.";
}

export async function reverseSessionChargeAction(
  input: ReverseSessionChargeActionInput,
): Promise<ReverseSessionChargeActionState> {
  const permissionError = await getReversalPermissionError();

  if (permissionError) {
    return createReversalErrorState(permissionError);
  }

  const parsed = reverseSessionChargeSchema.safeParse(input);

  if (!parsed.success) {
    return createReversalErrorState(
      "Vui lòng kiểm tra lại thông tin hoàn buổi học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("reverse_session_charge", {
      p_reason: parsed.data.reason,
      p_session_attendance_id: parsed.data.sessionAttendanceId,
    });

    if (error) {
      return createReversalErrorState(getReversalRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createReversalErrorState(
        "Database không trả về thông tin hoàn buổi sau khi xử lý.",
      );
    }

    if (data.class_session_id) {
      revalidatePath("/sessions");
      revalidatePath(`/sessions/${data.class_session_id}`);
    }

    if (data.student_id) {
      revalidatePath(`/students/${data.student_id}`);
    }

    return {
      entryType: data.entry_type,
      id: data.id,
      message: "Đã hoàn lại 1 buổi học thành công.",
      sessionAttendanceId: parsed.data.sessionAttendanceId,
      status: "success",
    };
  } catch {
    return createReversalErrorState(
      "Không thể kết nối tới hệ thống hoàn buổi. Vui lòng thử lại.",
    );
  }
}
