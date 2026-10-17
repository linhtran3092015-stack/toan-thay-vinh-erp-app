"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { FilterBar, FilterField, FilterInput, FilterSelect } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Pagination } from "@/components/patterns/pagination";
import { QuickFilterChips } from "@/components/patterns/quick-filter-chips";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import type { AdvanceActionOverrides } from "@/features/advances/advance-action-overrides";
import {
  ALL_OPTION,
  allAdvanceFilters,
  buildAdvanceChips,
  buildAdvanceOptions,
  buildRelatedAdvances,
  canDecideAdvances,
  countActiveAdvanceFilters,
  describeAdvanceIdentity,
  describeAdvanceStatusCaption,
  describeAdvanceSummary,
  describeOwnPendingCaption,
  filterAdvances,
  getActiveAdvanceChip,
  getAdvanceGroupOption,
  getAdvanceRowAction,
  getPayrollPeriodHref,
  isActionableAdvance,
  OWN_PENDING_SHORT_CAPTION,
  paginateAdvances,
  resolveAdvanceFilters,
  type AdvanceDirectoryFilters,
  type AdvanceRowAction,
  type AdvanceStatusFilter,
  type AdvanceViewer,
} from "@/features/advances/advance-directory-models";
import { AdvanceStatusBadge } from "@/features/advances/components/advance-status-badge";
import { RequestSalaryAdvanceDialog } from "@/features/advances/components/request-salary-advance-dialog";
import { SalaryAdvanceDecisionDialog } from "@/features/advances/components/salary-advance-decision-dialog";
import {
  getAdvanceRowLinkClassName,
  SalaryAdvanceDetailDialog,
  type AdvanceRowControlSize,
} from "@/features/advances/components/salary-advance-detail-dialog";
import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";
import { formatMonth, getVietnamToday } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";

export interface AdvanceListPageProps {
  /** Server-action overrides for the /dev preview; the real page passes nothing. */
  actions?: AdvanceActionOverrides;
  /** `advances.owner_approve` */
  canApprove: boolean;
  /** `advances.request` */
  canRequest: boolean;
  /** `advances.review` */
  canReview: boolean;
  /** `payroll.view`: a deducted row links to its payroll period. */
  canViewPayroll?: boolean;
  entries: readonly SalaryAdvanceDashboardEntry[];
  /** Vietnam business date `YYYY-MM-DD` from the server, so SSR and client agree on short dates. */
  today?: string;
  /** Signed-in user id: own rows leave "Cần xử lý" (the RPCs refuse a self-decision). */
  viewerId?: string | null;
}

const CAPTION = "Danh sách yêu cầu tạm ứng lương";

/*
 * Responsive switch: `.salary-advance-directory-work-area` is the container; the
 * table shows from 1042px (`globals.css`: the 1040px table floor + the frame's
 * 2px border), the cards below. The filter bar uses the same container through
 * Tailwind `@min-[…]` variants; the class names are spelled out in full so the
 * scanner sees them.
 */
const FILTER_BAR_DECIDER_CLASS =
  "grid-cols-1 @min-[640px]:grid-cols-2 @min-[1042px]:grid-cols-[minmax(220px,1.4fr)_repeat(2,minmax(0,1fr))_auto] max-md:[&_button]:h-11";
const FILTER_BAR_OWN_CLASS =
  "grid-cols-1 @min-[640px]:grid-cols-2 @min-[1042px]:grid-cols-[repeat(2,minmax(180px,280px))_auto] max-md:[&_button]:h-11";

/**
 * Salary advance list (design 16a + 16c): count-only header, quick chips,
 * filters, a framed table (cards when narrow) with one row action, and pagers.
 * Filters live in local state (inbound links are bare `/advances`). Payroll is
 * the authority for deductions, so nothing here totals money.
 */
export function AdvanceListPage({
  actions,
  canApprove,
  canRequest,
  canReview,
  canViewPayroll = false,
  entries,
  today,
  viewerId = null,
}: AdvanceListPageProps) {
  const [fallbackToday] = useState(getVietnamToday);
  const businessToday = today ?? fallbackToday;
  const viewer = useMemo<AdvanceViewer>(
    () => ({ canApprove, canReview, viewerId }),
    [canApprove, canReview, viewerId],
  );
  const [requestedFilters, setRequestedFilters] = useState<AdvanceDirectoryFilters>(allAdvanceFilters);
  const [requestedPage, setRequestedPage] = useState(1);
  /**
   * Success message of the last request or decision made on this page; cleared
   * by the next filter, reset or page change and when either dialog opens.
   */
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  /** Set by a success; consumed once focus has been moved to the notice. */
  const pendingNoticeFocusRef = useRef(false);

  const options = useMemo(() => buildAdvanceOptions(entries), [entries]);
  const filters = useMemo(
    () => resolveAdvanceFilters(requestedFilters, options, viewer),
    [options, requestedFilters, viewer],
  );
  const filtered = useMemo(() => filterAdvances(entries, filters, viewer), [entries, filters, viewer]);
  const chips = useMemo(() => buildAdvanceChips(entries, filters, viewer), [entries, filters, viewer]);
  const relatedById = useMemo(() => buildRelatedAdvances(entries), [entries]);
  const pagination = useMemo(() => paginateAdvances(filtered, requestedPage), [filtered, requestedPage]);
  const hasActionable = useMemo(
    () => entries.some((entry) => isActionableAdvance(entry, viewer)),
    [entries, viewer],
  );

  const canDecide = canDecideAdvances(viewer);
  const groupOption = getAdvanceGroupOption(viewer);
  const summary = describeAdvanceSummary(entries, { period: filters.period, viewer });
  const activeFilterCount = countActiveAdvanceFilters(filters);
  const hasNoData = entries.length === 0;
  // "Cần xử lý" is active and no loaded row is left to decide (a search or month alone keeps the generic text).
  const isQueueCleared = filters.status === "actionable" && !hasActionable;

  // After a success the dialog hands focus back to its trigger. A decided row can
  // then leave the list (the refresh lands, or the row no longer matches "Cần xử
  // lý"), taking the trigger with it: move focus to the notice instead of <body>.
  useEffect(() => {
    if (!actionNotice || !pendingNoticeFocusRef.current) return;
    const active = document.activeElement;
    // Focus is still somewhere useful (the trigger stayed): leave it.
    if (active && active !== document.body && active.isConnected) return;
    pendingNoticeFocusRef.current = false;
    noticeRef.current?.focus();
  }, [actionNotice, entries]);

  const clearActionNotice = () => {
    setActionNotice(null);
    pendingNoticeFocusRef.current = false;
  };
  const showActionNotice = (message: string) => {
    setActionNotice(message);
    pendingNoticeFocusRef.current = true;
  };
  const updateFilters = (next: Partial<AdvanceDirectoryFilters>) => {
    setRequestedFilters({ ...filters, ...next });
    setRequestedPage(1);
    clearActionNotice();
  };
  const resetFilters = () => {
    setRequestedFilters(allAdvanceFilters);
    setRequestedPage(1);
    clearActionNotice();
  };
  const changePage = (page: number) => {
    setRequestedPage(page);
    clearActionNotice();
  };
  // A new request must not land behind an active chip or filter: show everything and say it was sent.
  const handleRequestSuccess = (message: string) => {
    setRequestedFilters(allAdvanceFilters);
    setRequestedPage(1);
    showActionNotice(message);
  };

  const rowProps = (entry: SalaryAdvanceDashboardEntry) => ({
    action: getAdvanceRowAction(entry, viewer, { canViewPayroll }),
    actions,
    entry,
    onDecisionOpen: clearActionNotice,
    // A decision keeps the filters (the user is working the queue): the row may leave it, the notice says why.
    onDecisionSuccess: showActionNotice,
    relatedEntries: relatedById.get(entry.id) ?? [],
    today: businessToday,
  });

  const emptyState = (
    <TableState>
      {hasNoData ? (
        <>
          <p className="text-body font-semibold text-text-strong">Chưa có yêu cầu tạm ứng</p>
          <p className="text-secondary text-text-muted">
            {canRequest
              ? "Yêu cầu bạn gửi sẽ hiện tại đây cùng bước đối soát và phê duyệt."
              : "Các yêu cầu trong phạm vi tài khoản hiện tại sẽ hiện tại đây."}
          </p>
        </>
      ) : isQueueCleared ? (
        <>
          <p className="text-body font-semibold text-text-strong">Đã xử lý hết đơn cần xử lý.</p>
          <p className="text-secondary text-text-muted">Đơn đã xử lý vẫn có trong “Tất cả”.</p>
          <Button
            className="mt-2 max-md:h-11"
            onClick={() => updateFilters({ status: ALL_OPTION })}
            size="sm"
            variant="secondary"
          >
            Xem tất cả
          </Button>
        </>
      ) : (
        <>
          <p className="text-body font-semibold text-text-strong">Không có đơn khớp bộ lọc</p>
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
    itemLabel: "đơn",
    onPageChange: changePage,
    page: pagination.page,
    pageCount: pagination.pageCount,
    rangeEnd: pagination.end,
    rangeStart: pagination.start,
    total: filtered.length,
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={
          canRequest ? (
            <RequestSalaryAdvanceDialog
              actions={actions}
              onOpen={clearActionNotice}
              onSuccess={handleRequestSuccess}
            />
          ) : undefined
        }
        title="Tạm ứng lương"
      >
        <p className="mt-1 text-secondary tabular-nums text-text-muted">{summary}</p>
      </PageHeader>

      <div className="salary-advance-directory-work-area grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        {actionNotice ? (
          // Focus target when a decided row's trigger is gone (see the effect above).
          <div
            className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            ref={noticeRef}
            tabIndex={-1}
          >
            <ResultBanner title={actionNotice} tone="success" />
          </div>
        ) : null}

        {hasNoData ? null : (
          <>
            <QuickFilterChips
              chips={chips}
              className="max-md:[&_button]:h-11"
              // Zero-count status chips are already dropped unless active, so this only
              // keeps "Tất cả" clickable when a search or month matches nothing.
              disableEmpty={false}
              label="Lọc nhanh tạm ứng"
              onChange={(status) => updateFilters({ status })}
              value={getActiveAdvanceChip(filters)}
            />

            <FilterBar
              activeCount={activeFilterCount}
              className={canDecide ? FILTER_BAR_DECIDER_CLASS : FILTER_BAR_OWN_CLASS}
              label="Bộ lọc tạm ứng"
              onReset={resetFilters}
            >
              {canDecide ? (
                // Own-scope viewers only see their own rows: a staff search would have nothing to find.
                <FilterField className="@min-[640px]:col-span-2 @min-[1042px]:col-span-1" label="Tìm nhân sự">
                  <FilterInput
                    active={filters.search.trim().length > 0}
                    autoComplete="off"
                    className="max-md:h-11"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters({ search: event.target.value })}
                    placeholder="Tên hoặc mã nhân sự"
                    type="search"
                    value={filters.search}
                  />
                </FilterField>
              ) : null}
              <FilterField label="Trạng thái">
                <FilterSelect
                  active={filters.status !== ALL_OPTION}
                  className="max-md:h-11"
                  onChange={(event) => updateFilters({ status: event.target.value as AdvanceStatusFilter })}
                  value={filters.status}
                >
                  <option value={ALL_OPTION}>Tất cả trạng thái</option>
                  <option value={groupOption.value}>{groupOption.label}</option>
                  {options.statuses.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterField>
              <FilterField label="Trừ vào kỳ">
                <FilterSelect
                  active={filters.period !== ALL_OPTION}
                  className="max-md:h-11"
                  onChange={(event) => updateFilters({ period: event.target.value })}
                  value={filters.period}
                >
                  <option value={ALL_OPTION}>Tất cả kỳ</option>
                  {options.periods.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterField>
            </FilterBar>
          </>
        )}

        <p aria-live="polite" className="sr-only">
          {hasNoData
            ? ""
            : filtered.length === 0
              ? "0 đơn khớp bộ lọc"
              : `Hiển thị ${pagination.start}–${pagination.end} của ${filtered.length} đơn`}
        </p>

        <DataTableFrame
          body={pagination.rows.map((entry) => (
            <AdvanceTableRow key={entry.id} {...rowProps(entry)} />
          ))}
          caption={CAPTION}
          className="salary-advance-directory-table"
          empty={emptyState}
          footer={
            filtered.length > 0 ? (
              <Pagination label="Phân trang tạm ứng" variant="frame" {...paginationProps} />
            ) : undefined
          }
          header={
            <tr>
              <TableHeaderCell className="w-[250px]">Nhân sự</TableHeaderCell>
              <TableHeaderCell className="w-[130px]" numeric>
                Số tiền
              </TableHeaderCell>
              <TableHeaderCell className="w-[100px]">Trừ vào kỳ</TableHeaderCell>
              <TableHeaderCell>Lý do</TableHeaderCell>
              <TableHeaderCell className="w-[190px]">Trạng thái</TableHeaderCell>
              <TableHeaderCell className="w-[150px]" numeric>
                Thao tác
              </TableHeaderCell>
            </tr>
          }
          status={filtered.length === 0 ? "empty" : "ready"}
          // table-fixed: Lý do takes what the fixed columns leave (>= 220px at the floor).
          tableClassName="min-w-[1040px] table-fixed"
        />

        <div className="salary-advance-directory-record-list gap-2">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
              {emptyState}
            </div>
          ) : (
            <>
              <ResponsiveRecordList label={CAPTION}>
                {pagination.rows.map((entry) => (
                  <AdvanceCard key={entry.id} {...rowProps(entry)} />
                ))}
              </ResponsiveRecordList>
              <Pagination label="Phân trang tạm ứng (danh sách gọn)" {...paginationProps} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdvanceRowProps {
  action: AdvanceRowAction;
  actions?: AdvanceActionOverrides;
  entry: SalaryAdvanceDashboardEntry;
  onDecisionOpen: () => void;
  onDecisionSuccess: (message: string) => void;
  relatedEntries: readonly SalaryAdvanceDashboardEntry[];
  today: string;
}

function AdvanceTableRow(props: AdvanceRowProps) {
  const { entry, today } = props;

  return (
    <TableRow tall>
      <TableCell className="py-2">
        <span className="block truncate font-semibold text-text-strong" title={entry.staffDisplayName}>
          {entry.staffDisplayName}
        </span>
        <span
          className="block truncate text-caption tabular-nums text-text-muted"
          title={describeAdvanceIdentity(entry, today, "full")}
        >
          {describeAdvanceIdentity(entry, today)}
        </span>
      </TableCell>
      <TableCell className="font-semibold text-text-strong" numeric>
        {formatVnd(entry.amountVnd)}
      </TableCell>
      <TableCell className="tabular-nums">{formatMonth(entry.deductionPeriodMonth)}</TableCell>
      <TableCell className="text-secondary">
        <span className="block truncate" title={entry.requestNote}>
          {entry.requestNote}
        </span>
      </TableCell>
      <TableCell className="py-2">
        <AdvanceStatus entry={entry} today={today} />
      </TableCell>
      <TableCell className="py-2">
        <div className="flex flex-wrap items-center justify-end gap-1">
          <AdvanceRowActions {...props} layout="table" />
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Phone/narrow card: non-link (no detail route), same row action as the table. */
function AdvanceCard(props: AdvanceRowProps) {
  const { entry, today } = props;

  return (
    <article
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body font-semibold text-text-strong">{entry.staffDisplayName}</p>
          <p className="break-words text-secondary tabular-nums text-text-muted">
            {describeAdvanceIdentity(entry, today)}
          </p>
        </div>
        <p className="shrink-0 text-body font-semibold tabular-nums text-text-strong">
          {formatVnd(entry.amountVnd)}
        </p>
      </div>

      <div className="mt-2">
        <AdvanceStatus entry={entry} today={today} />
      </div>

      <dl className="mt-2 grid gap-1 text-secondary">
        <div className="flex gap-2">
          <dt className="text-text-muted">Trừ vào kỳ</dt>
          <dd className="font-medium tabular-nums text-text-strong">{formatMonth(entry.deductionPeriodMonth)}</dd>
        </div>
        <div className="flex min-w-0 gap-2">
          <dt className="shrink-0 text-text-muted">Lý do</dt>
          <dd className="line-clamp-2 min-w-0 break-words text-text-default">{entry.requestNote}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border-row pt-2">
        <AdvanceRowActions {...props} layout="card" />
      </div>
    </article>
  );
}

/** Badge (pinned label) plus one caption line in the design's phrasing. */
function AdvanceStatus({ entry, today }: { entry: SalaryAdvanceDashboardEntry; today: string }) {
  const caption = describeAdvanceStatusCaption(entry, today);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] justify-items-start gap-1">
      <AdvanceStatusBadge status={entry.status} />
      {caption ? (
        <span className="line-clamp-2 max-w-full break-words text-caption text-text-muted" title={caption}>
          {caption}
        </span>
      ) : null}
    </div>
  );
}

function AdvanceRowActions({
  action,
  actions,
  entry,
  layout,
  onDecisionOpen,
  onDecisionSuccess,
  relatedEntries,
  today,
}: AdvanceRowProps & { layout: "card" | "table" }) {
  const size: AdvanceRowControlSize = layout === "table" ? "sm" : "lg";

  if (action.kind === "decide") {
    return (
      <SalaryAdvanceDecisionDialog
        actions={actions}
        advance={entry}
        onOpen={onDecisionOpen}
        onSuccess={onDecisionSuccess}
        relatedEntries={relatedEntries}
        stage={action.stage}
        today={today}
        triggerSize={size}
        triggerVariant="secondary"
      />
    );
  }

  if (action.kind === "own-pending") {
    // No decision on one's own request, but it can still be read.
    const caption = describeOwnPendingCaption(action.stage);

    return (
      <>
        {layout === "table" ? (
          // The 150px Thao tác cell fits a short label beside "Xem"; the full text is the title and sr-only.
          <span className="whitespace-nowrap text-caption text-text-muted" title={caption}>
            <span aria-hidden="true">{OWN_PENDING_SHORT_CAPTION}</span>
            <span className="sr-only">{caption}</span>
          </span>
        ) : (
          <span className="text-right text-caption text-text-muted">{caption}</span>
        )}
        <SalaryAdvanceDetailDialog entry={entry} triggerSize={size} />
      </>
    );
  }

  return (
    <>
      {action.payrollPeriodId ? (
        <PayrollPeriodLink entry={entry} payrollPeriodId={action.payrollPeriodId} size={size} />
      ) : null}
      <SalaryAdvanceDetailDialog entry={entry} triggerSize={size} />
    </>
  );
}

function PayrollPeriodLink({
  entry,
  payrollPeriodId,
  size,
}: {
  entry: SalaryAdvanceDashboardEntry;
  payrollPeriodId: string;
  size: AdvanceRowControlSize;
}): ReactNode {
  return (
    <Link
      aria-label={`Mở kỳ lương ${formatMonth(entry.deductionPeriodMonth)}`}
      className={getAdvanceRowLinkClassName(size)}
      href={getPayrollPeriodHref(payrollPeriodId)}
    >
      Kỳ lương
    </Link>
  );
}
