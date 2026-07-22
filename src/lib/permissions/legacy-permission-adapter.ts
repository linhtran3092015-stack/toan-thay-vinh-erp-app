import type { PermissionCode as DatabasePermissionCode } from "@/lib/permissions/types";
import type { PermissionCode as LegacyPermissionCode } from "@/types/domain";

const databaseToLegacyPermission: Partial<
  Record<DatabasePermissionCode, LegacyPermissionCode>
> = {
  "audit.view": "audit.view",
  "coaching.view": "coaching.view",
  "session_ledger.view": "session_ledger.view",
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
