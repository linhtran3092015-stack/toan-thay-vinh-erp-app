import "server-only";

import { cache } from "react";
import { z } from "zod";

import {
  DATABASE_PERMISSION_CODES,
  type DatabasePermissionCheckResult,
  type DatabasePermissionError,
  type DatabasePermissionsResult,
  type PermissionCode,
} from "@/lib/permissions/types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const permissionRowsSchema = z.array(
  z.object({
    permission_code: z.string(),
  }),
);

const knownPermissionCodes = new Set<string>(DATABASE_PERMISSION_CODES);

function createPermissionError(
  code: DatabasePermissionError["code"],
): DatabasePermissionError {
  const messages: Record<DatabasePermissionError["code"], string> = {
    configuration_missing: "Supabase permission configuration is unavailable.",
    invalid_response: "Database permission response is invalid.",
    not_authenticated: "An authenticated user is required.",
    query_failed: "Database permissions could not be loaded.",
  };

  return { code, message: messages[code] };
}

function isPermissionCode(value: string): value is PermissionCode {
  return knownPermissionCodes.has(value);
}

export async function getDatabasePermissions(): Promise<DatabasePermissionsResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: createPermissionError("configuration_missing"),
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return {
        ok: false,
        error: createPermissionError("not_authenticated"),
      };
    }

    const { data, error } = await supabase.rpc("get_my_permissions");

    if (error) {
      return {
        ok: false,
        error: createPermissionError("query_failed"),
      };
    }

    const parsedRows = permissionRowsSchema.safeParse(data ?? []);

    if (!parsedRows.success) {
      return {
        ok: false,
        error: createPermissionError("invalid_response"),
      };
    }

    const permissions = parsedRows.data.map((row) => row.permission_code);

    if (!permissions.every(isPermissionCode)) {
      return {
        ok: false,
        error: createPermissionError("invalid_response"),
      };
    }

    return {
      ok: true,
      permissions: [...new Set(permissions)],
    };
  } catch {
    return {
      ok: false,
      error: createPermissionError("query_failed"),
    };
  }
}


export const getCachedDatabasePermissions = cache(getDatabasePermissions);

export async function hasDatabasePermission(
  requiredPermission: PermissionCode,
): Promise<DatabasePermissionCheckResult> {
  const result = await getDatabasePermissions();

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    allowed: result.permissions.includes(requiredPermission),
  };
}
