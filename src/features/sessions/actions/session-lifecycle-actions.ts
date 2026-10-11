"use server";

import { revalidatePath } from "next/cache";

import type {
  CancelSessionActionInput,
  CreateSessionActionInput,
  RescheduleSessionActionInput,
  SessionIdActionInput,
  SessionLifecycleActionState,
  SessionLifecycleFieldErrors,
} from "@/features/sessions/forms/session-action-types";
import {
  cancelSessionSchema,
  createSessionSchema,
  rescheduleSessionSchema,
  sessionIdSchema,
} from "@/features/sessions/forms/session-lifecycle-form-schema";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createErrorState(
  message: string,
  fieldErrors?: SessionLifecycleFieldErrors,
): SessionLifecycleActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function getLifecyclePermissionError():
  Promise<string | null> {
  const permissionResult =
    await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền quản lý buổi học. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (
    !permissionResult.permissions.includes(
      "sessions.manage",
    )
  ) {
    return "Tài khoản hiện tại không có quyền sessions.manage.";
  }

  return null;
}

function revalidateSessionRoutes(
  sessionId?: string,
): void {
  revalidatePath("/sessions");

  if (sessionId) {
    revalidatePath(
      `/sessions/${sessionId}`,
    );
    return;
  }

  revalidatePath(
    "/sessions/[sessionId]",
    "page",
  );
}

function getLifecycleRpcErrorMessage(
  message: string,
): string {
  const knownMessages: Record<string, string> = {
    ACADEMIC_YEAR_NOT_FOUND:
      "Không tìm thấy năm học của lớp.",

    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    CLASS_SESSION_ALREADY_EXISTS:
      "Lớp đã có buổi học trùng ngày, giờ hoặc lịch cố định.",

    CLASS_SESSION_CANCELLATION_REASON_REQUIRED:
      "Bắt buộc nhập lý do hủy buổi học.",

    CLASS_SESSION_CANCEL_TRANSITION_INVALID:
      "Trạng thái hiện tại không cho phép hủy buổi học.",

    CLASS_SESSION_CANNOT_START_LOCKED:
      "Buổi học đã khóa nên không thể bắt đầu.",

    CLASS_SESSION_COMPLETE_TRANSITION_INVALID:
      "Chỉ buổi đang diễn ra mới có thể hoàn thành.",

    CLASS_SESSION_DATE_OUTSIDE_ACADEMIC_YEAR:
      "Ngày học nằm ngoài thời gian của năm học.",

    CLASS_SESSION_DATE_REQUIRED:
      "Bắt buộc nhập ngày học.",

    CLASS_SESSION_ID_REQUIRED:
      "Thiếu mã buổi học cần thao tác.",

    CLASS_SESSION_KIND_INVALID:
      "Loại buổi học không hợp lệ.",

    CLASS_SESSION_LEARNING_MODE_INVALID:
      "Hình thức học không hợp lệ.",

    CLASS_SESSION_MANAGE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền quản lý buổi học.",

    CLASS_SESSION_NOT_FOUND:
      "Không tìm thấy buổi học cần thao tác.",

    CLASS_SESSION_REQUIRES_ACTIVE_ACADEMIC_YEAR:
      "Chỉ có thể tạo hoặc bắt đầu buổi khi năm học đang hoạt động.",

    CLASS_SESSION_REQUIRES_ACTIVE_CLASS:
      "Chỉ có thể tạo hoặc bắt đầu buổi của lớp đang hoạt động.",

    CLASS_SESSION_START_TRANSITION_INVALID:
      "Chỉ buổi đã lên lịch mới có thể bắt đầu.",

    CLASS_SESSION_TIME_INVALID:
      "Giờ bắt đầu hoặc giờ kết thúc không hợp lệ.",

    LOCKED_CLASS_SESSION_IS_IMMUTABLE:
      "Buổi học đã khóa nên không thể thay đổi.",

    MAKEUP_SESSION_DATE_MUST_BE_LATER_THAN_SOURCE:
      "Ngày học bù phải sau ngày của buổi đã hủy.",

    MAKEUP_SESSION_REQUIRES_SOURCE:
      "Buổi bù phải liên kết với một buổi đã hủy.",

    MAKEUP_SOURCE_SESSION_CLASS_MISMATCH:
      "Buổi học bù và buổi nguồn phải thuộc cùng một lớp.",

    MAKEUP_SOURCE_SESSION_CANNOT_BE_ADDITIONAL:
      "Buổi bổ sung không thể dùng làm nguồn cho buổi bù.",

    MAKEUP_SOURCE_SESSION_MUST_BE_CANCELLED:
      "Chỉ buổi đã hủy mới có thể dùng làm nguồn cho buổi bù.",

    MAKEUP_SOURCE_SESSION_NOT_FOUND:
      "Không tìm thấy buổi đã hủy cần học bù.",

    REGULAR_SESSION_DATE_MUST_MATCH_SCHEDULE_WEEKDAY:
      "Ngày học không đúng thứ trong lịch học cố định.",

    REGULAR_SESSION_REQUIRES_SCHEDULE_TEMPLATE:
      "Buổi chính phải liên kết với lịch học cố định.",

    SCHEDULE_TEMPLATE_CLASS_MISMATCH:
      "Lịch học cố định không thuộc lớp đã chọn.",

    SCHEDULE_TEMPLATE_NOT_ACTIVE_ON_SESSION_DATE:
      "Lịch học cố định không có hiệu lực vào ngày đã chọn.",

    SCHEDULE_TEMPLATE_NOT_FOUND:
      "Không tìm thấy lịch học cố định đã chọn.",

    CLASS_SESSION_DATE_CONFLICT:
      "Lịch mẫu của lớp đã có buổi học vào ngày này. Chọn ngày khác hoặc hủy buổi trùng trước.",
    CLASS_SESSION_RESCHEDULE_REASON_REQUIRED:
      "Bắt buộc nhập lý do đổi lịch (3–1000 ký tự).",
    CLASS_SESSION_RESCHEDULE_STATUS_INVALID:
      "Chỉ buổi học còn ở trạng thái đã lên lịch mới đổi lịch được. Buổi đã bắt đầu thì hủy rồi tạo buổi bù.",
    CLASS_SESSION_SCHEDULE_NOT_EFFECTIVE:
      "Ngày mới nằm ngoài khoảng hiệu lực của lịch mẫu.",
    CLASS_SESSION_SCHEDULE_REQUIRED:
      "Bắt buộc nhập ngày, giờ bắt đầu và giờ kết thúc.",
    CLASS_SESSION_TIME_CONFLICT:
      "Lớp đã có buổi học khác chồng giờ trong ngày này.",
    CLASS_SESSION_TIME_RANGE_INVALID:
      "Giờ kết thúc phải sau giờ bắt đầu.",
    MAKEUP_SESSION_DATE_INVALID:
      "Buổi bù phải diễn ra sau buổi gốc đã hủy.",
    SESSION_MANAGE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền quản lý buổi học.",
  };

  for (
    const [databaseMessage, userMessage]
    of Object.entries(knownMessages)
  ) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật buổi học. Dữ liệu chưa được thay đổi.";
}

export async function createSessionAction(
  input: CreateSessionActionInput,
): Promise<SessionLifecycleActionState> {
  const permissionError =
    await getLifecyclePermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    createSessionSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin buổi học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase.rpc(
        "create_class_session",
        {
          p_class_id: parsed.data.classId,
          p_component_code:
            parsed.data.componentCode,
          p_end_time:
            parsed.data.endTime,
          p_learning_mode:
            parsed.data.learningMode,
          p_makeup_for_session_id:
            parsed.data.makeupForSessionId,
          p_meeting_url:
            parsed.data.meetingUrl,
          p_notes: parsed.data.notes,
          p_room_name:
            parsed.data.roomName,
          p_schedule_template_id:
            parsed.data.scheduleTemplateId,
          p_session_date:
            parsed.data.sessionDate,
          p_session_kind:
            parsed.data.sessionKind,
          p_start_time:
            parsed.data.startTime,
        },
      );

    if (error) {
      return createErrorState(
        getLifecycleRpcErrorMessage(
          error.message,
        ),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về buổi học vừa tạo.",
      );
    }

    revalidateSessionRoutes(data.id);

    return {
      message: "Đã tạo buổi học.",
      redirectTo: `/sessions/${data.id}`,
      sessionId: data.id,
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống buổi học. Vui lòng thử lại.",
    );
  }
}

export async function startSessionAction(
  input: SessionIdActionInput,
): Promise<SessionLifecycleActionState> {
  const permissionError =
    await getLifecyclePermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    sessionIdSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Mã buổi học không hợp lệ.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase.rpc(
        "start_class_session",
        {
          p_class_session_id:
            parsed.data.sessionId,
        },
      );

    if (error) {
      return createErrorState(
        getLifecycleRpcErrorMessage(
          error.message,
        ),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về kết quả bắt đầu buổi học.",
      );
    }

    revalidateSessionRoutes(data.id);

    return {
      message: "Đã bắt đầu buổi học.",
      sessionId: data.id,
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống buổi học. Vui lòng thử lại.",
    );
  }
}

export async function completeSessionAction(
  input: SessionIdActionInput,
): Promise<SessionLifecycleActionState> {
  const permissionError =
    await getLifecyclePermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    sessionIdSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Mã buổi học không hợp lệ.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase.rpc(
        "complete_class_session",
        {
          p_class_session_id:
            parsed.data.sessionId,
        },
      );

    if (error) {
      return createErrorState(
        getLifecycleRpcErrorMessage(
          error.message,
        ),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về kết quả hoàn thành buổi học.",
      );
    }

    revalidateSessionRoutes(data.id);

    return {
      message: "Đã hoàn thành buổi học.",
      sessionId: data.id,
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống buổi học. Vui lòng thử lại.",
    );
  }
}

export async function cancelSessionAction(
  input: CancelSessionActionInput,
): Promise<SessionLifecycleActionState> {
  const permissionError =
    await getLifecyclePermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    cancelSessionSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại lý do hủy buổi học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase.rpc(
        "cancel_class_session",
        {
          p_class_session_id:
            parsed.data.sessionId,
          p_reason: parsed.data.reason,
        },
      );

    if (error) {
      return createErrorState(
        getLifecycleRpcErrorMessage(
          error.message,
        ),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về kết quả hủy buổi học.",
      );
    }

    revalidateSessionRoutes(data.id);

    return {
      message: "Đã hủy buổi học.",
      sessionId: data.id,
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống buổi học. Vui lòng thử lại.",
    );
  }
}

export async function rescheduleSessionAction(
  input: RescheduleSessionActionInput,
): Promise<SessionLifecycleActionState> {
  const permissionError =
    await getLifecyclePermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    rescheduleSessionSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại lịch mới của buổi học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "update_class_session",
      {
        p_class_session_id: parsed.data.sessionId,
        p_end_time: parsed.data.endTime,
        p_learning_mode: parsed.data.learningMode,
        p_meeting_url: parsed.data.meetingUrl ?? "",
        p_notes: parsed.data.notes ?? "",
        p_reason: parsed.data.reason,
        p_room_name: parsed.data.roomName ?? "",
        p_session_date: parsed.data.sessionDate,
        p_start_time: parsed.data.startTime,
      },
    );

    if (error) {
      return createErrorState(
        getLifecycleRpcErrorMessage(error.message),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về kết quả đổi lịch buổi học.",
      );
    }

    revalidateSessionRoutes(data.id);
    revalidatePath(`/classes/${data.class_id}`);

    return {
      message: "Đã cập nhật lịch buổi học.",
      sessionId: data.id,
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống buổi học. Vui lòng thử lại.",
    );
  }
}
