"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { SettingsActionState } from "@/features/settings/action-types";
import { getCurrentOwnerStatus } from "@/features/settings/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const roleIdsSchema = z
  .array(z.string().uuid("Vai trò không hợp lệ."))
  .min(1, "Bắt buộc chọn ít nhất một vai trò.")
  .refine((values) => new Set(values).size === values.length, {
    message: "Danh sách vai trò bị trùng.",
  });

const reasonSchema = z
  .string()
  .trim()
  .min(1, "Bắt buộc nhập lý do thay đổi.")
  .max(2000, "Lý do không được vượt quá 2.000 ký tự.");

const inviteAccountSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email không hợp lệ."),
  reason: reasonSchema,
  roleIds: roleIdsSchema,
});

const setAccountRolesSchema = z.object({
  reason: reasonSchema,
  roleIds: roleIdsSchema,
  userId: z.string().uuid("Tài khoản không hợp lệ."),
});

const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid("Lời mời không hợp lệ."),
  reason: reasonSchema,
});

const setRolePermissionsSchema = z.object({
  permissionIds: z
    .array(z.string().uuid("Quyền không hợp lệ."))
    .refine((values) => new Set(values).size === values.length, {
      message: "Danh sách quyền bị trùng.",
    }),
  reason: reasonSchema,
  roleId: z.string().uuid("Vai trò không hợp lệ."),
});

type InviteAccountInput = z.input<typeof inviteAccountSchema>;
type SetAccountRolesInput = z.input<typeof setAccountRolesSchema>;
type RevokeInvitationInput = z.input<typeof revokeInvitationSchema>;
type SetRolePermissionsInput = z.input<typeof setRolePermissionsSchema>;

function createErrorState(
  message: string,
  fieldErrors?: SettingsActionState["fieldErrors"],
): SettingsActionState {
  return { fieldErrors, message, status: "error" };
}

async function verifyOwner(): Promise<SettingsActionState | null> {
  const ownerStatus = await getCurrentOwnerStatus();

  if (!ownerStatus.ok) {
    return createErrorState(
      "Không thể xác minh quyền Owner. Dữ liệu chưa được thay đổi.",
    );
  }

  if (!ownerStatus.isOwner) {
    return createErrorState("Chỉ Owner đang hoạt động được thực hiện thao tác này.");
  }

  return null;
}

function getRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    ACCOUNT_PROFILE_ALREADY_EXISTS:
      "Email này đã có tài khoản. Hãy cập nhật vai trò trong danh sách người dùng.",
    ACTIVE_OWNER_REQUIRED: "Chỉ Owner đang hoạt động được thực hiện thao tác này.",
    AT_LEAST_ONE_ROLE_REQUIRED: "Bắt buộc chọn ít nhất một vai trò.",
    CHANGE_REASON_REQUIRED: "Bắt buộc nhập lý do thay đổi.",
    INVITATION_NOT_FOUND: "Không tìm thấy lời mời cần cập nhật.",
    INVITATION_REASON_REQUIRED: "Bắt buộc nhập lý do thêm tài khoản.",
    LAST_ACTIVE_OWNER_CANNOT_BE_REVOKED:
      "Không thể bỏ vai trò Owner của Owner cuối cùng đang hoạt động.",
    ONLY_PENDING_INVITATION_CAN_BE_REVOKED:
      "Chỉ có thể thu hồi lời mời đang chờ.",
    OWNER_PERMISSIONS_ARE_IMMUTABLE:
      "Vai trò Owner luôn có toàn quyền và không thể chỉnh sửa.",
    PENDING_INVITATION_ALREADY_EXISTS:
      "Email này đã có lời mời đang chờ đăng nhập.",
    PERMISSION_SELECTION_INVALID:
      "Danh sách quyền có mục không hợp lệ hoặc đã ngừng hoạt động.",
    REVOCATION_REASON_REQUIRED: "Bắt buộc nhập lý do thu hồi.",
    ROLE_SELECTION_INVALID:
      "Danh sách vai trò có mục không hợp lệ hoặc đã ngừng hoạt động.",
    SELECTED_ROLES_MUST_GRANT_APP_ACCESS:
      "Phải chọn ít nhất một vai trò có quyền truy cập hệ thống.",
    TARGET_PROFILE_MUST_BE_ACTIVE:
      "Chỉ có thể cập nhật vai trò cho tài khoản đang hoạt động.",
    TARGET_ROLE_MUST_BE_ACTIVE: "Vai trò được chọn hiện không hoạt động.",
    TARGET_ROLE_NOT_FOUND: "Không tìm thấy vai trò được chọn.",
    VALID_EMAIL_REQUIRED: "Email không hợp lệ.",
  };

  for (const [code, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(code)) {
      return userMessage;
    }
  }

  return "Không thể lưu thay đổi. Dữ liệu chưa được cập nhật.";
}

export async function inviteAccountAction(
  input: InviteAccountInput,
): Promise<SettingsActionState> {
  const parsed = inviteAccountSchema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return createErrorState("Vui lòng kiểm tra thông tin tài khoản.", {
      email: errors.email,
      reason: errors.reason,
      roleIds: errors.roleIds,
    });
  }

  const ownerError = await verifyOwner();
  if (ownerError) return ownerError;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_account_invitation", {
      invitation_reason: parsed.data.reason,
      target_email: parsed.data.email,
      target_role_ids: parsed.data.roleIds,
    });

    if (error) return createErrorState(getRpcErrorMessage(error.message));
    if (!data || data.length !== 1) {
      return createErrorState("Database không trả về lời mời hợp lệ.");
    }

    revalidatePath("/settings");
    revalidatePath("/settings/users");
    return {
      message: "Đã thêm email vào danh sách được phép đăng nhập.",
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối hệ thống phân quyền.");
  }
}

export async function setAccountRolesAction(
  input: SetAccountRolesInput,
): Promise<SettingsActionState> {
  const parsed = setAccountRolesSchema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return createErrorState("Vui lòng kiểm tra danh sách vai trò.", {
      reason: errors.reason,
      roleIds: errors.roleIds,
      userId: errors.userId,
    });
  }

  const ownerError = await verifyOwner();
  if (ownerError) return ownerError;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("set_user_roles", {
      change_reason: parsed.data.reason,
      target_role_ids: parsed.data.roleIds,
      target_user_id: parsed.data.userId,
    });

    if (error) return createErrorState(getRpcErrorMessage(error.message));
    if (typeof data !== "number") {
      return createErrorState("Database không xác nhận được vai trò đã lưu.");
    }

    revalidatePath("/settings");
    revalidatePath("/settings/users");
    revalidatePath("/staff");
    return { message: "Đã cập nhật vai trò tài khoản.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối hệ thống phân quyền.");
  }
}

export async function revokeInvitationAction(
  input: RevokeInvitationInput,
): Promise<SettingsActionState> {
  const parsed = revokeInvitationSchema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return createErrorState("Vui lòng kiểm tra lý do thu hồi.", {
      invitationId: errors.invitationId,
      reason: errors.reason,
    });
  }

  const ownerError = await verifyOwner();
  if (ownerError) return ownerError;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("revoke_account_invitation", {
      revocation_reason: parsed.data.reason,
      target_invitation_id: parsed.data.invitationId,
    });

    if (error) return createErrorState(getRpcErrorMessage(error.message));
    if (data !== true) {
      return createErrorState("Database không xác nhận được việc thu hồi.");
    }

    revalidatePath("/settings");
    revalidatePath("/settings/users");
    return { message: "Đã thu hồi lời mời tài khoản.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối hệ thống phân quyền.");
  }
}

export async function setRolePermissionsAction(
  input: SetRolePermissionsInput,
): Promise<SettingsActionState> {
  const parsed = setRolePermissionsSchema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return createErrorState("Vui lòng kiểm tra cấu hình quyền.", {
      permissionIds: errors.permissionIds,
      reason: errors.reason,
      roleId: errors.roleId,
    });
  }

  const ownerError = await verifyOwner();
  if (ownerError) return ownerError;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("set_role_permissions", {
      change_reason: parsed.data.reason,
      target_permission_ids: parsed.data.permissionIds,
      target_role_id: parsed.data.roleId,
    });

    if (error) return createErrorState(getRpcErrorMessage(error.message));
    if (typeof data !== "number") {
      return createErrorState("Database không xác nhận được cấu hình quyền.");
    }

    revalidatePath("/settings");
    revalidatePath("/settings/permissions");
    return { message: "Đã cập nhật quyền của vai trò.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối hệ thống phân quyền.");
  }
}
