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
    console.error("[permissions] configuration_missing: Supabase env vars not set.");
    return {
      ok: false,
      error: createPermissionError("configuration_missing"),
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    // Both calls carry the same session, so they go out together: one round trip instead of two.
    // The permission rows are only used once getUser() has verified that session.
    const [{ data: userData, error: userError }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("get_my_permissions"),
    ]);

    if (userError || !userData.user) {
      // not_authenticated is normal for unauthenticated visitors — log only real errors.
      if (userError) {
        console.error("[permissions] not_authenticated — getUser failed:", userError.message, userError.status);
      }
      return {
        ok: false,
        error: createPermissionError("not_authenticated"),
      };
    }

    if (error) {
      console.error("[permissions] query_failed — get_my_permissions RPC error:", error.message, error.code, error.details);
      return {
        ok: false,
        error: createPermissionError("query_failed"),
      };
    }

    const parsedRows = permissionRowsSchema.safeParse(data ?? []);

    if (!parsedRows.success) {
      console.error("[permissions] invalid_response — schema parse failed:", parsedRows.error.message);
      return {
        ok: false,
        error: createPermissionError("invalid_response"),
      };
    }

    const permissions = parsedRows.data.map((row) => row.permission_code);

    if (!permissions.every(isPermissionCode)) {
      const unknown = permissions.filter((p) => !isPermissionCode(p));
      console.error("[permissions] invalid_response — unknown permission codes:", unknown);
      return {
        ok: false,
        error: createPermissionError("invalid_response"),
      };
    }

    return {
      ok: true,
      permissions: [...new Set(permissions)],
    };
  } catch (err) {
    console.error("[permissions] query_failed — unexpected exception:", err);
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
