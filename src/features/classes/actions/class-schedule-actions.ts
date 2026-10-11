"use server";

import { revalidatePath } from "next/cache";

import type {
  ClassManagementActionState,
  CreateClassScheduleActionInput,
  EndClassScheduleActionInput,
  ReplaceClassScheduleActionInput,
} from "@/features/classes/forms/class-action-types";
import {
  createClassScheduleSchema,
  endClassScheduleSchema,
  replaceClassScheduleSchema,
} from "@/features/classes/forms/class-schedule-form-schema";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { permissionDeniedMessage } from "@/lib/permissions/labels";
function createErrorState(
  message: string,
  fieldErrors?: ClassManagementActionState["fieldErrors"],
): ClassManagementActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function getPermissionError(): Promise<string | null> {
  const permissionResult =
    await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền quản lý lịch học. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (
    !permissionResult.permissions.includes(
      "classes.manage_schedule",
    )
  ) {
    return permissionDeniedMessage("classes.manage_schedule");
  }

  return null;
}

function getRpcErrorMessage(
  message: string,
): string {
  const knownMessages: Record<string, string> = {
    ACADEMIC_YEAR_NOT_FOUND:
      "Không tìm thấy năm học của lớp.",

    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    CLASS_ACTIVE_SCHEDULE_LIMIT_REACHED:
      "Số lịch đang hoạt động đã đạt giới hạn số buổi mỗi tuần của lớp.",

    CLASS_ACTIVE_SCHEDULE_SLOT_ALREADY_EXISTS:
      "Lớp đã có lịch hoạt động trùng thành phần và thứ trong tuần.",

    CLASS_ID_REQUIRED:
      "Thiếu mã lớp cần tạo lịch.",

    CLASS_NOT_FOUND:
      "Không tìm thấy lớp học cần quản lý lịch.",

    CLASS_SCHEDULE_CANNOT_BE_REPLACED_ON_START_DATE:
      "Không thể thay lịch ngay trong ngày lịch bắt đầu có hiệu lực.",

    CLASS_SCHEDULE_COMPONENT_CODE_INVALID:
      "Mã thành phần lịch chỉ gồm chữ in hoa, số và các dấu . _ -.",

    CLASS_SCHEDULE_DATE_OUTSIDE_ACADEMIC_YEAR:
      "Ngày hiệu lực của lịch nằm ngoài thời gian năm học.",

    CLASS_SCHEDULE_EFFECTIVE_FROM_REQUIRED:
      "Bắt buộc nhập ngày lịch bắt đầu có hiệu lực.",

    CLASS_SCHEDULE_EFFECTIVE_TO_REQUIRED:
      "Bắt buộc nhập ngày kết thúc lịch.",

    CLASS_SCHEDULE_END_DATE_CANNOT_BE_FUTURE:
      "Ngày kết thúc lịch không được lớn hơn ngày hiện tại.",

    CLASS_SCHEDULE_END_DATE_INVALID:
      "Ngày kết thúc không được trước ngày lịch bắt đầu có hiệu lực.",

    CLASS_SCHEDULE_END_REASON_REQUIRED:
      "Bắt buộc nhập lý do kết thúc lịch.",

    CLASS_SCHEDULE_LEARNING_MODE_INVALID:
      "Hình thức học của lịch không hợp lệ.",

    CLASS_SCHEDULE_MUST_START_ON_BUSINESS_DATE:
      "Lịch mới phải bắt đầu từ ngày hiện tại theo giờ Việt Nam.",

    CLASS_SCHEDULE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền quản lý lịch học.",

    CLASS_SCHEDULE_REPLACEMENT_MUST_START_TODAY:
      "Lịch thay thế phải bắt đầu từ ngày hiện tại theo giờ Việt Nam.",

    CLASS_SCHEDULE_REPLACEMENT_REASON_REQUIRED:
      "Bắt buộc nhập lý do thay đổi lịch.",

    CLASS_SCHEDULE_SUCCESSOR_DATE_INVALID:
      "Ngày hiệu lực của lịch thay thế không hợp lệ.",

    CLASS_SCHEDULE_TEMPLATE_ID_REQUIRED:
      "Thiếu mã lịch cần thao tác.",

    CLASS_SCHEDULE_TEMPLATE_NOT_FOUND:
      "Không tìm thấy lịch học cần thao tác.",

    CLASS_SCHEDULE_TIME_INVALID:
      "Giờ kết thúc phải sau giờ bắt đầu.",

    CLASS_SCHEDULE_WEEKDAY_INVALID:
      "Thứ trong tuần phải từ 1 đến 7.",

    CLASS_SCHEDULE_REQUIRES_ACTIVE_ACADEMIC_YEAR:
      "Chỉ có thể quản lý lịch khi năm học đang hoạt động.",

    CLASS_SCHEDULE_REQUIRES_ACTIVE_CLASS:
      "Chỉ có thể quản lý lịch của lớp đang hoạt động.",

    ENDED_CLASS_SCHEDULE_IS_IMMUTABLE:
      "Lịch đã kết thúc nên không thể thay đổi.",

    ONLY_ACTIVE_CLASS_SCHEDULE_CAN_BE_ENDED:
      "Chỉ lịch đang hoạt động mới có thể được kết thúc.",

    ONLY_ACTIVE_CLASS_SCHEDULE_CAN_BE_REPLACED:
      "Chỉ lịch đang hoạt động mới có thể được thay thế.",

    SUPERSEDED_CLASS_SCHEDULE_COMPONENT_MISMATCH:
      "Lịch thay thế không cùng thành phần với lịch cũ.",

    SUPERSEDED_CLASS_SCHEDULE_MUST_BE_ENDED:
      "Lịch cũ phải được kết thúc trước khi tạo bản thay thế.",

    SUPERSEDED_CLASS_SCHEDULE_MUST_BELONG_TO_SAME_CLASS:
      "Lịch cũ và lịch thay thế phải thuộc cùng một lớp.",

    SUPERSEDED_CLASS_SCHEDULE_NOT_FOUND:
      "Không tìm thấy lịch cũ trong chuỗi thay thế.",
  };

  for (
    const [databaseMessage, userMessage]
    of Object.entries(knownMessages)
  ) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật lịch học. Dữ liệu chưa được thay đổi.";
}

function revalidateScheduleRoutes(
  classId?: string,
): void {
  revalidatePath("/classes");

  if (classId) {
    revalidatePath(`/classes/${classId}`);
    return;
  }

  revalidatePath(
    "/classes/[classId]",
    "page",
  );
}

export async function createClassScheduleAction(
  input: CreateClassScheduleActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    createClassScheduleSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin lịch học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "create_class_schedule_template",
      {
        p_class_id: parsed.data.classId,
        p_component_code:
          parsed.data.componentCode,
        p_effective_from:
          parsed.data.effectiveFrom,
        p_end_time: parsed.data.endTime,
        p_learning_mode:
          parsed.data.learningMode,
        p_meeting_url:
          parsed.data.meetingUrl,
        p_room_name: parsed.data.roomName,
        p_start_time:
          parsed.data.startTime,
        p_weekday: parsed.data.weekday,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về lịch học vừa tạo.",
      );
    }

    revalidateScheduleRoutes(
      parsed.data.classId,
    );

    return {
      message: "Đã tạo lịch học cố định.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống lịch học. Vui lòng thử lại.",
    );
  }
}

export async function replaceClassScheduleAction(
  input: ReplaceClassScheduleActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    replaceClassScheduleSchema.safeParse(
      input,
    );

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin lịch thay thế.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "replace_class_schedule_template",
      {
        p_effective_from:
          parsed.data.effectiveFrom,
        p_end_time: parsed.data.endTime,
        p_learning_mode:
          parsed.data.learningMode,
        p_meeting_url:
          parsed.data.meetingUrl,
        p_reason: parsed.data.reason,
        p_room_name: parsed.data.roomName,
        p_schedule_template_id:
          parsed.data.scheduleTemplateId,
        p_start_time:
          parsed.data.startTime,
        p_weekday: parsed.data.weekday,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về lịch thay thế.",
      );
    }

    revalidateScheduleRoutes();

    return {
      message:
        "Đã kết thúc lịch cũ và tạo lịch thay thế.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống lịch học. Vui lòng thử lại.",
    );
  }
}

export async function endClassScheduleAction(
  input: EndClassScheduleActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    endClassScheduleSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin kết thúc lịch.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "end_class_schedule_template",
      {
        p_effective_to:
          parsed.data.effectiveTo,
        p_reason: parsed.data.reason,
        p_schedule_template_id:
          parsed.data.scheduleTemplateId,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về kết quả kết thúc lịch.",
      );
    }

    revalidateScheduleRoutes();

    return {
      message: "Đã kết thúc lịch học.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống lịch học. Vui lòng thử lại.",
    );
  }
}
