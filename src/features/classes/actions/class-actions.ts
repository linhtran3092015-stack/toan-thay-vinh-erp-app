"use server";

import { revalidatePath } from "next/cache";

import type {
  ChangeClassStatusActionInput,
  ClassManagementActionState,
  CreateClassActionInput,
  UpdateClassActionInput,
} from "@/features/classes/forms/class-action-types";
import {
  changeClassStatusSchema,
  createClassSchema,
  updateClassSchema,
} from "@/features/classes/forms/class-form-schema";
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
    return "Không thể xác minh quyền quản lý lớp học. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (
    !permissionResult.permissions.includes(
      "classes.create",
    )
  ) {
    return permissionDeniedMessage("classes.create");
  }

  return null;
}

function getRpcErrorMessage(
  message: string,
): string {
  const knownMessages: Record<string, string> = {
    ACADEMIC_YEAR_ID_REQUIRED:
      "Bắt buộc chọn năm học.",

    ACADEMIC_YEAR_NOT_FOUND:
      "Không tìm thấy năm học đã chọn.",

    ACTIVE_CLASS_REQUIRES_ACTIVE_ACADEMIC_YEAR:
      "Chỉ có thể kích hoạt lớp khi năm học đang hoạt động.",

    ARCHIVED_CLASS_IS_IMMUTABLE:
      "Lớp đã lưu trữ nên không thể thay đổi.",

    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    CLASS_ACADEMIC_YEAR_MUST_BE_OPEN:
      "Năm học đã đóng hoặc lưu trữ nên không thể tiếp nhận lớp.",

    CLASS_ACTIVATION_TRANSITION_INVALID:
      "Chỉ lớp ở trạng thái nháp mới có thể được kích hoạt.",

    CLASS_ARCHIVE_TRANSITION_INVALID:
      "Trạng thái hiện tại không cho phép lưu trữ lớp.",

    CLASS_CLOSE_TRANSITION_INVALID:
      "Chỉ lớp đang hoạt động mới có thể được đóng.",

    CLASS_CODE_ALREADY_EXISTS_IN_ACADEMIC_YEAR:
      "Mã lớp này đã tồn tại trong năm học đã chọn.",

    CLASS_CODE_INVALID:
      "Mã lớp chỉ được gồm chữ in hoa, số và các dấu . _ -.",

    CLASS_CODE_REQUIRED:
      "Mã lớp không được để trống.",

    CLASS_CREATE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền quản lý lớp học.",

    CLASS_DEFAULT_LEARNING_MODE_INVALID:
      "Hình thức học mặc định không hợp lệ.",

    CLASS_GRADE_INVALID:
      "Khối lớp phải từ 1 đến 12.",

    CLASS_HAS_ACTIVE_SCHEDULES:
      "Cần kết thúc toàn bộ lịch đang hoạt động trước khi đóng hoặc lưu trữ lớp.",

    CLASS_HAS_ACTIVE_STUDENT_ENROLLMENTS:
      "Cần xử lý toàn bộ học viên đang học trước khi đóng hoặc lưu trữ lớp.",

    CLASS_HAS_SESSION_IN_PROGRESS:
      "Lớp còn buổi học đang diễn ra. Hoàn thành hoặc hủy buổi đó trước khi đóng lớp.",

    CLASS_ID_REQUIRED:
      "Thiếu mã lớp cần thao tác.",

    CLASS_IDENTITY_IMMUTABLE_AFTER_SCHEDULE:
      "Không thể đổi năm học, mã lớp, khối hoặc trình độ sau khi lớp đã có lịch.",

    CLASS_IDENTITY_IMMUTABLE_AFTER_USE:
      "Không thể đổi năm học, mã lớp, khối hoặc trình độ sau khi lớp đã được sử dụng.",

    CLASS_LEVEL_INVALID:
      "Trình độ lớp phải là A, B hoặc CLC.",

    CLASS_NAME_REQUIRED:
      "Tên lớp không được để trống.",

    CLASS_NOT_FOUND:
      "Không tìm thấy lớp học cần thao tác.",

    CLASS_STATUS_REASON_REQUIRED:
      "Bắt buộc nhập lý do đổi trạng thái lớp.",

    CLASS_TARGET_STATUS_INVALID:
      "Trạng thái lớp được chọn không hợp lệ.",

    CLASS_UPDATE_REASON_REQUIRED:
      "Bắt buộc nhập lý do cập nhật lớp.",

    CLASS_WEEKLY_SESSION_COUNT_INVALID:
      "Số buổi mỗi tuần phải từ 1 đến 7.",

    CLOSED_OR_ARCHIVED_CLASS_CANNOT_BE_EDITED:
      "Lớp đã đóng hoặc lưu trữ nên không thể chỉnh sửa.",
  };

  for (
    const [databaseMessage, userMessage]
    of Object.entries(knownMessages)
  ) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật lớp học. Dữ liệu chưa được thay đổi.";
}

function revalidateClassRoutes(
  classId?: string,
): void {
  revalidatePath("/classes");

  if (classId) {
    revalidatePath(`/classes/${classId}`);
    revalidatePath(`/classes/${classId}/edit`);
  }
}

export async function createClassAction(
  input: CreateClassActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = createClassSchema.safeParse(
    input,
  );

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin lớp học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "create_class",
      {
        p_academic_year_id:
          parsed.data.academicYearId,
        p_classin_url:
          parsed.data.classinUrl,
        p_code: parsed.data.code,
        p_default_learning_mode:
          parsed.data.defaultLearningMode,
        p_grade: parsed.data.grade,
        p_level: parsed.data.level,
        p_name: parsed.data.name,
        p_notes: parsed.data.notes,
        p_weekly_session_count:
          parsed.data.weeklySessionCount,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về lớp học vừa tạo.",
      );
    }

    revalidateClassRoutes(data.id);

    return {
      message: "Đã tạo lớp học mới.",
      redirectTo: `/classes/${data.id}`,
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống lớp học. Vui lòng thử lại.",
    );
  }
}

export async function updateClassAction(
  input: UpdateClassActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = updateClassSchema.safeParse(
    input,
  );

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin cập nhật lớp.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "update_class",
      {
        p_academic_year_id:
          parsed.data.academicYearId,
        p_class_id: parsed.data.classId,
        p_classin_url:
          parsed.data.classinUrl,
        p_code: parsed.data.code,
        p_default_learning_mode:
          parsed.data.defaultLearningMode,
        p_grade: parsed.data.grade,
        p_level: parsed.data.level,
        p_name: parsed.data.name,
        p_notes: parsed.data.notes,
        p_reason: parsed.data.reason,
        p_weekly_session_count:
          parsed.data.weeklySessionCount,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về kết quả cập nhật lớp.",
      );
    }

    revalidateClassRoutes(parsed.data.classId);

    return {
      message: "Đã cập nhật thông tin lớp học.",
      redirectTo:
        `/classes/${parsed.data.classId}`,
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống lớp học. Vui lòng thử lại.",
    );
  }
}

export async function changeClassStatusAction(
  input: ChangeClassStatusActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    changeClassStatusSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin đổi trạng thái lớp.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "change_class_status",
      {
        p_class_id: parsed.data.classId,
        p_reason: parsed.data.reason,
        p_target_status:
          parsed.data.targetStatus,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    if (!data?.id) {
      return createErrorState(
        "Database không trả về kết quả đổi trạng thái lớp.",
      );
    }

    revalidateClassRoutes(parsed.data.classId);

    const successMessages = {
      active: "Đã kích hoạt lớp học.",
      archived: "Đã lưu trữ lớp học.",
      closed: "Đã đóng lớp học.",
    } as const;

    return {
      message:
        successMessages[
          parsed.data.targetStatus
        ],
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống lớp học. Vui lòng thử lại.",
    );
  }
}
