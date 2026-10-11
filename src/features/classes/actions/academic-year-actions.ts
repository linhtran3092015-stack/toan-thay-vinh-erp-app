"use server";

import { revalidatePath } from "next/cache";

import type {
  ActivateAcademicYearActionInput,
  ChangeAcademicYearStatusActionInput,
  ClassManagementActionState,
  CreateAcademicYearActionInput,
} from "@/features/classes/forms/class-action-types";
import {
  academicYearFormSchema,
  activateAcademicYearSchema,
  changeAcademicYearStatusSchema,
} from "@/features/classes/forms/academic-year-form-schema";
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
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền quản lý năm học. Vui lòng đăng nhập lại hoặc thử lại.";
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
    ACADEMIC_YEAR_ACTIVATION_REASON_REQUIRED:
      "Bắt buộc nhập lý do kích hoạt năm học.",

    ACADEMIC_YEAR_ARCHIVE_TRANSITION_INVALID:
      "Trạng thái hiện tại không cho phép lưu trữ năm học.",

    ACADEMIC_YEAR_CANNOT_BE_ACTIVATED:
      "Năm học đã đóng hoặc lưu trữ nên không thể kích hoạt.",

    ACADEMIC_YEAR_CLOSE_TRANSITION_INVALID:
      "Trạng thái hiện tại không cho phép đóng năm học.",

    ACADEMIC_YEAR_CODE_ALREADY_EXISTS:
      "Mã năm học này đã tồn tại.",

    ACADEMIC_YEAR_CODE_INVALID:
      "Mã năm học phải có dạng YYYY-YYYY.",

    ACADEMIC_YEAR_CODE_REQUIRED:
      "Mã năm học không được để trống.",

    ACADEMIC_YEAR_DATE_RANGE_INVALID:
      "Ngày kết thúc không được trước ngày bắt đầu.",

    ACADEMIC_YEAR_END_DATE_REQUIRED:
      "Bắt buộc nhập ngày kết thúc năm học.",

    ACADEMIC_YEAR_HAS_NON_ARCHIVED_CLASSES:
      "Chưa thể lưu trữ năm học vì vẫn còn lớp chưa được lưu trữ.",

    ACADEMIC_YEAR_HAS_OPEN_CLASSES:
      "Chưa thể đóng năm học vì vẫn còn lớp đang mở.",

    ACADEMIC_YEAR_ID_REQUIRED:
      "Thiếu mã năm học cần thao tác.",

    ACADEMIC_YEAR_NAME_REQUIRED:
      "Tên năm học không được để trống.",

    ACADEMIC_YEAR_NOT_FOUND:
      "Không tìm thấy năm học cần thao tác.",

    ACADEMIC_YEAR_START_DATE_REQUIRED:
      "Bắt buộc nhập ngày bắt đầu năm học.",

    ACADEMIC_YEAR_STATUS_REASON_REQUIRED:
      "Bắt buộc nhập lý do đổi trạng thái năm học.",

    ACADEMIC_YEAR_TARGET_STATUS_INVALID:
      "Trạng thái năm học được chọn không hợp lệ.",

    ARCHIVED_ACADEMIC_YEAR_IS_IMMUTABLE:
      "Năm học đã lưu trữ nên không thể thay đổi.",

    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    CLASS_CREATE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền quản lý năm học.",
  };

  for (
    const [databaseMessage, userMessage]
    of Object.entries(knownMessages)
  ) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật năm học. Dữ liệu chưa được thay đổi.";
}

function revalidateAcademicYearRoutes(): void {
  revalidatePath("/classes");
  revalidatePath("/classes/academic-years");
}

export async function createAcademicYearAction(
  input: CreateAcademicYearActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    academicYearFormSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin năm học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "create_academic_year",
      {
        p_code: parsed.data.code,
        p_ends_on: parsed.data.endsOn,
        p_name: parsed.data.name,
        p_starts_on: parsed.data.startsOn,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    if (!data) {
      return createErrorState(
        "Database không trả về năm học vừa tạo.",
      );
    }

    revalidateAcademicYearRoutes();

    return {
      message: "Đã tạo năm học mới.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống năm học. Vui lòng thử lại.",
    );
  }
}

export async function activateAcademicYearAction(
  input: ActivateAcademicYearActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    activateAcademicYearSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin kích hoạt năm học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "activate_academic_year",
      {
        p_academic_year_id:
          parsed.data.academicYearId,
        p_reason: parsed.data.reason,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    if (!data) {
      return createErrorState(
        "Database không trả về kết quả kích hoạt năm học.",
      );
    }

    revalidateAcademicYearRoutes();

    return {
      message:
        "Đã kích hoạt và đặt làm năm học hiện tại.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống năm học. Vui lòng thử lại.",
    );
  }
}

export async function changeAcademicYearStatusAction(
  input: ChangeAcademicYearStatusActionInput,
): Promise<ClassManagementActionState> {
  const permissionError =
    await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed =
    changeAcademicYearStatusSchema.safeParse(
      input,
    );

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin đổi trạng thái năm học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "change_academic_year_status",
      {
        p_academic_year_id:
          parsed.data.academicYearId,
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

    if (!data) {
      return createErrorState(
        "Database không trả về kết quả đổi trạng thái năm học.",
      );
    }

    revalidateAcademicYearRoutes();

    return {
      message:
        parsed.data.targetStatus === "closed"
          ? "Đã đóng năm học."
          : "Đã lưu trữ năm học.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống năm học. Vui lòng thử lại.",
    );
  }
}
