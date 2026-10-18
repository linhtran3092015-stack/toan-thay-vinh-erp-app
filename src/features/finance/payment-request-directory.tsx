"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { TableState } from "@/components/patterns/data-table-frame";
import { FilterTrigger } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Pagination } from "@/components/patterns/pagination";
import { QuickFilterChips } from "@/components/patterns/quick-filter-chips";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button, getButtonClassName } from "@/components/ui/button";
import { PaymentRequestFilters } from "@/features/finance/components/payment-request-filters";
import { PaymentRequestTable } from "@/features/finance/components/payment-request-table";
import type { PaymentRequestActionOverrides } from "@/features/finance/payment-request-action-overrides";
import {
  buildPaymentRequestStatusChips,
  countActivePaymentRequestFilters,
  describePaymentRequestDirectoryContext,
  filterPaymentRequests,
  getPaymentRequestStatusChipValue,
  paginatePaymentRequests,
  summarizePaymentRequests,
  type PaymentRequestStatusChip,
  type PaymentRequestSummary,
} from "@/features/finance/payment-request-directory-models";
import type { PaymentRequestFiltersState, PaymentRequestReadModel } from "@/features/finance/read-models";
import {
  getPaymentRequestDirectoryHref,
  getPaymentRequestDirectoryQuery,
  mergePendingPaymentRequestFilter,
  parsePaymentRequestDirectoryViewState,
  PAYMENT_REQUEST_DIRECTORY_PATH,
  resetPaymentRequestDirectoryViewState,
  serializePaymentRequestDirectoryViewState,
  type PaymentRequestDirectoryViewState,
} from "@/features/finance/payment-request-url-state";
import { getVietnamToday } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";

// Pinned exports of this module (route and tests); the logic lives in the models file.
export {
  countActivePaymentRequestFilters,
  filterPaymentRequests,
  paginatePaymentRequests,
  PAYMENT_REQUEST_PAGE_SIZE,
} from "@/features/finance/payment-request-directory-models";

export interface PaymentRequestDirectoryProps {
  /** Server-action override for the /dev preview; the real page passes nothing. */
  actions?: PaymentRequestActionOverrides;
  /**
   * The list's own path for its URL writes (the /dev preview passes `/dev/lists`
   * so a filter change stays on fixtures). Profile and create links always
   * point at the real routes.
   */
  basePath?: string;
  /** `payments.manage` */
  canCancelPaymentRequests?: boolean;
  /** `(payments.create_request || payments.manage) && students.view` (the /new page needs both). */
  canCreatePaymentRequests: boolean;
  /** `students.view`: student names open the profile. Default true. */
  canViewStudents?: boolean;
  items: PaymentRequestReadModel[];
  /** ISO timestamp of the server render, for "chờ quá 14 ngày" (the dashboard's threshold), so SSR and client agree. */
  now?: string;
  /** Vietnam business date `YYYY-MM-DD` from the server, so SSR and client agree on short dates. */
  today?: string;
}

/**
 * Payment-request list (design 16a): count line, status chips, filters (bar or
 * sheet), the loaded-rows money strip, a framed table (cards when narrow) and
 * pagers. Filtering is client-side over the rows the route loaded (newest
 * 1000); the state lives in the URL, written with `router.replace` (filters,
 * back to page 1) and `router.push` (pages). Inputs render local state so a
 * field never lags behind the navigation; a URL the page did not write itself
 * (Back/Forward, a link) wins.
 */
export function PaymentRequestDirectory({
  actions,
  basePath = PAYMENT_REQUEST_DIRECTORY_PATH,
  canCancelPaymentRequests = false,
  canCreatePaymentRequests,
  canViewStudents = true,
  items,
  now,
  today,
}: PaymentRequestDirectoryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [fallbackClock] = useState(() => ({ now: new Date().toISOString(), today: getVietnamToday() }));
  const businessToday = today ?? fallbackClock.today;
  const renderNow = now ?? fallbackClock.now;
  /**
   * "Đã hủy phiếu thu …" after a successful cancel: the row then turns "Đã hủy"
   * (or leaves a "Chờ thanh toán" list), taking its trigger and focus with it,
   * so the notice takes focus. Cleared by the next filter, page, chip or dialog.
   */
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  /** Set by a success; consumed once focus has moved to the notice. */
  const pendingNoticeFocusRef = useRef(false);

  const [viewState, setViewState] = useState<PaymentRequestDirectoryViewState>(() => parsePaymentRequestDirectoryViewState(searchParams));
  // Queries this page wrote that Next may not have applied yet, so their late arrival is not mistaken for Back/Forward.
  const [localQueries, setLocalQueries] = useState<readonly string[]>([]);
  // Compare query strings: useSearchParams may hand out a new object on every render.
  const urlQuery = searchParams.toString();
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (!localQueries.includes(urlQuery)) {
      setViewState(parsePaymentRequestDirectoryViewState(searchParams));
      setLocalQueries([]);
    } else if (localQueries.at(-1) === urlQuery) {
      setLocalQueries([]);
    }
  }
  // Event handlers merge onto the latest written state, even before the page re-renders.
  const latestStateRef = useRef(viewState);
  useEffect(() => {
    latestStateRef.current = viewState;
  }, [viewState]);
  // Runs after the dialog's own focus return (a layout effect of the same commit).
  useEffect(() => {
    if (!actionNotice || !pendingNoticeFocusRef.current) return;
    pendingNoticeFocusRef.current = false;
    noticeRef.current?.focus();
  }, [actionNotice]);

  const { filters, page } = viewState;
  const filteredItems = useMemo(() => filterPaymentRequests(items, filters), [filters, items]);
  const pagination = useMemo(() => paginatePaymentRequests(filteredItems, page), [filteredItems, page]);
  const summary = useMemo(() => summarizePaymentRequests(filteredItems), [filteredItems]);
  const chips = useMemo(() => buildPaymentRequestStatusChips(items, filters), [filters, items]);
  const activeFilterCount = countActivePaymentRequestFilters(filters);
  const hasNoData = items.length === 0;
  const isEmptyByFilter = !hasNoData && filteredItems.length === 0;
  const directoryQuery = getPaymentRequestDirectoryQuery(serializePaymentRequestDirectoryViewState(searchParams, viewState));
  const createHref = directoryQuery ? `/finance/payment-requests/new?${directoryQuery}` : "/finance/payment-requests/new";

  const clearActionNotice = () => {
    setActionNotice(null);
    pendingNoticeFocusRef.current = false;
  };
  const showCancelNotice = (item: PaymentRequestReadModel) => {
    setActionNotice(`Đã hủy phiếu thu ${item.publicCode}.`);
    pendingNoticeFocusRef.current = true;
  };
  const writeState = (state: PaymentRequestDirectoryViewState, mode: "push" | "replace") => {
    const href = getPaymentRequestDirectoryHref(searchParams, state, basePath);
    clearActionNotice();
    latestStateRef.current = state;
    setViewState(state);
    setLocalQueries((current) => [...current, href.split("?")[1] ?? ""]);
    if (mode === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };
  const updateFilter = (key: keyof PaymentRequestFiltersState, value: string) => {
    const nextFilters = mergePendingPaymentRequestFilter(latestStateRef.current.filters, filters, key, value);
    writeState({ filters: nextFilters, page: 1 }, "replace");
  };
  const resetFilters = () => writeState(resetPaymentRequestDirectoryViewState(), "replace");
  const updatePage = (nextPage: number) => writeState({ filters: latestStateRef.current.filters, page: nextPage }, "push");
  const selectChip = (chip: PaymentRequestStatusChip) => updateFilter("status", chip === "all" ? "" : chip);

  const emptyState = hasNoData ? (
    <TableState>
      <p className="text-body font-semibold text-text-strong">Chưa có yêu cầu thanh toán</p>
      <p className="text-secondary text-text-muted">Chưa có yêu cầu nạp học phí nào được tạo.</p>
    </TableState>
  ) : (
    <TableState>
      <p className="text-body font-semibold text-text-strong">Không tìm thấy yêu cầu</p>
      <p className="text-secondary text-text-muted">Không có yêu cầu thanh toán nào phù hợp với điều kiện đang chọn.</p>
      <Button className="mt-2 max-md:h-11" onClick={resetFilters} size="sm" variant="secondary">
        Xóa lọc
      </Button>
    </TableState>
  );

  const paginationProps = {
    itemLabel: "yêu cầu",
    onPageChange: updatePage,
    page: pagination.page,
    pageCount: pagination.pageCount,
    rangeEnd: pagination.end,
    rangeStart: pagination.start + 1,
    total: filteredItems.length,
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={canCreatePaymentRequests ? (
          <Link className={getButtonClassName({ className: "max-md:h-11" })} href={createHref}>
            Tạo yêu cầu
          </Link>
        ) : undefined}
        title="Yêu cầu thanh toán"
      >
        <p className="mt-1 text-secondary tabular-nums text-text-muted">
          {describePaymentRequestDirectoryContext(filteredItems.length, items.length)}
        </p>
      </PageHeader>

      <div className="payment-request-operational-work-area grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        {actionNotice ? (
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <QuickFilterChips
                chips={chips}
                className="max-md:[&_button]:h-11"
                // Status chips at 0 are disabled by the model; this keeps "Tất cả" clickable when a search matches nothing.
                disableEmpty={false}
                label="Lọc nhanh yêu cầu thanh toán"
                onChange={selectChip}
                value={getPaymentRequestStatusChipValue(filters)}
              />
              <FilterTrigger
                activeCount={activeFilterCount}
                className="payment-request-filter-trigger"
                onClick={() => setIsFilterSheetOpen(true)}
                ref={filterTriggerRef}
              />
            </div>
            <PaymentRequestFilters
              activeFilterCount={activeFilterCount}
              filters={filters}
              isSheetOpen={isFilterSheetOpen}
              onChange={updateFilter}
              onCloseSheet={() => setIsFilterSheetOpen(false)}
              onReset={resetFilters}
              resultCount={filteredItems.length}
              returnFocusRef={filterTriggerRef}
            />
          </>
        )}

        {/* Whenever rows are loaded (0 ₫ for a filter that matches nothing), so the page keeps its geometry. */}
        {hasNoData ? null : <PaymentRequestSummaryStrip summary={summary} />}

        <p aria-live="polite" className="sr-only">
          {hasNoData
            ? ""
            : isEmptyByFilter
              ? "0 yêu cầu khớp bộ lọc"
              : `Hiển thị ${pagination.start + 1}–${pagination.end} của ${filteredItems.length} yêu cầu`}
        </p>

        <PaymentRequestTable
          actions={actions}
          canCancel={canCancelPaymentRequests}
          canViewStudents={canViewStudents}
          empty={filteredItems.length === 0 ? emptyState : undefined}
          footer={filteredItems.length > 0 ? <Pagination label="Phân trang yêu cầu thanh toán" variant="frame" {...paginationProps} /> : undefined}
          items={pagination.items}
          listFooter={<Pagination label="Phân trang yêu cầu thanh toán (danh sách gọn)" {...paginationProps} />}
          now={renderNow}
          onCancelOpen={clearActionNotice}
          onCancelled={showCancelNotice}
          today={businessToday}
        />
      </div>
    </div>
  );
}

/** Money over the filtered loaded rows only (never a centre-wide figure). */
function PaymentRequestSummaryStrip({ summary }: { summary: PaymentRequestSummary }) {
  return (
    <section
      aria-label="Tóm tắt danh sách yêu cầu đang tải"
      className="overflow-hidden rounded-lg border border-border-subtle bg-border-subtle shadow-[var(--panel-shadow)]"
    >
      <dl className="grid grid-cols-1 gap-px @min-[560px]:grid-cols-3">
        <SummaryItem caption="Không gồm phiếu đã hủy, hết hạn" label="Phải thu" value={formatVnd(summary.expectedVnd)} />
        <SummaryItem label="Đã thu" value={formatVnd(summary.paidVnd)} />
        <SummaryItem caption="Trong danh sách yêu cầu đang tải" label="Còn chờ nhận" value={formatVnd(summary.outstandingVnd)} />
      </dl>
    </section>
  );
}

function SummaryItem({ caption, label, value }: { caption?: string; label: string; value: string }) {
  return (
    <div className="bg-surface-base px-4 py-2.5">
      <dt className="text-label text-text-muted">{label}</dt>
      <dd className="text-section-title font-semibold tabular-nums text-text-strong">{value}</dd>
      {caption ? <dd className="text-caption text-text-muted">{caption}</dd> : null}
    </div>
  );
}
