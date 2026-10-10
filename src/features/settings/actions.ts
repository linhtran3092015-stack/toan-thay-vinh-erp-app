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

const deleteAccountSchema = z.object({
  reason: reasonSchema,
  userId: z.string().uuid("Tài khoản không hợp lệ."),
});

const updateSystemSettingsSchema = z.object({
  address: z.string().trim().max(500, "Địa chỉ không được vượt quá 500 ký tự."),
  contactEmail: z.string().trim().max(160).refine((value) => !value || z.string().email().safeParse(value).success, "Email liên hệ không hợp lệ."),
  contactPhone: z.string().trim().max(160, "Số điện thoại liên hệ quá dài."),
  defaultPublicLinkExpiryDays: z.number().int().min(1, "Thời hạn tối thiểu là 1 ngày.").max(90, "Thời hạn tối đa là 90 ngày."),
  displayName: z.string().trim().min(1, "Bắt buộc nhập tên trung tâm.").max(160),
  teacherDisplayName: z.string().trim().min(1, "Bắt buộc nhập tên giáo viên / thương hiệu.").max(160),
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
type DeleteAccountInput = z.input<typeof deleteAccountSchema>;
type UpdateSystemSettingsInput = z.input<typeof updateSystemSettingsSchema>;
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
    ACCOUNT_ALREADY_DELETED: "Tài khoản này đã được xóa trước đó.",
    ACTIVE_OWNER_REQUIRED: "Chỉ Owner đang hoạt động được thực hiện thao tác này.",
    AT_LEAST_ONE_ROLE_REQUIRED: "Bắt buộc chọn ít nhất một vai trò.",
    CANNOT_DELETE_OWN_ACCOUNT: "Không thể tự xóa tài khoản đang đăng nhập.",
    CANNOT_DELETE_OWNER_ACCOUNT:
      "Không thể xóa tài khoản đang giữ vai trò Owner. Hãy bỏ vai trò Owner trước.",
    DELETION_REASON_REQUIRED: "Bắt buộc nhập lý do xóa tài khoản.",
    TARGET_PROFILE_NOT_FOUND: "Không tìm thấy tài khoản cần xóa.",
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
    SYSTEM_SETTINGS_INVALID_EXPIRY: "Thời hạn liên kết phải từ 1 đến 90 ngày.",
    SYSTEM_SETTINGS_INVALID_VALUE: "Giá trị cài đặt không hợp lệ.",
    SYSTEM_SETTINGS_PERMISSION_DENIED: "Không có quyền quản lý cài đặt hệ thống.",
    SYSTEM_SETTINGS_UNKNOWN_KEY: "Khóa cài đặt không được hỗ trợ.",
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

export async function deleteAccountAction(
  input: DeleteAccountInput,
): Promise<SettingsActionState> {
  const parsed = deleteAccountSchema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return createErrorState("Vui lòng kiểm tra lý do xóa tài khoản.", {
      reason: errors.reason,
      userId: errors.userId,
    });
  }

  const ownerError = await verifyOwner();
  if (ownerError) return ownerError;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("delete_staff_account", {
      deletion_reason: parsed.data.reason,
      target_user_id: parsed.data.userId,
    });

    if (error) return createErrorState(getRpcErrorMessage(error.message));

    const result = data as { hardDeleted?: boolean } | null;
    if (!result || typeof result.hardDeleted !== "boolean") {
      return createErrorState("Database không xác nhận được việc xóa tài khoản.");
    }

    revalidatePath("/settings");
    revalidatePath("/settings/users");
    revalidatePath("/staff");
    revalidatePath("/timekeeping");
    return {
      message: result.hardDeleted
        ? "Đã xóa hẳn tài khoản (chưa phát sinh dữ liệu)."
        : "Đã vô hiệu hóa và ẩn tài khoản; lịch sử chấm công, lương được giữ lại.",
      status: "success",
    };
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

export async function updateSystemSettingsAction(input: UpdateSystemSettingsInput): Promise<SettingsActionState> {
  const parsed = updateSystemSettingsSchema.safeParse(input);
  if (!parsed.success) return createErrorState(parsed.error.issues[0]?.message ?? "Cài đặt không hợp lệ.");
  const { getDatabasePermissions } = await import("@/lib/permissions/database-permissions");
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.manage")) return createErrorState("Không có quyền quản lý cài đặt hệ thống.");
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("update_system_settings", { p_values: {
      "center.address": parsed.data.address,
      "center.contact_email": parsed.data.contactEmail,
      "center.contact_phone": parsed.data.contactPhone,
      "center.display_name": parsed.data.displayName,
      "coaching.default_public_link_expiry_days": parsed.data.defaultPublicLinkExpiryDays,
      "teacher.display_name": parsed.data.teacherDisplayName,
    } });
    if (error) return createErrorState(getRpcErrorMessage(error.message));
    revalidatePath("/settings");
    revalidatePath("/settings/general");
    revalidatePath("/coaching");
    return { message: "Đã lưu cài đặt hệ thống.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối hệ thống cài đặt.");
  }
}
