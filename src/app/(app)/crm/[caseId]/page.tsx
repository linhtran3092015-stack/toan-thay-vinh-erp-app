import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { CrmDetailView } from "@/features/crm/components/crm-detail-view";
import { getCrmCaseDetail, getSaleOwners } from "@/features/crm/data";
import {
  getCrmDirectoryHref,
  getCrmOwnedSearchParamValues,
  type CrmRouteSearchParams,
} from "@/features/crm/crm-directory-url-state";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface CrmCaseDetailPageProps {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<CrmRouteSearchParams>;
}

export default async function CrmCaseDetailPage({ params, searchParams }: CrmCaseDetailPageProps) {
  const { caseId } = await params;
  const returnParams = getCrmOwnedSearchParamValues(await searchParams);
  const directoryHref = getCrmDirectoryHref(new URLSearchParams(returnParams));
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
        title="Không có quyền xem chi tiết CRM case"
      />
    );
  }

  const canUpdate = permissionResult.permissions.includes("crm.update");
  const canTransfer = permissionResult.permissions.includes("crm.transfer");
  const canConfirmOfficial = permissionResult.permissions.includes("students.confirm_official");
  const hasAccountantPermission = permissionResult.permissions.includes("sepay.accountant_confirm");

  const [detail, saleOwners] = await Promise.all([
    getCrmCaseDetail(caseId),
    getSaleOwners(),
  ]);

  if (!detail) {
    return (
      <EmptyState
        description="Hồ sơ Lead không tồn tại hoặc đã bị xóa."
        title="Không tìm thấy CRM case"
      />
    );
  }

  // Fetch active classes for official conversion dropdown
  const supabase = await createSupabaseServerClient();
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, code")
    .eq("status", "active")
    .order("name");

  const activeClasses = (classRows ?? []).map((c) => ({
    code: c.code,
    id: c.id,
    name: c.name,
  }));

  return (
    <CrmDetailView
      activeClasses={activeClasses}
      canConfirmOfficial={canConfirmOfficial}
      canTransfer={canTransfer}
      canUpdate={canUpdate}
      detail={detail}
      directoryHref={directoryHref}
      hasAccountantPermission={hasAccountantPermission}
      saleOwners={saleOwners}
      todayIso={getVietnamToday()}
    />
  );
}
