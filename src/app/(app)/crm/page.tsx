import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { CrmListView } from "@/features/crm/components/crm-list-view";
import {
  getCrmDirectoryOverview,
  getCrmLeadDirectory,
  getCrmStatusCounts,
  getLeadSources,
  getSaleOwners,
} from "@/features/crm/data";
import {
  getCrmDirectoryGrade,
  getCrmDirectoryQuery,
  getCrmDirectoryStatus,
  getCrmOwnedSearchParamValues,
  type CrmRouteSearchParams,
} from "@/features/crm/crm-directory-url-state";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface CrmDirectoryPageProps {
  searchParams: Promise<CrmRouteSearchParams>;
}

export default async function CrmDirectoryPage({ searchParams }: CrmDirectoryPageProps) {
  const params = getCrmOwnedSearchParamValues(await searchParams);
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập CRM."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("crm.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("crm.view")}
        title="Không có quyền xem danh sách CRM"
      />
    );
  }

  const canCreateLead = permissionResult.permissions.includes("crm.update");
  const filters = {
    expectedGrade: getCrmDirectoryGrade(params.grade),
    leadSourceCode: params.source ?? null,
    saleOwnerId: params.sale ?? null,
    search: params.search ?? null,
  };

  const [directoryResult, statusCounts, overview, leadSources, saleOwners] = await Promise.all([
    getCrmLeadDirectory({ ...filters, status: getCrmDirectoryStatus(params.status) }),
    getCrmStatusCounts(filters),
    getCrmDirectoryOverview(),
    getLeadSources(),
    getSaleOwners(),
  ]);
  const directoryQuery = getCrmDirectoryQuery(new URLSearchParams(params));
  const createHref = directoryQuery ? `/crm/new?${directoryQuery}` : "/crm/new";

  return (
    <CrmListView
      canCreateLead={canCreateLead}
      createHref={createHref}
      directory={directoryResult}
      directoryQuery={directoryQuery}
      leadSources={leadSources}
      overview={overview}
      saleOwners={saleOwners}
      statusCounts={statusCounts}
      todayIso={getVietnamToday()}
    />
  );
}
