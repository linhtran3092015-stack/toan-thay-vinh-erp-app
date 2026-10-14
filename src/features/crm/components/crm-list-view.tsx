import Link from "next/link";

import { TableState } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { getButtonClassName } from "@/components/ui/button";
import { CrmFilters } from "@/features/crm/components/crm-filters";
import { CrmTable } from "@/features/crm/components/crm-table";
import type { CrmDirectoryResult } from "@/features/crm/data";
import type {
  CrmDirectoryOverview,
  CrmStatusCounts,
  LeadSourceOption,
  SaleOwnerOption,
} from "@/features/crm/read-models";

export interface CrmListViewProps {
  canCreateLead: boolean;
  createHref: string;
  directory: CrmDirectoryResult;
  /** Safe CRM-owned query (filters) carried into detail links. */
  directoryQuery: string;
  leadSources: LeadSourceOption[];
  overview: CrmDirectoryOverview | null;
  saleOwners: SaleOwnerOption[];
  statusCounts: CrmStatusCounts | null;
  todayIso: string;
}

/**
 * Lead list (design 12a) from loader data: header with this month's context,
 * filters + status chips, and the lead table. Shared by `/crm` and `/dev/crm`.
 */
export function CrmListView({
  canCreateLead,
  createHref,
  directory,
  directoryQuery,
  leadSources,
  overview,
  saleOwners,
  statusCounts,
  todayIso,
}: CrmListViewProps) {
  const contextParts = overview
    ? [
        `Tháng ${overview.monthLabel}`,
        overview.newLeadsThisMonth === null ? null : `${overview.newLeadsThisMonth} lead mới`,
        overview.pendingConfirmation === null ? null : `${overview.pendingConfirmation} chờ xác nhận nhập học`,
      ].filter(Boolean)
    : [];
  const isFiltered = directoryQuery.length > 0;
  const emptyTitle = isFiltered ? "Không có lead phù hợp" : "Chưa có lead nào";

  return (
    <div className="crm-directory grid min-w-0 gap-4">
      <PageHeader
        actions={canCreateLead ? (
          <Link className={getButtonClassName({ variant: "primary" })} href={createHref}>Thêm lead</Link>
        ) : undefined}
        title="Lead tuyển sinh"
      >
        {contextParts.length > 1 ? (
          <p className="mt-1 text-secondary tabular-nums text-text-muted">{contextParts.join(" · ")}</p>
        ) : null}
      </PageHeader>
      <CrmFilters
        leadSources={leadSources}
        resultCount={directory.failed ? undefined : directory.totalCount}
        saleOwners={saleOwners}
        statusCounts={statusCounts}
      />
      <CrmTable
        directoryQuery={directoryQuery}
        empty={
          <TableState>
            <p className="text-body font-semibold text-text-strong">{emptyTitle}</p>
            <p className="text-secondary text-text-muted">
              {isFiltered
                ? "Không tìm thấy lead phù hợp với bộ lọc hiện tại. Bỏ bớt bộ lọc để xem thêm."
                : canCreateLead ? "Lead mới từ nút “Thêm lead” sẽ hiện ở đây." : "Lead mới sẽ hiện ở đây khi được tạo."}
            </p>
          </TableState>
        }
        emptyTitle={emptyTitle}
        items={directory.items}
        status={directory.failed ? "error" : directory.items.length === 0 ? "empty" : "ready"}
        todayIso={todayIso}
        totalCount={directory.totalCount}
      />
    </div>
  );
}
