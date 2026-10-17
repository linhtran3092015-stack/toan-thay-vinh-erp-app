"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { FilterBar, FilterField, FilterSelect } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Pagination } from "@/components/patterns/pagination";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SalesCommissionAccrualDashboardEntry } from "@/features/commissions/read-models";
import { formatDateTime, formatIsoDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";

import {
  ALL_OPTION,
  COMMISSIONS_DEFAULT_LIMIT,
  allCommissionFilters,
  buildCommissionOptions,
  countActiveCommissionFilters,
  describeCommissionCounts,
  describeCommissionCoverage,
  describePartialMonth,
  filterCommissions,
  formatRecognizedTime,
  getSourceGroupPresentation,
  getStatusPresentation,
  paginateCommissions,
  resolveCommissionFilters,
  type CommissionFilters,
  type CommissionOptions,
  type CommissionPresentation,
} from "./commission-directory-models";

interface CommissionListPageProps {
  /** `commissions.manage`: every sale's rows, the Sale column and the Sale filter. */
  canManage: boolean;
  entries: readonly SalesCommissionAccrualDashboardEntry[];
  /** The `p_limit` the loader used; decides whether a month may be missing rows. */
  limit?: number;
}

const LIST_LABEL = "Danh sách doanh thu đủ điều kiện hoa hồng";
const PAGINATION_LABEL = "Phân trang doanh thu đủ điều kiện hoa hồng";

/**
 * Presents immutable, server-provided eligible revenue without calculating
 * commission money (design 16a row "Hoa hồng"). Month / Sale / source filters
 * over the loaded rows, in local state; filtering, options and the month
 * coverage rule live in `commission-directory-models.ts`.
 *
 * Read-only on purpose: no chips, no sheet trigger, no sortable headers (the
 * order is the server's: recognized_on desc). The only buttons are the pager
 * (past 20 rows) and "Xóa lọc" (once something is filtered), so a default
 * render of a single page holds none.
 * `.commission-directory-work-area` is the container: the table shows from
 * 1122px (1120px floor + the frame's 2px border), cards below it.
 */
export function CommissionListPage({
  canManage,
  entries,
  limit = COMMISSIONS_DEFAULT_LIMIT,
}: CommissionListPageProps) {
  const [requestedFilters, setRequestedFilters] = useState<CommissionFilters>(allCommissionFilters);
  const [requestedPage, setRequestedPage] = useState(1);

  const options = useMemo(() => buildCommissionOptions(entries), [entries]);
  const filters = useMemo(
    () => resolveCommissionFilters(requestedFilters, options, { canManage }),
    [canManage, options, requestedFilters],
  );
  const visible = useMemo(
    () => filterCommissions(entries, filters, { canManage }),
    [canManage, entries, filters],
  );
  const pagination = useMemo(
    () => paginateCommissions(visible, requestedPage),
    [visible, requestedPage],
  );
  const coverage = useMemo(
    () => describeCommissionCoverage({ entries, limit, month: filters.month }),
    [entries, filters.month, limit],
  );

  const activeFilterCount = countActiveCommissionFilters(filters, { canManage });
  const hasFilters = activeFilterCount > 0;
  const hasNoData = entries.length === 0;
  const counts = describeCommissionCounts({
    capped: coverage.capped,
    filteredCount: visible.length,
    hasFilters,
    limit,
    total: entries.length,
  });

  const updateFilter =
    (key: keyof CommissionFilters) => (event: ChangeEvent<HTMLSelectElement>) => {
      setRequestedFilters({ ...filters, [key]: event.target.value });
      setRequestedPage(1);
    };
  const resetFilters = () => {
    setRequestedFilters(allCommissionFilters);
    setRequestedPage(1);
  };

  const emptyState = (
    <TableState>
      {hasNoData ? (
        <>
          <p className="text-body font-semibold text-text-strong">Chưa có doanh thu đủ điều kiện</p>
          <p className="max-w-xl text-secondary text-text-muted">
            Các khoản thu hợp lệ trong phạm vi dữ liệu của tài khoản hiện tại sẽ xuất hiện tại đây.
          </p>
        </>
      ) : (
        <>
          <p className="text-body font-semibold text-text-strong">Không có bản ghi khớp bộ lọc</p>
          <p className="text-secondary text-text-muted">
            Nới rộng điều kiện hoặc xóa bộ lọc để xem lại danh sách.
          </p>
          <Button className="mt-2 max-md:h-11" onClick={resetFilters} size="sm" variant="secondary">
            Xóa lọc
          </Button>
        </>
      )}
    </TableState>
  );

  const paginationProps = {
    itemLabel: "bản ghi",
    onPageChange: setRequestedPage,
    page: pagination.page,
    pageCount: pagination.pageCount,
    rangeEnd: pagination.end,
    rangeStart: pagination.start,
    total: visible.length,
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="Doanh thu đủ điều kiện hoa hồng">
        <p className="mt-1 text-secondary tabular-nums text-text-muted">
          {counts} · Dữ liệu này chưa phải khoản hoa hồng, lương hoặc chi trả.
        </p>
      </PageHeader>

      <div className="commission-directory-work-area grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <FilterBar
          activeCount={activeFilterCount}
          className={canManage ? FILTER_TRACKS_MANAGE : FILTER_TRACKS_OWN}
          label="Bộ lọc doanh thu đủ điều kiện hoa hồng"
          onReset={resetFilters}
        >
          <CommissionFilterFields
            canManage={canManage}
            disabled={hasNoData}
            filters={filters}
            onChange={updateFilter}
            options={options}
          />
        </FilterBar>

        {coverage.partialMonth ? (
          <p
            className="rounded-lg border border-warning-border bg-warning-bg px-4 py-2.5 text-secondary text-warning-ink"
            role="status"
          >
            {describePartialMonth(coverage.partialMonth, limit)}
          </p>
        ) : null}

        <p aria-live="polite" className="sr-only">
          Hiển thị {pagination.start}-{pagination.end} của {visible.length} bản ghi
        </p>

        <DataTableFrame
          body={pagination.rows.map((entry) => (
            <CommissionTableRow canManage={canManage} entry={entry} key={entry.id} />
          ))}
          caption={LIST_LABEL}
          className="commission-directory-table"
          empty={emptyState}
          footer={
            hasNoData ? undefined : (
              <Pagination label={PAGINATION_LABEL} variant="frame" {...paginationProps} />
            )
          }
          header={
            <tr>
              <TableHeaderCell className="w-[140px]">Ngày ghi nhận</TableHeaderCell>
              <TableHeaderCell>Học sinh</TableHeaderCell>
              <TableHeaderCell>Nguồn</TableHeaderCell>
              <TableHeaderCell className="w-[170px]" numeric>
                Doanh thu ghi nhận
              </TableHeaderCell>
              {canManage ? <TableHeaderCell className="w-[190px]">Sale</TableHeaderCell> : null}
              <TableHeaderCell className="w-[150px]">Trạng thái</TableHeaderCell>
            </tr>
          }
          status={visible.length === 0 ? "empty" : "ready"}
          // Ngày 140 · Doanh thu 170 · Sale 190 · Trạng thái 150 are fixed; Học sinh and Nguồn
          // share the rest (~235px each at the floor). Floor + 2px frame border = the 1122px switch.
          tableClassName="min-w-[1120px] table-fixed"
        />

        <div className="commission-directory-record-list min-w-0 gap-2">
          {visible.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
              {emptyState}
            </div>
          ) : (
            <>
              <ResponsiveRecordList label={LIST_LABEL}>
                {pagination.rows.map((entry) => (
                  <CommissionCard canManage={canManage} entry={entry} key={entry.id} />
                ))}
              </ResponsiveRecordList>
              <Pagination label={`${PAGINATION_LABEL} (danh sách gọn)`} {...paginationProps} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/*
 * Fields only (no search box): one column in a narrow container, equal tracks
 * from 640px, capped peer tracks from the table switch so "Tháng ghi nhận" is
 * not stretched like a search field. Static literals so Tailwind sees them.
 * Phones get 44px controls.
 */
const FILTER_TRACKS_MANAGE =
  "grid-cols-[minmax(0,1fr)] @min-[640px]:grid-cols-[repeat(3,minmax(0,1fr))_auto] @min-[1122px]:grid-cols-[repeat(3,minmax(180px,280px))_auto] max-md:[&_button]:h-11 max-md:[&_select]:h-11";
const FILTER_TRACKS_OWN =
  "grid-cols-[minmax(0,1fr)] @min-[640px]:grid-cols-[repeat(2,minmax(0,1fr))_auto] @min-[1122px]:grid-cols-[repeat(2,minmax(180px,280px))_auto] max-md:[&_button]:h-11 max-md:[&_select]:h-11";

function CommissionFilterFields({
  canManage,
  disabled,
  filters,
  onChange,
  options,
}: {
  canManage: boolean;
  disabled: boolean;
  filters: CommissionFilters;
  onChange: (key: keyof CommissionFilters) => (event: ChangeEvent<HTMLSelectElement>) => void;
  options: CommissionOptions;
}) {
  return (
    <>
      <FilterField label="Tháng ghi nhận">
        <FilterSelect
          active={filters.month !== ALL_OPTION}
          disabled={disabled}
          onChange={onChange("month")}
          value={filters.month}
        >
          <option value={ALL_OPTION}>Tất cả tháng</option>
          {options.months.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </FilterField>
      {canManage ? (
        <FilterField label="Sale">
          <FilterSelect
            active={filters.saleOwnerId !== ALL_OPTION}
            disabled={disabled}
            onChange={onChange("saleOwnerId")}
            value={filters.saleOwnerId}
          >
            <option value={ALL_OPTION}>Tất cả Sale</option>
            {options.sales.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </FilterField>
      ) : null}
      <FilterField label="Nguồn">
        <FilterSelect
          active={filters.sourceGroup !== ALL_OPTION}
          disabled={disabled}
          onChange={onChange("sourceGroup")}
          value={filters.sourceGroup}
        >
          <option value={ALL_OPTION}>Tất cả nguồn</option>
          {options.sources.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </FilterField>
    </>
  );
}

function CommissionTableRow({
  canManage,
  entry,
}: {
  canManage: boolean;
  entry: SalesCommissionAccrualDashboardEntry;
}) {
  const source = getSourceGroupPresentation(entry.leadSourceGroup);
  const status = getStatusPresentation(entry.status);

  return (
    <TableRow tall>
      <TableCell>
        <RecognizedDate entry={entry} />
      </TableCell>
      <TableCell>
        <span className="block truncate font-semibold text-text-strong" title={entry.studentFullName}>
          {entry.studentFullName}
        </span>
        <span className="block truncate text-caption tabular-nums text-text-muted">{entry.studentPublicCode}</span>
      </TableCell>
      <TableCell>
        <SourceSummary entry={entry} source={source} />
      </TableCell>
      <TableCell className="font-semibold text-text-strong" numeric>
        {formatVnd(entry.recognizedRevenueVnd)}
      </TableCell>
      {canManage ? (
        <TableCell>
          <span className="block truncate font-medium text-text-strong" title={entry.saleOwnerDisplayName}>
            {entry.saleOwnerDisplayName}
          </span>
          {entry.saleOwnerEmployeeCode ? (
            <span className="block truncate text-caption tabular-nums text-text-muted">
              {entry.saleOwnerEmployeeCode}
            </span>
          ) : null}
        </TableCell>
      ) : null}
      <TableCell>
        <Badge className="max-w-full whitespace-normal!" tone={status.tone}>
          {status.label}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

/** `11/08/2026` with "lúc 15:00" (Vietnam time of the bank timestamp); the full timestamp in `title`. */
function RecognizedDate({ entry }: { entry: SalesCommissionAccrualDashboardEntry }) {
  const time = formatRecognizedTime(entry.recognizedAt);

  return (
    <span className="block tabular-nums" title={`Tiền về lúc ${formatDateTime(entry.recognizedAt)}`}>
      <span className="block font-medium text-text-strong">{formatIsoDate(entry.recognizedOn)}</span>
      {time ? <span className="block text-caption text-text-muted">lúc {time}</span> : null}
    </span>
  );
}

function SourceSummary({
  entry,
  source,
}: {
  entry: SalesCommissionAccrualDashboardEntry;
  source: CommissionPresentation;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Badge className="max-w-full whitespace-normal!" tone={source.tone}>
          {source.label}
        </Badge>
        <span className="min-w-0 max-w-full truncate text-text-default" title={entry.leadSourceName}>
          {entry.leadSourceName}
        </span>
      </span>
      <span className="block truncate text-caption tabular-nums text-text-muted">{entry.leadSourceCode}</span>
    </>
  );
}

/** Non-link card: no detail route exists for an accrual (14a grading-credit card style). */
function CommissionCard({
  canManage,
  entry,
}: {
  canManage: boolean;
  entry: SalesCommissionAccrualDashboardEntry;
}) {
  const source = getSourceGroupPresentation(entry.leadSourceGroup);
  const status = getStatusPresentation(entry.status);
  const time = formatRecognizedTime(entry.recognizedAt);

  return (
    <article
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-5 text-text-strong">
            {entry.studentFullName}
          </span>
          <span className="mt-0.5 block text-secondary tabular-nums text-text-muted">{entry.studentPublicCode}</span>
        </div>
        <Badge className="max-w-[55%] shrink-0 whitespace-normal!" tone={status.tone}>
          {status.label}
        </Badge>
      </div>

      <div className="mt-2 text-secondary">
        <SourceSummary entry={entry} source={source} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-row pt-2 text-secondary text-text-default">
        <span className="tabular-nums">
          Doanh thu <strong className="font-semibold text-text-strong">{formatVnd(entry.recognizedRevenueVnd)}</strong>
        </span>
        <span className="tabular-nums" title={`Tiền về lúc ${formatDateTime(entry.recognizedAt)}`}>
          Ghi nhận <strong className="font-semibold">{formatIsoDate(entry.recognizedOn)}</strong>
          {time ? ` lúc ${time}` : null}
        </span>
        {canManage ? (
          <span className="min-w-0">
            Sale <strong className="font-semibold">{entry.saleOwnerDisplayName}</strong>
            {entry.saleOwnerEmployeeCode ? (
              <span className="tabular-nums text-text-muted"> · {entry.saleOwnerEmployeeCode}</span>
            ) : null}
          </span>
        ) : null}
      </div>
    </article>
  );
}
