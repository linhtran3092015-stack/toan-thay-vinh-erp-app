export const DATABASE_PERMISSION_CODES = [
  "app.access",
  "students.view",
  "students.create",
  "students.update",
  "students.manage_status",
  "coaching.view",
  "session_ledger.view",
  "audit.view",
  "staff.view",
  "staff.roles.view",
  "staff.roles.manage",
] as const;

export type PermissionCode = (typeof DATABASE_PERMISSION_CODES)[number];

export type DatabasePermissionErrorCode =
  | "configuration_missing"
  | "invalid_response"
  | "not_authenticated"
  | "query_failed";

export interface DatabasePermissionError {
  code: DatabasePermissionErrorCode;
  message: string;
}

export type DatabasePermissionsResult =
  | {
      ok: true;
      permissions: readonly PermissionCode[];
    }
  | {
      ok: false;
      error: DatabasePermissionError;
    };

export type DatabasePermissionCheckResult =
  | {
      ok: true;
      allowed: boolean;
    }
  | {
      ok: false;
      error: DatabasePermissionError;
    };
