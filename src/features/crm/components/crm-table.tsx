import type { ReactNode } from "react";
import Link from "next/link";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { CrmStatusBadge } from "@/features/crm/components/crm-status-badge";
import { CRM_UNASSIGNED_SALE_LABEL, crmStatusLabels, formatCrmDate, formatCrmMode, getCrmStatusSuffix } from "@/features/crm/crm-presentation";
import type { CrmLeadItemReadModel } from "@/features/crm/read-models";
import { getVietnamToday } from "@/lib/datetime";

export type CrmTableStatus = "ready" | "empty" | "error";

interface CrmTableProps {
  directoryQuery: string;
  items: CrmLeadItemReadModel[];
  /** Leads matching the filters; the directory shows at most 100 of them. */
  totalCount?: number;
  /** `YYYY-MM-DD` (Vietnam) for "· N ngày" suffixes; defaults to today. */
  todayIso?: string;
  /** Defaults to `empty` without rows. `error` = the directory query failed. */
  status?: CrmTableStatus;
  empty?: ReactNode;
  /** Title of the `empty` slot, announced by the live region; defaults to the built-in empty title. */
  emptyTitle?: string;
  error?: ReactNode;
}

const LABEL = "Danh sách hồ sơ CRM và tuyển sinh";
const DEFAULT_EMPTY_TITLE = "Không có hồ sơ CRM phù hợp";
const ERROR_TITLE = "Không tải được danh sách lead";

/** CRM owns its server-filtered rows; this component only frames their operational presentation. */
export function CrmTable({
  directoryQuery,
  empty,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  error,
  items,
  status,
  todayIso = getVietnamToday(),
  totalCount = items.length,
}: CrmTableProps) {
  const resolvedStatus: CrmTableStatus = status ?? (items.length === 0 ? "empty" : "ready");
  const emptySlot = empty ?? (
    <TableState>
      <p className="text-body font-semibold text-text-strong">{DEFAULT_EMPTY_TITLE}</p>
      <p className="text-secondary text-text-muted">Không tìm thấy lead phù hợp với bộ lọc hiện tại.</p>
    </TableState>
  );
  const errorSlot = error ?? (
    <TableState>
      <p className="text-body font-semibold text-danger">{ERROR_TITLE}</p>
      <p className="text-secondary text-text-muted">Tải lại trang hoặc xóa bộ lọc để thử lại.</p>
    </TableState>
  );
  const summary = resolvedStatus === "ready" ? <CrmResultSummary shown={items.length} total={totalCount} /> : null;
  const announcement = resolvedStatus === "ready"
    ? `Hiển thị ${items.length} / ${totalCount} lead`
    : resolvedStatus === "error" ? ERROR_TITLE : emptyTitle;

  return (
    <div className="crm-directory-results grid gap-2">
      {/* One always-mounted live region, outside the table and record list
          (one of them is display:none at any width), so a filter change is
          announced once in every state; the visible error title is not an
          alert of its own. */}
      <p aria-live="polite" className="sr-only">{announcement}</p>
      <DataTableFrame
        body={items.map((item) => <CrmTableRow directoryQuery={directoryQuery} item={item} key={item.id} todayIso={todayIso} />)}
        caption={LABEL}
        className="crm-directory-table"
        empty={emptySlot}
        error={errorSlot}
        footer={summary}
        header={
          <tr>
            <TableHeaderCell>Lead</TableHeaderCell>
            <TableHeaderCell className="w-[160px]">Phụ huynh</TableHeaderCell>
            <TableHeaderCell className="w-[140px]">Dự kiến</TableHeaderCell>
            <TableHeaderCell className="w-[120px]">Nguồn</TableHeaderCell>
            <TableHeaderCell className="w-[140px]">Sale</TableHeaderCell>
            <TableHeaderCell className="w-[176px]">Trạng thái</TableHeaderCell>
            <TableHeaderCell className="w-[104px]">Tạo</TableHeaderCell>
            <TableHeaderCell className="w-[56px]"><span className="sr-only">Thao tác</span></TableHeaderCell>
          </tr>
        }
        status={resolvedStatus}
        tableClassName="min-w-[1030px]"
      />
      <div className="crm-directory-record-list grid gap-2">
        {resolvedStatus === "ready" ? (
          <>
            <ResponsiveRecordList label={LABEL}>
              {items.map((item) => <CrmRecord directoryQuery={directoryQuery} item={item} key={item.id} todayIso={todayIso} />)}
            </ResponsiveRecordList>
            <div className="px-1 text-secondary text-text-muted">{summary}</div>
          </>
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface-base">
            {resolvedStatus === "error" ? errorSlot : emptySlot}
          </div>
        )}
      </div>
    </div>
  );
}

function CrmResultSummary({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="tabular-nums">
      Hiển thị {shown} / {total} lead
      {total > shown ? ` · chỉ hiện ${shown} lead mới nhất, lọc thêm để thu hẹp` : ""}
    </p>
  );
}

function CrmTableRow({ directoryQuery, item, todayIso }: { directoryQuery: string; item: CrmLeadItemReadModel; todayIso: string }) {
  const href = crmCaseHref(item.id, directoryQuery);
  const suffix = getCrmStatusSuffix(item, todayIso);

  return (
    <TableRow tall>
      <TableCell>
        <Link
          className="block font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href={href}
        >
          {item.fullName}
        </Link>
        <span className="block text-caption tabular-nums text-text-muted">
          {item.publicCode} · sinh {item.birthYear}
          {item.status === "converted" && item.studentId ? (
            <>
              {" · "}
              <Link
                className="font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                href={`/students/${item.studentId}`}
              >
                Hồ sơ học viên
              </Link>
            </>
          ) : null}
        </span>
      </TableCell>
      <TableCell>
        <span className="block truncate text-text-default" title={item.guardianFullName}>{item.guardianFullName}</span>
        <span className="block text-caption tabular-nums text-text-muted">{item.guardianPhone}</span>
      </TableCell>
      <TableCell className="text-secondary text-text-default">{formatExpected(item)}</TableCell>
      <TableCell className="text-secondary text-text-default">{item.leadSourceName}</TableCell>
      <TableCell>{item.saleOwnerId ? <span className="text-text-default">{item.saleOwnerName}</span> : <Badge tone="warning">{CRM_UNASSIGNED_SALE_LABEL}</Badge>}</TableCell>
      <TableCell>
        <CrmStatusBadge {...getBadgeFit(item, "max-w-[152px]")} status={item.status} suffix={suffix} title={getDropTitle(item)} />
      </TableCell>
      <TableCell className="tabular-nums text-text-muted">{formatCrmDate(item.createdAt)}</TableCell>
      <TableCell className="text-right">
        <Link
          aria-label={`Mở hồ sơ CRM ${item.fullName}`}
          className="inline-flex h-8 items-center rounded-md px-2 text-secondary font-semibold text-action-link! hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href={href}
        >
          Mở
        </Link>
      </TableCell>
    </TableRow>
  );
}

function CrmRecord({ directoryQuery, item, todayIso }: { directoryQuery: string; item: CrmLeadItemReadModel; todayIso: string }) {
  return (
    <RecordListItem
      ariaLabel={`Mở hồ sơ CRM ${item.fullName}`}
      badge={<CrmStatusBadge {...getBadgeFit(item, "max-w-[160px]")} status={item.status} suffix={getCrmStatusSuffix(item, todayIso)} title={getDropTitle(item)} />}
      href={crmCaseHref(item.id, directoryQuery)}
      meta={`${item.publicCode} · sinh ${item.birthYear} · ${item.guardianFullName} · ${item.guardianPhone}`}
      metrics={
        <>
          <span>{formatExpected(item)}</span>
          <span>Nguồn: {item.leadSourceName}</span>
          <span>Sale: {item.saleOwnerId ? item.saleOwnerName : <span className="font-medium text-warning">{CRM_UNASSIGNED_SALE_LABEL}</span>}</span>
        </>
      }
      title={item.fullName}
    />
  );
}

/**
 * Only a stop reason is open-ended, so only a dropped badge is capped and
 * truncates (full text in its title); "Đang quan tâm · 14 ngày" and the other
 * fixed suffixes always show in full. In the table, 152px = the 176px status
 * column minus its cell padding.
 */
function getBadgeFit(item: Pick<CrmLeadItemReadModel, "status">, maxWidthClassName: string) {
  return item.status === "dropped" ? { className: maxWidthClassName, truncate: true } : {};
}

/** Full "Đã dừng · reason" for the badge tooltip; the visible suffix is shortened. */
function getDropTitle(item: Pick<CrmLeadItemReadModel, "dropReason" | "status">): string | undefined {
  const reason = item.dropReason?.trim();
  return item.status === "dropped" && reason ? `${crmStatusLabels.dropped} · ${reason}` : undefined;
}

function formatExpected(item: Pick<CrmLeadItemReadModel, "expectedGrade" | "expectedLevel" | "expectedMode">): string {
  return [`Khối ${item.expectedGrade}`, item.expectedLevel, item.expectedMode ? formatCrmMode(item.expectedMode) : null]
    .filter(Boolean)
    .join(" · ");
}

function crmCaseHref(id: string, query: string) {
  return query ? `/crm/${id}?${query}` : `/crm/${id}`;
}
