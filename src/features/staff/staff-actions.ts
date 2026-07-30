"use server";

import { revalidatePath } from "next/cache";

import type {
  CreateStaffRateVersionActionInput,
  StaffManagementActionState,
  UpdateStaffProfileActionInput,
} from "@/features/staff/staff-action-types";
import {
  createStaffRateVersionSchema,
  updateStaffProfileSchema,
} from "@/features/staff/staff-management-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createErrorState(
  message: string,
  fieldErrors?: StaffManagementActionState["fieldErrors"],
): StaffManagementActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function getPermissionError(
  permission: PermissionCode,
): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền quản trị nhân sự. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes(permission)) {
    return `Tài khoản hiện tại không có quyền ${permission}.`;
  }

  return null;
}

function getRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    ACTIVE_OR_SUSPENDED_STAFF_LEFT_AT_FORBIDDEN:
      "Chỉ nhập ngày nghỉ khi trạng thái là Đã nghỉ.",
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn.",
    INACTIVE_STAFF_LEFT_AT_REQUIRED:
      "Cần nhập ngày nghỉ khi nhân sự đã nghỉ.",
    LAST_ACTIVE_OWNER_CANNOT_BE_DEACTIVATED:
      "Không thể vô hiệu hóa Owner đang hoạt động cuối cùng.",
    STAFF_DISPLAY_NAME_INVALID: "Tên hiển thị không hợp lệ.",
    STAFF_EMPLOYEE_CODE_INVALID: "Mã nhân sự không hợp lệ.",
    STAFF_EMPLOYMENT_DATES_INVALID:
      "Ngày nghỉ không thể trước ngày vào làm.",
    STAFF_EMPLOYMENT_STATUS_INVALID: "Trạng thái làm việc không hợp lệ.",
    STAFF_MANAGE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền staff.manage.",
    STAFF_MANAGE_RATES_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền staff.manage_rates.",
    STAFF_OFFLINE_HOURLY_RATE_INVALID:
      "Đơn giá offline phải là số chẵn, không âm.",
    STAFF_PHONE_INVALID: "Số điện thoại không hợp lệ.",
    STAFF_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ nhân sự.",
    STAFF_PROFILE_UPDATE_REASON_REQUIRED: "Bắt buộc nhập lý do cập nhật.",
    STAFF_RATE_EFFECTIVE_FROM_REQUIRED:
      "Bắt buộc chọn ngày hiệu lực.",
    STAFF_RATE_VERSION_EFFECTIVE_DATE_ALREADY_EXISTS:
      "Đã có phiên bản đơn giá với ngày hiệu lực này.",
    STAFF_RATE_VERSION_REASON_REQUIRED:
      "Bắt buộc nhập lý do thêm phiên bản đơn giá.",
    STAFF_RATE_VERSION_REQUIRES_ACTIVE_PROFILE:
      "Chỉ có thể thêm đơn giá cho nhân sự đang làm việc.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  if (message.includes("profiles_employee_code_lower_unique_idx")) {
    return "Mã nhân sự này đã được sử dụng.";
  }

  return "Không thể lưu thay đổi. Dữ liệu chưa được cập nhật.";
}

function revalidateStaffRoutes(staffId: string): void {
  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
}

export async function updateStaffProfileAction(
  input: UpdateStaffProfileActionInput,
): Promise<StaffManagementActionState> {
  const permissionError = await getPermissionError("staff.manage");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = updateStaffProfileSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin hồ sơ nhân sự.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_staff_profile", {
      p_display_name: parsed.data.displayName,
      p_employee_code: parsed.data.employeeCode,
      p_employment_status: parsed.data.employmentStatus,
      p_phone: parsed.data.phone,
      p_reason: parsed.data.reason,
      p_staff_id: parsed.data.staffId,
      ...(parsed.data.joinedAt
        ? { p_joined_at: parsed.data.joinedAt }
        : {}),
      ...(parsed.data.leftAt ? { p_left_at: parsed.data.leftAt } : {}),
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.[0]?.id) {
      return createErrorState(
        "Database không trả về hồ sơ nhân sự vừa cập nhật.",
      );
    }

    revalidateStaffRoutes(parsed.data.staffId);

    return {
      message: "Đã cập nhật hồ sơ nhân sự.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống nhân sự. Vui lòng thử lại.",
    );
  }
}

export async function createStaffRateVersionAction(
  input: CreateStaffRateVersionActionInput,
): Promise<StaffManagementActionState> {
  const permissionError = await getPermissionError("staff.manage_rates");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = createStaffRateVersionSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại phiên bản đơn giá.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "create_staff_rate_version",
      {
        p_effective_from: parsed.data.effectiveFrom,
        p_note: parsed.data.note,
        p_offline_hourly_rate_vnd: parsed.data.offlineHourlyRateVnd,
        p_reason: parsed.data.reason,
        p_staff_id: parsed.data.staffId,
      },
    );

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.[0]?.id) {
      return createErrorState(
        "Database không trả về phiên bản đơn giá vừa tạo.",
      );
    }

    revalidateStaffRoutes(parsed.data.staffId);

    return {
      message: "Đã thêm phiên bản đơn giá mới.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống đơn giá. Vui lòng thử lại.",
    );
  }
}
