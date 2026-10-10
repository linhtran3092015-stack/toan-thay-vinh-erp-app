import "server-only";

import { staffPayrollProfileSchema } from "@/features/staff/payroll-profile-types";
import type {
  StaffDetailError,
  StaffDetailErrorCode,
  StaffDetailReadModel,
  StaffDetailResult,
  StaffDirectoryError,
  StaffDirectoryErrorCode,
  StaffDirectoryMember,
  StaffDirectoryResult,
  StaffEmploymentStatus,
  StaffRoleOption,
  StaffRoleSummary,
} from "@/features/staff/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createStaffDirectoryError(
  code: StaffDirectoryErrorCode,
): StaffDirectoryError {
  const messages: Record<StaffDirectoryErrorCode, string> = {
    profiles_query_failed: "Không thể tải danh sách hồ sơ nhân sự.",
    assignments_query_failed: "Không thể tải vai trò đang được cấp.",
    roles_query_failed: "Không thể tải danh mục vai trò.",
  };

  return {
    code,
    message: messages[code],
  };
}

function createStaffDetailError(
  code: StaffDetailErrorCode,
): StaffDetailError {
  const messages: Record<StaffDetailErrorCode, string> = {
    assignments_query_failed: "Không thể tải vai trò đang được cấp.",
    profile_not_found: "Không tìm thấy hồ sơ nhân sự.",
    profiles_query_failed: "Không thể tải hồ sơ nhân sự.",
    payroll_profile_query_failed: "Không thể tải cấu hình lương và thông tin ngân hàng.",
    rate_versions_query_failed: "Không thể tải lịch sử đơn giá nhân sự.",
    roles_query_failed: "Không thể tải danh mục vai trò.",
  };

  return {
    code,
    message: messages[code],
  };
}

function normalizeEmploymentStatus(
  value: string,
): StaffEmploymentStatus {
  if (
    value === "active" ||
    value === "inactive" ||
    value === "suspended"
  ) {
    return value;
  }

  return "unknown";
}

function getDisplayName(
  displayName: string | null,
  email: string,
): string {
  const normalizedName = displayName?.trim();

  return normalizedName || email.split("@")[0] || "Nhân sự trung tâm";
}

export async function getStaffDirectory(options: {
  includeRoles: boolean;
}): Promise<StaffDirectoryResult> {
  const supabase = await createSupabaseServerClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, email, display_name, avatar_url, phone, employee_code, employment_status, joined_at, left_at, last_login_at",
    )
    // Deleted accounts stay in the database for payroll/attendance history
    // but never appear in directories.
    .is("account_deleted_at", null)
    .order("display_name", { ascending: true })
    .order("email", { ascending: true });

  if (profilesError) {
    return {
      ok: false,
      error: createStaffDirectoryError("profiles_query_failed"),
    };
  }

  const rolesByUserId = new Map<string, StaffRoleSummary[]>();
  let roleOptions: StaffRoleOption[] | null = null;

  if (options.includeRoles) {
    const [assignmentsResult, rolesResult] = await Promise.all([
      supabase
        .from("user_role_assignments")
        .select("id, user_id, role_id, assigned_at")
        .is("revoked_at", null),
      supabase
        .from("roles")
        .select("id, code, name, description, is_system, is_active"),
    ]);

    if (assignmentsResult.error) {
      return {
        ok: false,
        error: createStaffDirectoryError("assignments_query_failed"),
      };
    }

    if (rolesResult.error) {
      return {
        ok: false,
        error: createStaffDirectoryError("roles_query_failed"),
      };
    }

    const roleById = new Map(
      rolesResult.data.map((role) => [role.id, role]),
    );

    roleOptions = rolesResult.data
      .filter((role) => role.is_active)
      .map((role) => ({
        code: role.code,
        description: role.description,
        id: role.id,
        isSystem: role.is_system,
        name: role.name,
      }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "vi"),
      );

    for (const assignment of assignmentsResult.data) {
      const role = roleById.get(assignment.role_id);

      if (!role?.is_active) {
        continue;
      }

      const userRoles = rolesByUserId.get(assignment.user_id) ?? [];

      userRoles.push({
        assignedAt: assignment.assigned_at,
        assignmentId: assignment.id,
        code: role.code,
        id: role.id,
        name: role.name,
      });

      rolesByUserId.set(assignment.user_id, userRoles);
    }

    for (const roles of rolesByUserId.values()) {
      roles.sort((left, right) =>
        left.name.localeCompare(right.name, "vi"),
      );
    }
  }

  const members: StaffDirectoryMember[] = profiles
    .map((profile) => ({
      avatarUrl: profile.avatar_url,
      displayName: getDisplayName(
        profile.display_name,
        profile.email,
      ),
      email: profile.email,
      employeeCode: profile.employee_code,
      employmentStatus: normalizeEmploymentStatus(
        profile.employment_status,
      ),
      id: profile.id,
      joinedAt: profile.joined_at,
      lastLoginAt: profile.last_login_at,
      leftAt: profile.left_at,
      phone: profile.phone,
      roles: options.includeRoles
        ? rolesByUserId.get(profile.id) ?? []
        : null,
    }))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "vi"),
    );

  return {
    ok: true,
    members,
    roleOptions,
  };
}

export async function getStaffDetail(
  staffId: string,
  options: {
    includePayrollProfile: boolean;
    includeRateVersions: boolean;
    includeRoles: boolean;
  },
): Promise<StaffDetailResult> {
  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, email, display_name, avatar_url, phone, employee_code, employment_status, joined_at, left_at, last_login_at",
    )
    .eq("id", staffId)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      error: createStaffDetailError("profiles_query_failed"),
    };
  }

  if (!profile) {
    return {
      ok: false,
      error: createStaffDetailError("profile_not_found"),
    };
  }

  let roles: StaffRoleSummary[] | null = null;

  if (options.includeRoles) {
    const [assignmentsResult, rolesResult] = await Promise.all([
      supabase
        .from("user_role_assignments")
        .select("id, user_id, role_id, assigned_at")
        .eq("user_id", staffId)
        .is("revoked_at", null),
      supabase
        .from("roles")
        .select("id, code, name, is_active"),
    ]);

    if (assignmentsResult.error) {
      return {
        ok: false,
        error: createStaffDetailError("assignments_query_failed"),
      };
    }

    if (rolesResult.error) {
      return {
        ok: false,
        error: createStaffDetailError("roles_query_failed"),
      };
    }

    const roleById = new Map(
      rolesResult.data.map((role) => [role.id, role]),
    );

    roles = assignmentsResult.data
      .flatMap((assignment) => {
        const role = roleById.get(assignment.role_id);

        if (!role?.is_active) {
          return [];
        }

        return [
          {
            assignedAt: assignment.assigned_at,
            assignmentId: assignment.id,
            code: role.code,
            id: role.id,
            name: role.name,
          },
        ];
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name, "vi"),
      );
  }

  let rateVersions: StaffDetailReadModel["rateVersions"] = null;

  if (options.includeRateVersions) {
    const { data, error } = await supabase
      .from("staff_rate_versions")
      .select(
        "id, effective_from, offline_hourly_rate_vnd, online_hourly_rate_vnd, note, created_at",
      )
      .eq("staff_id", staffId)
      .order("effective_from", { ascending: false });

    if (error) {
      return {
        ok: false,
        error: createStaffDetailError("rate_versions_query_failed"),
      };
    }

    rateVersions = data.map((rateVersion) => ({
      createdAt: rateVersion.created_at,
      effectiveFrom: rateVersion.effective_from,
      id: rateVersion.id,
      note: rateVersion.note,
      offlineHourlyRateVnd: rateVersion.offline_hourly_rate_vnd,
      onlineHourlyRateVnd:
        rateVersion.online_hourly_rate_vnd ??
        rateVersion.offline_hourly_rate_vnd / 2,
    }));
  }

  let payrollProfile: StaffDetailReadModel["payrollProfile"] = null;

  if (options.includePayrollProfile) {
    const payrollRpcClient = supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
    const { data, error } = await payrollRpcClient.rpc(
      "get_staff_payroll_profile",
      { p_staff_id: staffId },
    );
    const parsed = staffPayrollProfileSchema.safeParse(data);

    if (error || !parsed.success) {
      return {
        ok: false,
        error: createStaffDetailError("payroll_profile_query_failed"),
      };
    }

    payrollProfile = parsed.data;
  }

  return {
    ok: true,
    detail: {
      avatarUrl: profile.avatar_url,
      displayName: getDisplayName(profile.display_name, profile.email),
      email: profile.email,
      employeeCode: profile.employee_code,
      employmentStatus: normalizeEmploymentStatus(profile.employment_status),
      id: profile.id,
      joinedAt: profile.joined_at,
      lastLoginAt: profile.last_login_at,
      leftAt: profile.left_at,
      phone: profile.phone,
      payrollProfile,
      profileDisplayName: profile.display_name,
      rateVersions,
      roles,
    },
  };
}
