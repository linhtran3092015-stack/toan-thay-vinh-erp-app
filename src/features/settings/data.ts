import "server-only";

import type {
  SettingsDataResult,
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
