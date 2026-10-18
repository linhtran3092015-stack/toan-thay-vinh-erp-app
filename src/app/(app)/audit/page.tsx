import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { AuditLogPage } from "@/features/audit/audit-log-page";
import {
  AUDIT_LOG_ACCESS,
  parseAuditFilters,
  type AuditSearchValue,
} from "@/features/audit/audit-log-models";
import { getAuditLogsResult } from "@/features/audit/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

interface AuditRouteProps {
  searchParams: Promise<Record<string, AuditSearchValue>>;
}

export default async function AuditRoute({
  searchParams,
}: AuditRouteProps) {
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập nhật ký."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      AUDIT_LOG_ACCESS.permission,
    )
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription(AUDIT_LOG_ACCESS.permission)}
        title={AUDIT_LOG_ACCESS.deniedTitle}
      />
    );
  }

  const auditResult = await getAuditLogsResult(
    parseAuditFilters(await searchParams),
  );

  if (!auditResult.ok) {
    return (
      <ErrorState
        description="Không tải được dữ liệu nhật ký từ hệ thống."
        title="Không tải được nhật ký hệ thống"
      />
    );
  }

  return <AuditLogPage model={auditResult.data} />;
}
