import Link from "next/link";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { CrmFilters } from "@/features/crm/components/crm-filters";
import { CrmTable } from "@/features/crm/components/crm-table";
import { getCrmLeadDirectory, getLeadSources, getSaleOwners } from "@/features/crm/data";
import { getCrmDirectoryQuery } from "@/features/crm/crm-directory-url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface CrmDirectoryPageProps {
  searchParams: Promise<{
    grade?: string;
    sale?: string;
    search?: string;
    source?: string;
    status?: string;
  }>;
}

export default async function CrmDirectoryPage({ searchParams }: CrmDirectoryPageProps) {
  const params = await searchParams;
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

  const [directoryResult, leadSources, saleOwners] = await Promise.all([
    getCrmLeadDirectory({
      expectedGrade: params.grade ? Number(params.grade) : null,
      leadSourceCode: params.source ?? null,
      saleOwnerId: params.sale ?? null,
      search: params.search ?? null,
      status: params.status ?? null,
    }),
    getLeadSources(),
    getSaleOwners(),
  ]);
  const directoryQuery = getCrmDirectoryQuery(new URLSearchParams(params));
  const createHref = directoryQuery ? `/crm/new?${directoryQuery}` : "/crm/new";

  return (
    <div className="crm-directory grid min-w-0 gap-6">
      <PageHeader
        actions={canCreateLead ? <Link className="inline-flex" href={createHref}><Button>Thêm Lead mới</Button></Link> : undefined}
        context={<span className="text-secondary text-text-muted">{directoryResult.items.length}/{directoryResult.totalCount} kết quả</span>}
        title="CRM & Tuyển sinh"
      >
        <p className="mt-1 text-secondary text-text-muted">Quản lý lead, phân công sale, học thử và chuyển đổi học viên chính thức.</p>
      </PageHeader>
      <CrmFilters leadSources={leadSources} saleOwners={saleOwners} />
      <div aria-live="polite" className="text-secondary text-text-muted">Hiển thị {directoryResult.items.length} / {directoryResult.totalCount} lead</div>
      <CrmTable directoryQuery={directoryQuery} items={directoryResult.items} />
    </div>
  );
}
