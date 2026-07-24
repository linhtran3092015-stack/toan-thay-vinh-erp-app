export const DATABASE_PERMISSION_CODES = [
  "app.access",
  "classes.view",
  "classes.create",
  "classes.manage_schedule",
  "guardians.view",
  "students.view",
  "students.create",
  "students.update",
  "students.manage_status",
  "students.reserve",
  "students.transfer_class",
  "coaching.view",
  "sessions.view",
  "sessions.manage",
  "sessions.lock",
  "attendance.view",
  "attendance.mark",
  "results.view",
  "results.manage",
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
