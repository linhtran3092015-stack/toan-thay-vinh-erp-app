import Link from "next/link";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { Button } from "@/components/ui/button";
import { CrmFilters } from "@/features/crm/components/crm-filters";
import { CrmTable } from "@/features/crm/components/crm-table";
import { getCrmLeadDirectory, getLeadSources, getSaleOwners } from "@/features/crm/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

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
        description="Tài khoản hiện tại không có quyền crm.view."
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

  return (
    <div className="grid min-w-0 gap-4">
      {/* Header */}
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink md:text-3xl">CRM & Tuyển sinh</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Quản lý danh sách Lead, Phân công Sale, Đặt lịch học thử & Chuyển đổi thành Học viên Chính thức.
            </p>
          </div>

          {canCreateLead ? (
            <Link className="inline-flex flex-none" href="/crm/new">
              <Button>+ Thêm Lead mới</Button>
            </Link>
          ) : null}
        </div>
      </section>

      {/* Filters Toolbar */}
      <CrmFilters leadSources={leadSources} saleOwners={saleOwners} />

      {/* Summary stats */}
      <div className="flex items-center justify-between text-xs text-ink-muted px-1">
        <span>Hiển thị {directoryResult.items.length} / {directoryResult.totalCount} lead</span>
      </div>

      {/* Lead Directory Table */}
      <CrmTable items={directoryResult.items} />
    </div>
  );
}
