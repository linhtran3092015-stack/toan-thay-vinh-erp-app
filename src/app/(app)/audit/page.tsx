import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { AuditLogPage } from "@/features/audit/audit-log-page";
import { getAuditLogsResult } from "@/features/audit/data";
import type { AuditFilters } from "@/features/audit/read-models";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
type SearchValue = string | string[] | undefined;

interface AuditRouteProps {
  searchParams: Promise<Record<string, SearchValue>>;
}

function getSearchValue(value: SearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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
      "audit.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("audit.view")}
        title="Không có quyền xem nhật ký hệ thống"
      />
    );
  }

  const rawSearchParams = await searchParams;

  const filters: Partial<AuditFilters> = {
    action: getSearchValue(rawSearchParams.action),
    actorId: getSearchValue(rawSearchParams.actorId),
    entityId: getSearchValue(rawSearchParams.entityId),
    entityType: getSearchValue(rawSearchParams.entityType),
    fromDate: getSearchValue(rawSearchParams.fromDate),
    module: getSearchValue(rawSearchParams.module),
    toDate: getSearchValue(rawSearchParams.toDate),
  };

  const auditResult = await getAuditLogsResult(filters);

  if (!auditResult.ok) {
    return (
      <ErrorState
        description="Không tải được dữ liệu audit_logs từ hệ thống."
        title="Không tải được nhật ký hệ thống"
      />
    );
  }

  return <AuditLogPage model={auditResult.data} />;
}
