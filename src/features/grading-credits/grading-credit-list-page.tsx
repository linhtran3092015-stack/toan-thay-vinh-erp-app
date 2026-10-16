"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import {
  FilterBar,
  FilterField,
  FilterSelect,
  FilterSheet,
  FilterTrigger,
} from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Pagination } from "@/components/patterns/pagination";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatIsoDate, getVietnamToday } from "@/lib/datetime";

import {
  ALL_OPTION,
  GRADING_CREDITS_LIMIT,
  allGradingCreditFilters,
  buildCreditOptions,
  countActiveCreditFilters,
  describeCreditTotalScope,
  filterCredits,
  getDefaultMonth,
  paginateCredits,
  resolveCreditFilters,
  summarizeCreditTotal,
  type GradingCreditFilters,
  type GradingCreditOptions,
  type GradingCreditTotal,
} from "./grading-credit-models";
import type { GradingCreditDashboardEntry } from "./read-models";

export interface GradingCreditListPageProps {
  /** `grading_credits.view_all`: shows the grader column and filter. */
  canViewAll: boolean;
  /** `sessions.view`: enables "Mở kết quả buổi". Without it no link renders. */
  canViewSessions?: boolean;
  entries: readonly GradingCreditDashboardEntry[];
  /** The `p_limit` the loader used; decides whether a total is exact. */
  limit?: number;
  /** Vietnam business date `YYYY-MM-DD` from the server, so SSR and client agree on the month. */
  today?: string;
}

type FilterScope = "desktop" | "mobile";

/**
 * Grading credits list (design 16a): month / grader / class filters over the
 * loaded credits, one table (cards when narrow) and a total that says whether
 * it covers every credit of the selection or only the newest loaded ones.
 *
 * The `@container` threshold (940px) decides table vs cards; a table floor plus
 * the frame's 2px border must stay within it, or the table would scroll sideways
 * just above the switch.
 */
export function GradingCreditListPage({
  canViewAll,
  canViewSessions = false,
  entries,
  limit = GRADING_CREDITS_LIMIT,
  today,
}: GradingCreditListPageProps) {
  const titleId = useId();
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [requestedFilters, setRequestedFilters] = useState<GradingCreditFilters>(() => ({
    ...allGradingCreditFilters,
    month: getDefaultMonth(entries, (today ?? getVietnamToday()).slice(0, 7)),
  }));
  const [requestedPage, setRequestedPage] = useState(1);

  const options = useMemo(() => buildCreditOptions(entries), [entries]);
  const filters = useMemo(
    () => resolveCreditFilters(requestedFilters, options),
    [options, requestedFilters],
  );
  const filtered = useMemo(
    () => filterCredits(entries, filters, { canViewAll }),
    [canViewAll, entries, filters],
  );
  const pagination = useMemo(
    () => paginateCredits(filtered, requestedPage),
    [filtered, requestedPage],
  );
  const total = useMemo(
    () => summarizeCreditTotal({ entries, filtered, limit, month: filters.month }),
    [entries, filtered, filters.month, limit],
  );

  const activeFilterCount = countActiveCreditFilters(filters, { canViewAll });
  const hasFilters = activeFilterCount > 0;
  const hasNoData = entries.length === 0;
  const totalLabel = describeCreditTotalScope(filters, { canViewAll });

  const updateFilter =
    (key: keyof GradingCreditFilters) => (event: ChangeEvent<HTMLSelectElement>) => {
      setRequestedFilters({ ...filters, [key]: event.target.value });
      setRequestedPage(1);
    };
  const resetFilters = () => {
    setRequestedFilters(allGradingCreditFilters);
    setRequestedPage(1);
  };

  const fields = (scope: FilterScope) => (
    <CreditFilterFields
      canViewAll={canViewAll}
      disabled={hasNoData}
      filters={filters}
      onChange={updateFilter}
      options={options}
      scope={scope}
    />
  );

  const emptyState = (
    <TableState>
      {hasNoData ? (
        <>
          <p className="text-body font-semibold text-text-strong">Chưa có tín chỉ chấm bài</p>
          <p className="text-secondary text-text-muted">
            Tín chỉ được ghi nhận tự động khi một buổi học hoàn thành được khóa và có kết quả đã chấm.
          </p>
        </>
      ) : (
        <>
          <p className="text-body font-semibold text-text-strong">Không có tín chỉ khớp bộ lọc</p>
          <p className="text-secondary text-text-muted">
            Nới rộng điều kiện hoặc xóa bộ lọc để xem lại danh sách.
          </p>
          <Button className="mt-2" onClick={resetFilters} size="sm" variant="secondary">
            Xóa lọc
          </Button>
        </>
      )}
    </TableState>
  );

  const paginationProps = {
    itemLabel: "tín chỉ",
    onPageChange: setRequestedPage,
    page: pagination.page,
    pageCount: pagination.pageCount,
    rangeEnd: pagination.end,
    rangeStart: pagination.start,
    total: filtered.length,
  };

  return (
    <div className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={
          <FilterTrigger
            activeCount={activeFilterCount}
            className="@min-[940px]:hidden"
            onClick={() => setIsFilterSheetOpen(true)}
            ref={filterTriggerRef}
          />
        }
        context={
          <Badge tone={canViewAll ? "info" : "neutral"}>
            {canViewAll ? "Phạm vi: toàn bộ" : "Phạm vi: của tôi"}
          </Badge>
        }
        title="Tín chỉ chấm bài"
      >
        <p className="mt-1 text-secondary text-text-muted">
          Mỗi kết quả đã chấm được ghi một tín chỉ khi buổi học được khóa. Đây là tín chỉ hệ thống ghi nhận, không phải số lượng chấm bài tính lương.
        </p>
      </PageHeader>

      <div className="hidden @min-[940px]:block">
        <FilterBar
          activeCount={activeFilterCount}
          columns={canViewAll ? FILTER_COLUMNS_ALL : FILTER_COLUMNS_OWN}
          label="Bộ lọc tín chỉ chấm bài"
          onReset={resetFilters}
        >
          {fields("desktop")}
        </FilterBar>
      </div>
      <FilterSheet
        activeCount={activeFilterCount}
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        onReset={resetFilters}
        resetTestId="mobile-credit-reset-filters"
        resultLabel={`Xem ${filtered.length} tín chỉ`}
        returnFocusRef={filterTriggerRef}
        subject="tín chỉ chấm bài"
        titleId={titleId}
      >
        {fields("mobile")}
      </FilterSheet>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <p aria-live="polite" className="sr-only">
          Hiển thị {pagination.start}-{pagination.end} của {filtered.length} tín chỉ
        </p>

        <div className="hidden min-w-0 @min-[940px]:block">
          <DataTableFrame
            body={pagination.rows.map((entry) => (
              <CreditTableRow
                canViewAll={canViewAll}
                canViewSessions={canViewSessions}
                entry={entry}
                key={entry.id}
              />
            ))}
            caption="Tín chỉ chấm bài"
            empty={emptyState}
            footer={
              hasNoData ? undefined : (
                <>
                  <CreditTotalLine
                    className="w-full border-b border-border-row pb-2.5"
                    label={totalLabel}
                    total={total}
                  />
                  <Pagination label="Phân trang tín chỉ chấm bài" variant="frame" {...paginationProps} />
                </>
              )
            }
            header={
              <tr>
                <TableHeaderCell className="w-[120px]">Ngày buổi</TableHeaderCell>
                <TableHeaderCell>Lớp</TableHeaderCell>
                <TableHeaderCell>Học sinh</TableHeaderCell>
                {canViewAll ? <TableHeaderCell className="w-[176px]">Người chấm</TableHeaderCell> : null}
                <TableHeaderCell className="w-[160px]">Ghi nhận lúc</TableHeaderCell>
                {canViewSessions ? (
                  <TableHeaderCell className="w-[160px]" numeric>
                    Thao tác
                  </TableHeaderCell>
                ) : null}
              </tr>
            }
            status={filtered.length === 0 ? "empty" : "ready"}
            tableClassName={tableClassName(canViewAll, canViewSessions)}
          />
        </div>

        <div className="grid min-w-0 gap-2 @min-[940px]:hidden">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
              {emptyState}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 text-secondary">
                <CreditTotalLine label={totalLabel} total={total} />
                {hasFilters ? (
                  <button
                    className="-my-3 min-h-11 shrink-0 rounded-md px-2 font-semibold text-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                    onClick={resetFilters}
                    type="button"
                  >
                    Xóa lọc
                  </button>
                ) : null}
              </div>
              <ResponsiveRecordList label="Danh sách tín chỉ chấm bài">
                {pagination.rows.map((entry) => (
                  <CreditCard
                    canViewAll={canViewAll}
                    canViewSessions={canViewSessions}
                    entry={entry}
                    key={entry.id}
                  />
                ))}
              </ResponsiveRecordList>
              <Pagination label="Phân trang tín chỉ chấm bài (danh sách gọn)" {...paginationProps} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * `table-fixed`: Lớp and Học sinh share what the fixed columns leave (Ngày buổi 120,
 * Người chấm 176, Ghi nhận lúc 160, Thao tác 160), so names truncate with the column
 * instead of at a hard cap. The floors keep both name columns >= ~160px.
 * Static literals so Tailwind sees every class; floor + 2px frame border <= the 940px container switch.
 */
function tableClassName(canViewAll: boolean, canViewSessions: boolean): string {
  if (canViewAll && canViewSessions) return "table-fixed min-w-[938px]";
  if (canViewAll || canViewSessions) return "table-fixed min-w-[780px]";
  return "table-fixed min-w-[640px]";
}

// Equal peer tracks: FilterBar's default grid assumes a leading search box, which would stretch Tháng.
const FILTER_COLUMNS_ALL = "repeat(3, minmax(180px, 280px))";
const FILTER_COLUMNS_OWN = "repeat(2, minmax(180px, 280px))";

function CreditFilterFields({
  canViewAll,
  disabled,
  filters,
  onChange,
  options,
  scope,
}: {
  canViewAll: boolean;
  disabled: boolean;
  filters: GradingCreditFilters;
  onChange: (key: keyof GradingCreditFilters) => (event: ChangeEvent<HTMLSelectElement>) => void;
  options: GradingCreditOptions;
  scope: FilterScope;
}) {
  return (
    <>
      <FilterField label="Tháng">
        <FilterSelect
          active={filters.month !== ALL_OPTION}
          data-testid={`${scope}-credit-month`}
          disabled={disabled}
          onChange={onChange("month")}
          value={filters.month}
        >
          <option value={ALL_OPTION}>Tất cả</option>
          {options.months.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </FilterField>
      {canViewAll ? (
        <FilterField label="Người chấm">
          <FilterSelect
            active={filters.graderId !== ALL_OPTION}
            data-testid={`${scope}-credit-grader`}
            disabled={disabled}
            onChange={onChange("graderId")}
            value={filters.graderId}
          >
            <option value={ALL_OPTION}>Tất cả</option>
            {options.graders.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </FilterField>
      ) : null}
      <FilterField label="Lớp">
        <FilterSelect
          active={filters.classCode !== ALL_OPTION}
          data-testid={`${scope}-credit-class`}
          disabled={disabled}
          onChange={onChange("classCode")}
          value={filters.classCode}
        >
          <option value={ALL_OPTION}>Tất cả</option>
          {options.classes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </FilterField>
    </>
  );
}

/** "Tổng tín chỉ (tháng 10/2026): 12", or "ít nhất 12 (trong 500 tín chỉ mới nhất)" when rows may be cut. */
function CreditTotalLine({
  className,
  label,
  total,
}: {
  className?: string;
  label: string;
  total: GradingCreditTotal;
}) {
  return (
    <p className={className} data-testid="grading-credit-total">
      <span className="text-text-default">{label}: </span>
      <strong className="font-semibold tabular-nums text-text-strong">
        {total.exact ? total.total : `ít nhất ${total.total}`}
      </strong>
      {total.exact ? null : (
        <span className="tabular-nums text-text-muted"> (trong {total.limit} tín chỉ mới nhất)</span>
      )}
    </p>
  );
}

function creditAriaLabel(entry: GradingCreditDashboardEntry): string {
  return `Mở kết quả buổi ${entry.classCode} ngày ${formatIsoDate(entry.sessionDate)} của ${entry.studentFullName}`;
}

function sessionHref(entry: GradingCreditDashboardEntry): string {
  return `/sessions/${entry.classSessionId}`;
}

function CreditTableRow({
  canViewAll,
  canViewSessions,
  entry,
}: {
  canViewAll: boolean;
  canViewSessions: boolean;
  entry: GradingCreditDashboardEntry;
}) {
  return (
    <TableRow tall>
      <TableCell className="whitespace-nowrap tabular-nums">{formatIsoDate(entry.sessionDate)}</TableCell>
      <TableCell>
        <span className="block max-w-full truncate font-semibold text-text-strong" title={entry.className}>
          {entry.className}
        </span>
        <span className="block max-w-full truncate text-caption tabular-nums text-text-muted">{entry.classCode}</span>
      </TableCell>
      <TableCell>
        <span className="block max-w-full truncate font-semibold text-text-strong" title={entry.studentFullName}>
          {entry.studentFullName}
        </span>
        <span className="block max-w-full truncate text-caption tabular-nums text-text-muted">
          {entry.studentPublicCode}
        </span>
      </TableCell>
      {canViewAll ? (
        <TableCell className="text-secondary text-text-default">
          <span className="block max-w-full truncate" title={entry.graderDisplayName}>
            {entry.graderDisplayName}
          </span>
        </TableCell>
      ) : null}
      <TableCell className="whitespace-nowrap tabular-nums text-text-default">
        {formatDateTime(entry.creditedAt)}
      </TableCell>
      {canViewSessions ? (
        <TableCell numeric>
          <Link
            aria-label={creditAriaLabel(entry)}
            className="inline-flex h-8 items-center whitespace-nowrap rounded-md px-2 text-secondary font-semibold text-action-link! hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={sessionHref(entry)}
          >
            Mở kết quả buổi
          </Link>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function CreditCard({
  canViewAll,
  canViewSessions,
  entry,
}: {
  canViewAll: boolean;
  canViewSessions: boolean;
  entry: GradingCreditDashboardEntry;
}) {
  const meta = `${entry.studentPublicCode} · ${entry.className} (${entry.classCode})`;
  const metrics = (
    <>
      <span>
        Buổi <strong className="font-semibold">{formatIsoDate(entry.sessionDate)}</strong>
      </span>
      {canViewAll ? (
        <span>
          Người chấm <strong className="font-semibold">{entry.graderDisplayName}</strong>
        </span>
      ) : null}
      <span className="tabular-nums">
        Ghi nhận <strong className="font-semibold">{formatDateTime(entry.creditedAt)}</strong>
      </span>
    </>
  );

  if (canViewSessions) {
    return (
      <RecordListItem
        ariaLabel={creditAriaLabel(entry)}
        href={sessionHref(entry)}
        meta={meta}
        metrics={metrics}
        title={entry.studentFullName}
      />
    );
  }

  // RecordListItem is a whole-card link; without sessions.view the card must not link anywhere.
  return (
    <article
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
      role="listitem"
    >
      <span className="block truncate text-[15px] font-semibold leading-5 text-text-strong">
        {entry.studentFullName}
      </span>
      <div className="mt-0.5 text-secondary tabular-nums text-text-muted">{meta}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-row pt-2 text-secondary text-text-default">
        {metrics}
      </div>
    </article>
  );
}
