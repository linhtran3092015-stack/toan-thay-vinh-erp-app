import "server-only";

import type {
  SettingsAccountInvitation,
  SettingsDataResult,
  SettingsInvitationDataResult,
  SettingsOwnerStatusResult,
  SettingsPermission,
  SettingsRole,
} from "@/features/settings/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSettingsPermissionMatrix(): Promise<SettingsDataResult> {
  const supabase = await createSupabaseServerClient();
  const [rolesResult, permissionsResult, grantsResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id, code, name, description, is_system, is_active")
      .order("name", { ascending: true }),
    supabase
      .from("permissions")
      .select("id, code, module, name, description, is_active")
      .order("module", { ascending: true })
      .order("code", { ascending: true }),
    supabase.from("role_permissions").select("role_id, permission_id"),
  ]);

  if (rolesResult.error) {
    return {
      error: {
        code: "roles_query_failed",
        message: "Không thể tải danh mục vai trò từ hệ thống phân quyền.",
      },
      ok: false,
    };
  }

  if (permissionsResult.error) {
    return {
      error: {
        code: "permissions_query_failed",
        message: "Không thể tải danh mục quyền từ hệ thống phân quyền.",
      },
      ok: false,
    };
  }

  if (grantsResult.error) {
    return {
      error: {
        code: "role_permissions_query_failed",
        message: "Không thể tải ma trận quyền đang được cấp cho vai trò.",
      },
      ok: false,
    };
  }

  const roles: SettingsRole[] = rolesResult.data
    .map((role) => ({
      code: role.code,
      description: role.description,
      id: role.id,
      isActive: role.is_active,
      isSystem: role.is_system,
      name: role.name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));

  const permissions: SettingsPermission[] = permissionsResult.data
    .map((permission) => ({
      code: permission.code,
      description: permission.description,
      id: permission.id,
      isActive: permission.is_active,
      module: permission.module,
      name: permission.name,
    }))
    .sort(
      (left, right) =>
        left.module.localeCompare(right.module, "vi") ||
        left.code.localeCompare(right.code, "vi"),
    );

  return {
    data: {
      grants: grantsResult.data.map((grant) => ({
        permissionId: grant.permission_id,
        roleId: grant.role_id,
      })),
      permissions,
      roles,
    },
    ok: true,
  };
}

export async function getCurrentOwnerStatus(): Promise<SettingsOwnerStatusResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("is_active_owner");

  if (error) {
    return {
      error: "Không thể xác minh quyền Owner hiện tại.",
      ok: false,
    };
  }

  return { isOwner: data === true, ok: true };
}

export async function getSettingsAccountInvitations(): Promise<SettingsInvitationDataResult> {
  const supabase = await createSupabaseServerClient();
  const [invitationsResult, invitationRolesResult] = await Promise.all([
    supabase
      .from("account_invitations")
      .select(
        "id, email, status, invited_at, invitation_reason, accepted_at, revoked_at",
      )
      .order("invited_at", { ascending: false })
      .limit(100),
    supabase
      .from("account_invitation_roles")
      .select("invitation_id, role_id"),
  ]);

  if (invitationsResult.error) {
    return {
      error: {
        code: "account_invitations_query_failed",
        message: "Không thể tải danh sách tài khoản đang chờ.",
      },
      ok: false,
    };
  }

  if (invitationRolesResult.error) {
    return {
      error: {
        code: "account_invitation_roles_query_failed",
        message: "Không thể tải vai trò của các lời mời tài khoản.",
      },
      ok: false,
    };
  }

  const roleIdsByInvitationId = new Map<string, string[]>();

  for (const invitationRole of invitationRolesResult.data) {
    const roleIds =
      roleIdsByInvitationId.get(invitationRole.invitation_id) ?? [];
    roleIds.push(invitationRole.role_id);
    roleIdsByInvitationId.set(invitationRole.invitation_id, roleIds);
  }

  const invitations: SettingsAccountInvitation[] = invitationsResult.data.map(
    (invitation) => ({
      acceptedAt: invitation.accepted_at,
      email: invitation.email,
      id: invitation.id,
      invitedAt: invitation.invited_at,
      invitationReason: invitation.invitation_reason,
      revokedAt: invitation.revoked_at,
      roleIds: roleIdsByInvitationId.get(invitation.id) ?? [],
      status: invitation.status,
    }),
  );

  return { invitations, ok: true };
}
