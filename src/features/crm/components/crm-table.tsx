import type { ReactNode } from "react";
import Link from "next/link";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import { CrmStatusBadge } from "@/features/crm/components/crm-status-badge";
import type { CrmLeadItemReadModel } from "@/features/crm/read-models";

interface CrmTableProps {
  directoryQuery: string;
  items: CrmLeadItemReadModel[];
}

/** CRM owns its server-filtered rows; this component only frames their operational presentation. */
export function CrmTable({ directoryQuery, items }: CrmTableProps) {
  if (items.length === 0) {
    return <EmptyState description="Không tìm thấy lead phù hợp với bộ lọc hiện tại." title="Không có hồ sơ CRM phù hợp" />;
  }

  return (
    <div className="crm-directory-results">
      <DataTableFrame
        body={items.map((item) => <CrmTableRow directoryQuery={directoryQuery} item={item} key={item.id} />)}
        caption="Danh sách hồ sơ CRM và tuyển sinh"
        className="crm-directory-table"
        header={<tr><TableHeader>Lead</TableHeader><TableHeader>Phụ huynh</TableHeader><TableHeader>Khối · mức · hình thức dự kiến</TableHeader><TableHeader>Nguồn</TableHeader><TableHeader>Sale phụ trách</TableHeader><TableHeader>Trạng thái CRM</TableHeader><TableHeader className="text-right">Thao tác</TableHeader></tr>}
        tableClassName="min-w-[1200px] table-fixed text-table-body text-text-default"
      />
      <ResponsiveRecordList className="crm-directory-record-list" label="Danh sách hồ sơ CRM và tuyển sinh">
        {items.map((item) => <CrmRecord directoryQuery={directoryQuery} item={item} key={item.id} />)}
      </ResponsiveRecordList>
    </div>
  );
}

function CrmTableRow({ directoryQuery, item }: { directoryQuery: string; item: CrmLeadItemReadModel }) {
  const href = crmCaseHref(item.id, directoryQuery);
  return (
    <tr className="transition-colors hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[210px]"><Link className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={href}>{item.fullName}</Link><p className="mt-0.5 tabular-nums text-caption text-text-muted">{item.publicCode} · {item.birthYear}</p></TableCell>
      <TableCell className="w-[190px]"><p className="font-medium text-text-default">{item.guardianFullName}</p><p className="mt-0.5 tabular-nums text-caption text-text-muted">{item.guardianPhone}</p></TableCell>
      <TableCell className="w-[210px] text-secondary text-text-muted">Khối {item.expectedGrade} · {item.expectedLevel ?? "Chưa xác định"} · {formatMode(item.expectedMode)}</TableCell>
      <TableCell className="w-[145px] text-secondary text-text-muted">{item.leadSourceName}</TableCell>
      <TableCell className="w-[150px] text-secondary text-text-default">{item.saleOwnerName ?? "Chưa phân công"}</TableCell>
      <TableCell className="w-[165px]"><CrmStatusBadge status={item.status} /></TableCell>
      <TableCell className="w-[130px] text-right"><Link aria-label={`Mở hồ sơ CRM ${item.fullName}`} className="inline-flex h-8 items-center justify-center rounded-md px-2 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={href}>Mở hồ sơ</Link></TableCell>
    </tr>
  );
}

function CrmRecord({ directoryQuery, item }: { directoryQuery: string; item: CrmLeadItemReadModel }) {
  const href = crmCaseHref(item.id, directoryQuery);
  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" role="listitem">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link className="block text-body font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={href}>{item.fullName}</Link><p className="mt-0.5 tabular-nums text-caption text-text-muted">{item.publicCode} · {item.birthYear}</p></div><CrmStatusBadge status={item.status} /></div>
      <div className="mt-3 grid gap-1.5 text-secondary text-text-muted"><p><span className="font-medium text-text-default">Phụ huynh:</span> {item.guardianFullName} · {item.guardianPhone}</p><p>Khối {item.expectedGrade} · {item.expectedLevel ?? "Chưa xác định"} · {formatMode(item.expectedMode)}</p><p>Nguồn: {item.leadSourceName} · Sale: {item.saleOwnerName ?? "Chưa phân công"}</p></div>
      <Link aria-label={`Mở hồ sơ CRM ${item.fullName}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-subtle px-4 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={href}>Mở hồ sơ CRM</Link>
    </article>
  );
}

function TableHeader({ children, className }: { children: ReactNode; className?: string }) { return <th className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className ?? ""}`} scope="col">{children}</th>; }
function TableCell({ children, className }: { children: ReactNode; className?: string }) { return <td className={`h-14 px-3 align-middle text-table-body ${className ?? ""}`}>{children}</td>; }
function crmCaseHref(id: string, query: string) { return query ? `/crm/${id}?${query}` : `/crm/${id}`; }
function formatMode(mode: string | null) { return mode === "online" ? "Online" : mode === "offline" ? "Offline" : mode === "hybrid" ? "Kết hợp" : "Chưa xác định"; }
