"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { StaffRoleActionState } from "@/features/staff/role-action-types";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { permissionDeniedMessage } from "@/lib/permissions/labels";
const assignRoleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Bắt buộc nhập lý do cấp vai trò."),
  roleCode: z
    .string()
    .trim()
    .min(1, "Bắt buộc chọn vai trò.")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Mã vai trò không hợp lệ.",
    ),
  userId: z
    .string()
    .uuid("Mã hồ sơ nhân sự không hợp lệ."),
});

const revokeRoleSchema = z.object({
  assignmentId: z
    .string()
    .uuid("Mã phân công vai trò không hợp lệ."),
  reason: z
    .string()
    .trim()
    .min(1, "Bắt buộc nhập lý do thu hồi vai trò."),
});

function createErrorState(
  message: string,
  fieldErrors?: StaffRoleActionState["fieldErrors"],
): StaffRoleActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function canManageStaffRoles(): Promise<
  | { allowed: true }
  | { allowed: false; state: StaffRoleActionState }
> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return {
      allowed: false,
      state: createErrorState(
        "Không thể xác minh quyền quản lý vai trò. Vui lòng đăng nhập lại hoặc thử lại.",
      ),
    };
  }

  if (!permissionResult.permissions.includes("staff.roles.manage")) {
    return {
      allowed: false,
      state: createErrorState(
        permissionDeniedMessage("staff.roles.manage"),
      ),
    };
  }

  return { allowed: true };
}

function getRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    ACTIVE_ROLE_ASSIGNMENT_ALREADY_EXISTS:
      "Nhân sự này đã có vai trò được chọn.",
    ASSIGNED_ROLE_NOT_FOUND:
      "Không tìm thấy vai trò của phân công này.",
    ASSIGNMENT_REASON_REQUIRED:
      "Bắt buộc nhập lý do cấp vai trò.",
    AUTHENTICATED_USER_REQUIRED:
      "Phiên đăng nhập đã hết hạn.",
    LAST_ACTIVE_OWNER_CANNOT_BE_REVOKED:
      "Không thể thu hồi Owner cuối cùng đang hoạt động.",
    ONLY_ACTIVE_OWNER_CAN_ASSIGN_OWNER_ROLE:
      "Chỉ Owner đang hoạt động mới được cấp vai trò Owner.",
    ONLY_ACTIVE_OWNER_CAN_REVOKE_OWNER_ROLE:
      "Chỉ Owner đang hoạt động mới được thu hồi vai trò Owner.",
    OWNER_CANNOT_REMOVE_OWN_MANAGEMENT_ACCESS:
      "Không thể tự thu hồi quyền Owner khi thao tác làm mất quyền quản trị vai trò.",
    REVOCATION_REASON_REQUIRED:
      "Bắt buộc nhập lý do thu hồi vai trò.",
    ROLE_ASSIGNMENT_ALREADY_REVOKED:
      "Vai trò này đã được thu hồi trước đó.",
    ROLE_ASSIGNMENT_NOT_FOUND:
      "Không tìm thấy phân công vai trò cần thu hồi.",
    STAFF_ROLES_MANAGE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền quản lý vai trò.",
    TARGET_ASSIGNMENT_ID_REQUIRED:
      "Thiếu mã phân công vai trò.",
    TARGET_PROFILE_MUST_BE_ACTIVE:
      "Chỉ có thể cấp vai trò cho nhân sự đang hoạt động.",
    TARGET_ROLE_CODE_REQUIRED:
      "Bắt buộc chọn vai trò.",
    TARGET_ROLE_MUST_BE_ACTIVE:
      "Vai trò được chọn hiện không hoạt động.",
    TARGET_ROLE_NOT_FOUND:
      "Không tìm thấy vai trò được chọn.",
    TARGET_USER_ID_REQUIRED:
      "Thiếu mã hồ sơ nhân sự.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(
    knownMessages,
  )) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật vai trò. Dữ liệu chưa được thay đổi.";
}

export async function assignStaffRoleAction(
  _previousState: StaffRoleActionState,
  formData: FormData,
): Promise<StaffRoleActionState> {
  const permissionCheck = await canManageStaffRoles();

  if (!permissionCheck.allowed) {
    return permissionCheck.state;
  }

  const parsed = assignRoleSchema.safeParse({
    reason: formData.get("reason"),
    roleCode: formData.get("roleCode"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;

    return createErrorState(
      "Vui lòng kiểm tra lại thông tin cấp vai trò.",
      {
        reason: errors.reason,
        roleCode: errors.roleCode,
        userId: errors.userId,
      },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("assign_user_role", {
      assignment_reason: parsed.data.reason,
      target_role_code: parsed.data.roleCode,
      target_user_id: parsed.data.userId,
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data || data.length !== 1) {
      return createErrorState(
        "Database không trả về kết quả cấp vai trò hợp lệ.",
      );
    }

    revalidatePath("/staff");
    revalidatePath("/settings/users");

    return {
      message: "Đã cấp vai trò thành công.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống phân quyền. Vui lòng thử lại.",
    );
  }
}

export async function revokeStaffRoleAction(
  _previousState: StaffRoleActionState,
  formData: FormData,
): Promise<StaffRoleActionState> {
  const permissionCheck = await canManageStaffRoles();

  if (!permissionCheck.allowed) {
    return permissionCheck.state;
  }

  const parsed = revokeRoleSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;

    return createErrorState(
      "Vui lòng kiểm tra lại thông tin thu hồi vai trò.",
      {
        assignmentId: errors.assignmentId,
        reason: errors.reason,
      },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "revoke_user_role_assignment",
      {
        revocation_reason: parsed.data.reason,
        target_assignment_id: parsed.data.assignmentId,
      },
    );

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data || data.length !== 1) {
      return createErrorState(
        "Database không trả về kết quả thu hồi vai trò hợp lệ.",
      );
    }

    revalidatePath("/staff");
    revalidatePath("/settings/users");

    return {
      message: "Đã thu hồi vai trò thành công.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống phân quyền. Vui lòng thử lại.",
    );
  }
}
