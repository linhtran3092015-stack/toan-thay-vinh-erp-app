"use server";

import { revalidatePath } from "next/cache";

import type {
  TimekeepingAdjustmentActionState,
  TimekeepingAdjustmentDecisionInput,
  TimekeepingAdjustmentRequestInput,
} from "@/features/timekeeping/timekeeping-adjustment-action-types";
import {
  timekeepingAdjustmentDecisionSchema,
  timekeepingAdjustmentRequestSchema,
} from "@/features/timekeeping/timekeeping-adjustment-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { permissionDeniedMessage } from "@/lib/permissions/labels";
function createErrorState(
  message: string,
  fieldErrors?: TimekeepingAdjustmentActionState["fieldErrors"],
): TimekeepingAdjustmentActionState {
  return { fieldErrors, message, status: "error" };
}

async function getPermissionError(permission: PermissionCode): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền điều chỉnh công. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes(permission)) {
    return `Tài khoản hiện tại không có quyền ${permission}.`;
  }

  return null;
}

function getRequestRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    STAFF_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ nhân sự của bạn.",
    TIMEKEEPING_CHECK_PERMISSION_REQUIRED:
      permissionDeniedMessage("timekeeping.check"),
    TIME_ENTRY_ADJUSTMENT_ALREADY_APPROVED:
      "Lượt chấm công này đã có điều chỉnh được duyệt.",
    TIME_ENTRY_ADJUSTMENT_NO_CHANGE: "Thời điểm đề xuất không khác dữ liệu gốc.",
    TIME_ENTRY_ADJUSTMENT_PENDING_ALREADY_EXISTS:
      "Lượt chấm công này đang có yêu cầu điều chỉnh chờ duyệt.",
    TIME_ENTRY_ADJUSTMENT_TIME_INVALID:
      "Thời điểm điều chỉnh không nằm trong ngày công hợp lệ.",
    TIME_ENTRY_NOT_CLOSED: "Chỉ có thể điều chỉnh lượt chấm công đã kết thúc.",
    TIME_ENTRY_NOT_FOUND: "Không tìm thấy lượt chấm công của bạn.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể gửi yêu cầu điều chỉnh. Dữ liệu chưa được cập nhật.";
}

function getDecisionRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    TIME_ENTRY_ADJUSTMENT_ALREADY_DECIDED:
      "Yêu cầu này đã được xử lý trước đó.",
    TIME_ENTRY_ADJUSTMENT_NOT_FOUND: "Không tìm thấy yêu cầu điều chỉnh.",
    TIME_ENTRY_ADJUSTMENT_SELF_REVIEW_FORBIDDEN:
      "Bạn không thể tự duyệt yêu cầu điều chỉnh của mình.",
    TIMEKEEPING_ADJUSTMENT_APPROVAL_PERMISSION_REQUIRED:
      permissionDeniedMessage("timekeeping.approve_adjustment"),
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể xử lý yêu cầu điều chỉnh. Dữ liệu chưa được cập nhật.";
}

export async function requestTimeEntryAdjustmentAction(
  input: TimekeepingAdjustmentRequestInput,
): Promise<TimekeepingAdjustmentActionState> {
  const permissionError = await getPermissionError("timekeeping.check");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = timekeepingAdjustmentRequestSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin điều chỉnh.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("request_time_entry_adjustment", {
      p_request_reason: parsed.data.requestReason,
      p_requested_check_in_at: parsed.data.requestedCheckInAt,
      p_requested_check_in_mode: parsed.data.requestedCheckInMode,
      p_requested_check_out_at: parsed.data.requestedCheckOutAt,
      p_requested_check_out_mode: parsed.data.requestedCheckOutMode,
      p_time_entry_id: parsed.data.timeEntryId,
    });

    if (error) {
      return createErrorState(getRequestRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về yêu cầu vừa tạo.");
    }

    revalidatePath("/timekeeping");
    return { message: "Đã gửi yêu cầu điều chỉnh để chờ duyệt.", status: "success" };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống chấm công. Vui lòng thử lại.",
    );
  }
}

export async function decideTimeEntryAdjustmentAction(
  input: TimekeepingAdjustmentDecisionInput,
): Promise<TimekeepingAdjustmentActionState> {
  const permissionError = await getPermissionError("timekeeping.approve_adjustment");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = timekeepingAdjustmentDecisionSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại quyết định xử lý.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("decide_time_entry_adjustment", {
      p_decision: parsed.data.decision,
      p_decision_reason: parsed.data.decisionReason || null,
      p_time_entry_adjustment_request_id: parsed.data.requestId,
    } as never);

    if (error) {
      return createErrorState(getDecisionRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về quyết định vừa xử lý.");
    }

    revalidatePath("/timekeeping");
    return {
      message:
        parsed.data.decision === "approved"
          ? "Đã duyệt yêu cầu điều chỉnh công."
          : "Đã từ chối yêu cầu điều chỉnh công.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống chấm công. Vui lòng thử lại.",
    );
  }
}
