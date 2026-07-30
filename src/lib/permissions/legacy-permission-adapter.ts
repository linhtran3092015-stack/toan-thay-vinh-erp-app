import type { PermissionCode as DatabasePermissionCode } from "@/lib/permissions/types";
import type { PermissionCode as LegacyPermissionCode } from "@/types/domain";

const databaseToLegacyPermission: Partial<
  Record<DatabasePermissionCode, LegacyPermissionCode>
> = {
  "attendance.mark": "attendance.mark",
  "attendance.view": "attendance.view",
  "audit.view": "audit.view",
  "coaching.view": "coaching.view",
  "payments.create_request": "payments.create_request",
  "payments.view": "payments.view",
  "results.manage": "results.manage",
  "results.view": "results.view",
  "session_ledger.view": "session_ledger.view",
  "sessions.lock": "sessions.lock",
  "sessions.manage": "sessions.manage",
  "sessions.view": "sessions.view",
  "staff.view": "staff.view",
  "students.create": "students.create",
  "students.update": "students.update",
  "students.view": "students.view",
};

export function toLegacyPermissions(
  permissions: readonly DatabasePermissionCode[],
): LegacyPermissionCode[] {
  return permissions.flatMap((permission) => {
    const legacyPermission = databaseToLegacyPermission[permission];

    return legacyPermission ? [legacyPermission] : [];
  });
}
