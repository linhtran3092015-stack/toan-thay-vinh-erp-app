"use client";

import { Check, LoaderCircle, Square } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setFinanceOrderReviewAction } from "@/features/finance/actions/finance-actions";
import type { FinanceOrderActionOverrides } from "@/features/finance/finance-order-action-overrides";
import {
  formatFinanceDateTime,
  getFinanceOrderCostPresentation,
  getFinanceOrderSourceLabel,
  getFinanceOrderTypePresentation,
  getSettlementPeriodLabel,
  getSettlementPeriodRange,
  getSettlementPeriodShortLabel,
} from "@/features/finance/finance-order-presentation";
import {
  applyFinanceOrderReviewOverrides,
  buildFinanceOrderChips,
  buildFinanceOrderSettlement,
  countFinanceOrders,
  describeFinanceOrderReviewCaption,
  describeFinanceOrdersContext,
  describeFinanceOrderPeriodStatus,
  describeFinanceOrderReviewAnnouncement,
  describeFinanceOrdersEmpty,
  describeFinanceOrdersSummaryLabel,
  describeFinanceOrderSourceAndSale,
  describeFinanceOrderStudentCaption,
  describeOperatingCostCaption,
  describeOperatingCostFigure,
  describeSettlementIntro,
  FINANCE_ORDER_REVIEW_FAILED_LABEL,
  FINANCE_ORDER_REVIEW_STATE_LABEL,
  filterFinanceOrdersByChip,
  getFinanceOrderGuardianLabel,
  getFinanceOrderSaleLabel,
  paginateFinanceOrders,
  type FinanceOrderReviewChip,
  type FinanceOrderReviewOverrides,
  type FinanceOrderSettlementLine,
  type FinanceOrderSettlementView,
} from "@/features/finance/finance-orders-models";
import {
  countActiveFinanceOrdersFilters,
  FINANCE_ORDERS_PATH,
  getFinanceOrdersHref,
  isFinanceOrdersMonth,
  mergePendingFinanceOrdersFilter,
  resetFinanceOrdersFilters,
} from "@/features/finance/finance-orders-url-state";
import type {
  FinanceOrderFiltersState,
  FinanceOrderReadModel,
  FinanceOrdersDashboardReadModel,
} from "@/features/finance/read-models";
import { formatShortDateTime, getVietnamToday } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FinanceOrdersPageProps {
  /** Server-action override for the /dev preview; the real route passes nothing. */
  actions?: FinanceOrderActionOverrides;
  /** Where filter writes go; `/dev/lists` passes its own path so the preview never opens the real route. */
  basePath?: string;
  /** `payments.manage`: the review toggle (the action and the RPC check it again). */
  canReview: boolean;
  /** `students.view`: the student name links to `/students/{id}`. */
  canViewStudents?: boolean;
  dashboard: FinanceOrdersDashboardReadModel;
  /** Server-parsed URL filters; the RPC already applied them. */
  filters: FinanceOrderFiltersState;
  /** Vietnam business date `YYYY-MM-DD` from the server, so SSR and client agree on short dates. */
  today?: string;
}

const CAPTION = "Danh sách đơn hàng tài chính";
const NO_OVERRIDES: FinanceOrderReviewOverrides = {};
const PAGINATION_LABEL = "Phân trang đơn hàng";

/*
 * `.finance-orders-operational-work-area` is the container: the table shows
 * from 1042px (`globals.css`: the 1040px table floor + the frame's 2px border),
 * cards below it. The filter bar follows the same container through Tailwind
 * `@min-[…]` variants (one column under 640px, two up to the table switch, then
 * four capped tracks + "Xóa lọc"); phones get 44px controls. Class names are
 * spelled out in full so the scanner sees them.
 */
const FILTER_BAR_CLASS =
  "grid-cols-[minmax(0,1fr)] @min-[640px]:grid-cols-[repeat(2,minmax(0,1fr))] @min-[1042px]:grid-cols-[repeat(4,minmax(160px,240px))_auto] max-md:[&_button]:h-11 max-md:[&_input]:h-11 max-md:[&_select]:h-11";

/**
 * Finance orders (design 16a "Đơn hàng"): count header, server filters in the
 * URL (`router.replace`, so the server page re-runs the RPC), a thin summary
 * strip of server sums, the SB settlement table above the orders, local review
 * chips, and a framed table (cards when narrow) with the review toggle.
 * Nothing here sums money: every amount comes from the RPC.
 */
export function FinanceOrdersPage({
  actions,
  basePath = FINANCE_ORDERS_PATH,
  canReview,
  canViewStudents = false,
  dashboard,
  filters,
  today,
}: FinanceOrdersPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [fallbackToday] = useState(getVietnamToday);
  const businessToday = today ?? fallbackToday;
  const reviewAction = actions?.setFinanceOrderReview ?? setFinanceOrderReviewAction;

  const [isNavigating, startNavigation] = useTransition();
  /*
   * Filter writes not yet reflected in the URL: they drive the controls and are
   * the base for a second quick change (the props are stale until the server
   * answers). Cleared once the last written query lands, or when the URL moves
   * somewhere this page did not write (an outside link).
   */
  const [written, setWritten] = useState<{ filters: FinanceOrderFiltersState | null; queries: readonly string[] }>({
    filters: null,
    queries: [],
  });
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    if (!written.queries.includes(query) || written.queries.at(-1) === query) {
      setWritten({ filters: null, queries: [] });
    }
  }
  const pendingFilters = written.filters;
  const shownFilters = pendingFilters ?? filters;
  /** Text typed into a month field the browser shows as plain text (no month picker), until it is a real month. */
  const [monthDraft, setMonthDraft] = useState<string | null>(null);

  /*
   * Successful ticks, valid only against the dashboard they were made on. The
   * action revalidates /finance/orders, so a refreshed `dashboard` arrives with
   * the stored state (and `checkedAt`): from then on the server row wins, also
   * when another accountant changed it meanwhile.
   */
  const [review, setReview] = useState<{ base: FinanceOrdersDashboardReadModel; overrides: FinanceOrderReviewOverrides }>({
    base: dashboard,
    overrides: {},
  });
  if (review.base !== dashboard) {
    setReview({ base: dashboard, overrides: {} });
  }
  const reviewOverrides = review.base === dashboard ? review.overrides : NO_OVERRIDES;
  const [pendingReviews, setPendingReviews] = useState<Readonly<Record<string, true>>>({});
  /** Same ids as `pendingReviews`, readable in handlers before the next render (a double click). */
  const pendingReviewIds = useRef(new Set<string>());

  // Chip, page, kept rows and the last failed tick are local; a new query (server filters)
  // resets all but the chip.
  const filtersKey = [filters.month, filters.orderType, filters.source, filters.period].join("|");
  const [listState, setListState] = useState<{
    /** Polite status after a successful tick (the focused toggle only changes its name). */
    announcement: string | null;
    chip: FinanceOrderReviewChip;
    /** The last refused or failed tick: one alert above the chips plus a note in that row. */
    failure: { id: string; message: string } | null;
    keepIds: readonly string[];
    key: string;
    page: number;
  }>({ announcement: null, chip: "all", failure: null, keepIds: [], key: filtersKey, page: 1 });
  if (listState.key !== filtersKey) {
    setListState({ ...listState, announcement: null, failure: null, keepIds: [], key: filtersKey, page: 1 });
  }

  const rows = useMemo(
    () => applyFinanceOrderReviewOverrides(dashboard.orders, reviewOverrides),
    [dashboard.orders, reviewOverrides],
  );
  const counts = useMemo(() => countFinanceOrders(rows), [rows]);
  const visible = useMemo(
    () => filterFinanceOrdersByChip(rows, listState.chip, listState.keepIds),
    [listState.chip, listState.keepIds, rows],
  );
  const pagination = useMemo(() => paginateFinanceOrders(visible, listState.page), [listState.page, visible]);
  const chips = buildFinanceOrderChips(counts, listState.chip);
  const settlement = buildFinanceOrderSettlement({
    eligible: dashboard.settlementEligible,
    month: filters.month,
    orderType: filters.orderType,
    period: filters.period,
    rows,
    settlement: dashboard.settlement,
    today: businessToday,
  });
  const activeFilterCount = countActiveFinanceOrdersFilters(shownFilters);
  const hasOrders = dashboard.orders.length > 0;
  const costCaption = describeOperatingCostCaption(counts.unconfigured);
  // Type/source/period narrow the month: the header and the strip say so (the month alone is not a filter).
  const scope = { filtered: countActiveFinanceOrdersFilters(filters) > 0 };

  const writeFilters = (next: FinanceOrderFiltersState) => {
    const href = getFinanceOrdersHref(searchParams, next, basePath);
    setWritten((current) => ({ filters: next, queries: [...current.queries, href.slice(href.indexOf("?") + 1)] }));
    setListState((current) => (current.failure || current.announcement ? { ...current, announcement: null, failure: null } : current));
    startNavigation(() => router.replace(href, { scroll: false }));
  };
  const updateFilter = <K extends keyof FinanceOrderFiltersState>(key: K, value: FinanceOrderFiltersState[K]) => {
    writeFilters(mergePendingFinanceOrdersFilter(pendingFilters, filters, key, value));
  };
  const updateMonth = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (isFinanceOrdersMonth(value)) {
      setMonthDraft(null);
      updateFilter("month", value);
    } else {
      setMonthDraft(value);
    }
  };
  const resetFilters = () => writeFilters(resetFinanceOrdersFilters(pendingFilters ?? filters));
  const changeChip = (chip: FinanceOrderReviewChip) => {
    setListState({ announcement: null, chip, failure: null, keepIds: [], key: filtersKey, page: 1 });
  };
  const changePage = (page: number) => setListState((current) => ({ ...current, announcement: null, page }));

  const updateReview = async (order: FinanceOrderReadModel, isChecked: boolean) => {
    const id = order.sourceCashflowRecordId;
    if (pendingReviewIds.current.has(id)) return;
    pendingReviewIds.current.add(id);
    // The dashboard this tick was made on: a refresh that lands first already holds the result.
    const base = dashboard;
    const fail = (message: string) => setListState((current) => ({ ...current, failure: { id, message } }));
    setListState((current) => (current.failure || current.announcement ? { ...current, announcement: null, failure: null } : current));
    setPendingReviews((current) => ({ ...current, [id]: true }));
    try {
      const result = await reviewAction(id, isChecked);
      if (result.status === "success") {
        setReview((current) =>
          current.base === base ? { base, overrides: { ...current.overrides, [id]: isChecked } } : current,
        );
        // Under a review chip the row would leave the list and take the focused control with it: keep it.
        setListState((current) => ({
          ...current,
          announcement: describeFinanceOrderReviewAnnouncement(order.bankTransactionId, isChecked),
          keepIds: current.chip === "all" || current.keepIds.includes(id) ? current.keepIds : [...current.keepIds, id],
        }));
      } else {
        fail(result.message);
      }
    } catch {
      fail("Không thể cập nhật xác nhận đơn hàng. Vui lòng thử lại sau.");
    } finally {
      pendingReviewIds.current.delete(id);
      setPendingReviews((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const rowProps = (order: FinanceOrderReadModel): OrderRowProps => ({
    canReview,
    canViewStudents,
    // Only a successful tick on this page records `true` here.
    caption: describeFinanceOrderReviewCaption(order, {
      justChecked: Object.hasOwn(reviewOverrides, order.sourceCashflowRecordId) && reviewOverrides[order.sourceCashflowRecordId] === true,
      today: businessToday,
    }),
    failed: listState.failure?.id === order.sourceCashflowRecordId,
    isReviewPending: pendingReviews[order.sourceCashflowRecordId] === true,
    onReview: updateReview,
    order,
    today: businessToday,
  });

  const empty = describeFinanceOrdersEmpty({
    activeFilterCount: countActiveFinanceOrdersFilters(filters),
    chip: listState.chip,
    hasRows: hasOrders,
    month: filters.month,
  });
  const emptyState = (
    <TableState>
      <p className="text-body font-semibold text-text-strong">{empty.title}</p>
      <p className="max-w-xl text-secondary text-text-muted">{empty.description}</p>
      {empty.action ? (
        <Button
          className="mt-2 max-md:h-11"
          onClick={empty.action === "reset" ? resetFilters : () => changeChip("all")}
          size="sm"
          variant="secondary"
        >
          {empty.action === "reset" ? "Xóa lọc" : "Xem tất cả"}
        </Button>
      ) : null}
    </TableState>
  );

  const paginationProps = {
    itemLabel: "đơn",
    onPageChange: changePage,
    page: pagination.page,
    pageCount: pagination.pageCount,
    rangeEnd: pagination.end,
    rangeStart: pagination.start,
    total: visible.length,
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="Đơn hàng">
        <p className="mt-1 text-secondary tabular-nums text-text-muted">
          {describeFinanceOrdersContext(filters.month, counts, scope)}
        </p>
      </PageHeader>

      <div
        aria-busy={isNavigating || undefined}
        className="finance-orders-operational-work-area grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4"
      >
        <FilterBar
          activeCount={activeFilterCount}
          className={FILTER_BAR_CLASS}
          label="Bộ lọc đơn hàng"
          onReset={resetFilters}
        >
          <FilterField label="Tháng giao dịch">
            <FilterInput
              onBlur={() => setMonthDraft(null)}
              onChange={updateMonth}
              pattern="\d{4}-\d{2}"
              placeholder="VD: 2026-10"
              type="month"
              value={monthDraft ?? shownFilters.month}
            />
          </FilterField>
          <FilterField label="Loại đơn">
            <FilterSelect
              active={shownFilters.orderType !== ""}
              onChange={(event) => updateFilter("orderType", event.target.value as FinanceOrderFiltersState["orderType"])}
              value={shownFilters.orderType}
            >
              <option value="">Tất cả loại đơn</option>
              <option value="new_enrollment">Tuyển mới</option>
              <option value="renewal">Tái phí</option>
            </FilterSelect>
          </FilterField>
          <FilterField label="Nguồn">
            <FilterSelect
              active={shownFilters.source !== ""}
              onChange={(event) => updateFilter("source", event.target.value as FinanceOrderFiltersState["source"])}
              value={shownFilters.source}
            >
              <option value="">Tất cả nguồn</option>
              <option value="mma">MMA</option>
              <option value="sb">SB</option>
              <option value="sb_f1">SB F1</option>
            </FilterSelect>
          </FilterField>
          <FilterField label="Đợt quyết toán">
            <FilterSelect
              active={shownFilters.period !== ""}
              onChange={(event) => updateFilter("period", event.target.value as FinanceOrderFiltersState["period"])}
              value={shownFilters.period}
            >
              <option value="">Cả tháng</option>
              <option value="1">{getSettlementPeriodLabel(1)}</option>
              <option value="2">{getSettlementPeriodLabel(2)}</option>
              <option value="3">{getSettlementPeriodLabel(3)}</option>
            </FilterSelect>
          </FilterField>
        </FilterBar>

        <div
          className={cn(
            "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 transition-opacity",
            isNavigating && "opacity-60",
          )}
        >
          <SummaryStrip
            costCaption={costCaption}
            label={describeFinanceOrdersSummaryLabel(filters.month, scope)}
            figures={[
              { label: "Số đơn", value: String(dashboard.summary.orderCount) },
              { label: "Học phí", value: formatVnd(dashboard.summary.tuitionAmountVnd) },
              {
                label: "Chi phí vận hành",
                value: describeOperatingCostFigure(dashboard.summary.operatingCostVnd, counts),
                withCostCaption: true,
              },
              { label: "Chưa xác nhận", value: String(counts.unchecked) },
              { label: "Chưa cấu hình", tone: counts.unconfigured > 0 ? "warning" : undefined, value: String(counts.unconfigured) },
            ]}
          />

          <SettlementSection filteredByType={filters.orderType !== ""} view={settlement} />

          {listState.failure ? <ResultBanner title={listState.failure.message} tone="error" /> : null}

          {hasOrders ? (
            <QuickFilterChips
              chips={chips}
              className="max-md:[&_button]:h-11"
              label="Lọc nhanh đơn hàng"
              onChange={changeChip}
              value={listState.chip}
            />
          ) : null}

          <p className="sr-only" role="status">
            {listState.announcement}
          </p>
          <p aria-live="polite" className="sr-only">
            {isNavigating
              ? "Đang tải đơn hàng theo bộ lọc mới"
              : visible.length === 0
                ? "0 đơn"
                : `Hiển thị ${pagination.start}–${pagination.end} của ${visible.length} đơn`}
          </p>

          {visible.length === 0 ? (
            // Rendered once (no responsive twin), so the empty copy is announced and found once.
            <DataTableFrame
              body={null}
              caption={CAPTION}
              empty={emptyState}
              header={<OrderTableHeader />}
              status="empty"
              tableClassName={TABLE_CLASS}
            />
          ) : (
            <>
              <DataTableFrame
                body={pagination.rows.map((order) => (
                  <OrderTableRow key={order.sourceCashflowRecordId} {...rowProps(order)} />
                ))}
                caption={CAPTION}
                className="finance-orders-directory-table"
                footer={<Pagination label={PAGINATION_LABEL} variant="frame" {...paginationProps} />}
                header={<OrderTableHeader />}
                tableClassName={TABLE_CLASS}
              />
              <div className="finance-orders-directory-record-list min-w-0 gap-2">
                <ResponsiveRecordList label={CAPTION}>
                  {pagination.rows.map((order) => (
                    <OrderCard key={order.sourceCashflowRecordId} {...rowProps(order)} />
                  ))}
                </ResponsiveRecordList>
                <Pagination label={`${PAGINATION_LABEL} (danh sách gọn)`} {...paginationProps} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/*
 * Column widths at the 1040px floor (table-fixed): Giao dịch 164 · Học sinh 172 ·
 * Loại 104 · Nguồn 136 · Học phí 120 · Chi phí vận hành 136 · Đợt 76 · Xác nhận 132.
 */
const TABLE_CLASS = "min-w-[1040px] table-fixed";

function OrderTableHeader() {
  return (
    <tr>
      <TableHeaderCell className="w-[164px]">Giao dịch</TableHeaderCell>
      <TableHeaderCell className="w-[172px]">Học sinh</TableHeaderCell>
      <TableHeaderCell className="w-[104px]">Loại</TableHeaderCell>
      <TableHeaderCell className="w-[136px]">Nguồn</TableHeaderCell>
      <TableHeaderCell className="w-[120px]" numeric>
        Học phí
      </TableHeaderCell>
      <TableHeaderCell className="w-[136px]" numeric>
        Chi phí vận hành
      </TableHeaderCell>
      <TableHeaderCell className="w-[76px]">Đợt</TableHeaderCell>
      <TableHeaderCell className="w-[132px]">Xác nhận</TableHeaderCell>
    </tr>
  );
}

interface OrderRowProps {
  canReview: boolean;
  canViewStudents: boolean;
  /** Detail after the state word: "lúc …" or "vừa xác nhận". */
  caption: string | null;
  /** This row's last tick was refused or failed (the alert above the chips says why). */
  failed: boolean;
  isReviewPending: boolean;
  onReview: (order: FinanceOrderReadModel, isChecked: boolean) => void;
  order: FinanceOrderReadModel;
  today: string;
}

function OrderTableRow(props: OrderRowProps) {
  const { canViewStudents, order, today } = props;
  const type = getFinanceOrderTypePresentation(order.orderType);
  const cost = getFinanceOrderCostPresentation(order);
  const sourceLabel = getFinanceOrderSourceLabel(order);
  const studentCaption = describeFinanceOrderStudentCaption(order);
  const guardian = getFinanceOrderGuardianLabel(order);
  const sale = getFinanceOrderSaleLabel(order);

  return (
    <TableRow tall>
      <TableCell className="py-2">
        <span className="block font-medium tabular-nums text-text-strong" title={formatFinanceDateTime(order.transactionAt)}>
          {formatShortDateTime(order.transactionAt, today)}
        </span>
        <span
          className="block truncate font-mono text-caption font-semibold text-text-default"
          title={`${order.bankTransactionId} · tham chiếu ${order.referenceCode}`}
        >
          {order.bankTransactionId}
        </span>
        <span className="block truncate font-mono text-caption text-text-muted" title={order.transferContent}>
          {order.transferContent}
        </span>
      </TableCell>
      <TableCell className="py-2">
        <StudentName canViewStudents={canViewStudents} order={order} />
        <span className="block truncate text-caption tabular-nums text-text-muted" title={studentCaption}>
          {studentCaption}
        </span>
        <GuardianLine guardian={guardian} phone={order.guardianPhone} />
      </TableCell>
      <TableCell className="py-2">
        <Badge className="max-w-full whitespace-normal!" tone={type.tone}>
          {type.label}
        </Badge>
      </TableCell>
      <TableCell className="py-2">
        {/* The full source label is this element's own text, once on the page (pinned). */}
        <span className="block truncate text-text-default" title={sourceLabel}>
          {sourceLabel}
        </span>
        <span className="block truncate text-caption text-text-muted" title={sale}>
          Sale: {sale}
        </span>
      </TableCell>
      <TableCell className="font-semibold text-text-strong" numeric>
        {formatVnd(order.tuitionAmountVnd)}
      </TableCell>
      <TableCell className="py-2" numeric>
        <span className="block text-text-default">
          {order.operatingCostVnd === null ? "—" : formatVnd(order.operatingCostVnd)}
        </span>
        <Badge className="mt-1 max-w-full whitespace-normal!" title={cost.description} tone={cost.tone}>
          {cost.label}
        </Badge>
      </TableCell>
      <TableCell className="tabular-nums">
        <span title={getSettlementPeriodLabel(order.settlementPeriod)}>
          {getSettlementPeriodShortLabel(order.settlementPeriod)}
        </span>
      </TableCell>
      <TableCell className="py-2">
        <ReviewControl {...props} layout="table" />
      </TableCell>
    </TableRow>
  );
}

/** Non-link card (no order detail route); the student name links only with `students.view`. */
function OrderCard(props: OrderRowProps) {
  const { canViewStudents, order, today } = props;
  const type = getFinanceOrderTypePresentation(order.orderType);
  const cost = getFinanceOrderCostPresentation(order);

  return (
    <article
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <StudentName canViewStudents={canViewStudents} layout="card" order={order} />
          <p className="break-words text-secondary tabular-nums text-text-muted">
            {describeFinanceOrderStudentCaption(order)}
          </p>
          <GuardianLine className="text-secondary" guardian={getFinanceOrderGuardianLabel(order)} phone={order.guardianPhone} />
        </div>
        <Badge className="max-w-[45%] shrink-0 whitespace-normal!" tone={type.tone}>
          {type.label}
        </Badge>
      </div>

      <dl className="mt-2 grid gap-1 border-t border-border-row pt-2 text-secondary">
        <CardLine label="Giao dịch">
          <span className="tabular-nums" title={formatFinanceDateTime(order.transactionAt)}>
            {formatShortDateTime(order.transactionAt, today)}
          </span>
          {" · "}
          <span className="break-all font-mono text-caption font-semibold">{order.bankTransactionId}</span>
        </CardLine>
        {/* One string: the source label alone must stay the table cell's own text (pinned single). */}
        <CardLine label="Nguồn">{describeFinanceOrderSourceAndSale(order)}</CardLine>
        <CardLine label="Học phí">
          <strong className="font-semibold tabular-nums text-text-strong">{formatVnd(order.tuitionAmountVnd)}</strong>
        </CardLine>
        <CardLine label="Chi phí vận hành">
          <span className="tabular-nums">{order.operatingCostVnd === null ? "—" : formatVnd(order.operatingCostVnd)}</span>{" "}
          <Badge className="align-middle" title={cost.description} tone={cost.tone}>
            {cost.label}
          </Badge>
        </CardLine>
        <CardLine label="Đợt">{getSettlementPeriodLabel(order.settlementPeriod)}</CardLine>
        <CardLine label="Nội dung CK">
          <span className="font-mono text-caption">{order.transferContent}</span>
        </CardLine>
      </dl>

      <div className="mt-3 border-t border-border-row pt-2">
        <ReviewControl {...props} layout="card" />
      </div>
    </article>
  );
}

function CardLine({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-text-default">{children}</dd>
    </div>
  );
}

function StudentName({
  canViewStudents,
  layout = "table",
  order,
}: {
  canViewStudents: boolean;
  layout?: "card" | "table";
  order: FinanceOrderReadModel;
}) {
  // Table cells truncate with the full name in `title`; cards wrap the name instead.
  if (layout === "card") {
    const nameClassName = "min-w-0 break-words text-[15px] font-semibold leading-5 text-text-strong";
    if (!canViewStudents) return <span className={cn("block", nameClassName)}>{order.studentFullName}</span>;
    return (
      <Link
        aria-label={`Mở hồ sơ học viên ${order.studentFullName}`}
        // Cards are touch targets: 44px tall without moving the text.
        className="-my-3 flex min-h-11 max-w-full items-center rounded-sm text-text-strong! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        href={`/students/${order.studentId}`}
      >
        <span className={nameClassName}>{order.studentFullName}</span>
      </Link>
    );
  }

  if (!canViewStudents) {
    return (
      <span className="block truncate font-semibold text-text-strong" title={order.studentFullName}>
        {order.studentFullName}
      </span>
    );
  }

  return (
    <Link
      aria-label={`Mở hồ sơ học viên ${order.studentFullName}`}
      className="block max-w-full truncate rounded-sm font-semibold text-text-strong! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      href={`/students/${order.studentId}`}
      title={order.studentFullName}
    >
      {order.studentFullName}
    </Link>
  );
}

/** Guardian name and phone: the phone is its own element (searchable, pinned). */
function GuardianLine({ className, guardian, phone }: { className?: string; guardian: string; phone: string | null }) {
  return (
    <span className={cn("flex min-w-0 gap-1 text-caption text-text-muted", className)}>
      <span className="truncate" title={guardian}>
        {guardian}
      </span>
      <span aria-hidden="true">·</span>
      <span className="shrink-0 tabular-nums">{phone ?? "Chưa có SĐT"}</span>
    </span>
  );
}

/**
 * Review control. For `payments.manage`: an action button whose accessible name
 * says what a click does and flips with the state ("Xác nhận đơn {mã}" / "Bỏ
 * xác nhận đơn {mã}", pinned), so no aria-pressed. Its visible text "Xác nhận"
 * never changes; the state is in its colour and icon and in words in the
 * caption ("Đã xác nhận · lúc …"). Called directly (no confirm): it only
 * records that the accountant checked the order. While the tick is saved it
 * stays focusable (aria-disabled + aria-busy, clicks ignored) so keyboard focus
 * is not dropped. Never `primary`. Read-only viewers get a badge.
 */
function ReviewControl({
  canReview,
  caption,
  failed,
  isReviewPending,
  layout,
  onReview,
  order,
}: OrderRowProps & { layout: "card" | "table" }) {
  const wrapperClassName = layout === "card" ? "flex flex-wrap items-center gap-x-3 gap-y-1" : "grid justify-items-start gap-0.5";
  // Each part is its own span, so "lúc 16/08 09:30" is still a text of its own. The caption
  // binds "lúc" to the date (no-break space): a narrow cell wraps before it or between date and time.
  const detail = caption ? <span>{caption}</span> : null;

  if (!canReview) {
    return (
      <span className={wrapperClassName}>
        <Badge tone={order.isChecked ? "success" : "neutral"}>{order.isChecked ? "Đã xác nhận" : "Chưa xác nhận"}</Badge>
        {detail ? <span className="text-caption tabular-nums text-text-muted">{detail}</span> : null}
      </span>
    );
  }

  const Icon = order.isChecked ? Check : Square;

  return (
    <span className={wrapperClassName}>
      <Button
        aria-busy={isReviewPending || undefined}
        aria-disabled={isReviewPending || undefined}
        aria-label={`${order.isChecked ? "Bỏ xác nhận" : "Xác nhận"} đơn ${order.bankTransactionId}`}
        className={cn(
          layout === "card" && "h-11! px-4!",
          order.isChecked && "border-success-border! bg-success-bg! text-success! hover:border-success!",
          isReviewPending && "cursor-progress",
        )}
        onClick={() => {
          if (!isReviewPending) onReview(order, !order.isChecked);
        }}
        size="sm"
        variant="secondary"
      >
        {isReviewPending ? (
          <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" size={14} strokeWidth={2.25} />
        ) : (
          <Icon aria-hidden="true" size={14} strokeWidth={2.25} />
        )}
        Xác nhận
      </Button>
      {order.isChecked ? (
        <span className="text-caption tabular-nums text-text-muted">
          <span className="font-medium text-success">{FINANCE_ORDER_REVIEW_STATE_LABEL}</span>
          {detail ? <>{" · "}{detail}</> : null}
        </span>
      ) : null}
      {failed ? <span className="text-caption font-medium text-danger">{FINANCE_ORDER_REVIEW_FAILED_LABEL}</span> : null}
    </span>
  );
}

interface SummaryFigure {
  label: string;
  tone?: "warning";
  value: string;
  withCostCaption?: boolean;
}

/** Thin figures strip (not big cards): server sums for money, page counts for review and cost status. */
function SummaryStrip({
  costCaption,
  figures,
  label,
}: {
  costCaption: string | null;
  figures: readonly SummaryFigure[];
  label: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <dl aria-label={label} className="-ml-px -mt-px grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        {figures.map((figure) => (
          <div className="min-w-0 border-l border-t border-border-row px-4 py-2.5" key={figure.label}>
            <dt className="text-label text-text-muted">{figure.label}</dt>
            <dd
              className={cn(
                "mt-0.5 whitespace-nowrap text-section-title font-semibold tabular-nums",
                figure.tone === "warning" ? "text-warning" : "text-text-strong",
              )}
            >
              {figure.value}
            </dd>
            {figure.withCostCaption && costCaption ? (
              <dd className="text-caption text-warning">{costCaption}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

const SETTLEMENT_CAPTION = "Quyết toán chi phí vận hành SB theo đợt";

/** Rendered once (a small table that may scroll inside its frame on phones), above the orders. */
function SettlementSection({ filteredByType, view }: { filteredByType: boolean; view: FinanceOrderSettlementView }) {
  const empty =
    view.kind === "ineligible"
      ? { description: "Không có dữ liệu quyết toán SB khi lọc nguồn MMA hoặc SB F1.", title: "Không áp dụng quyết toán SB" }
      : { description: "Chưa có khoản thu SB phù hợp với bộ lọc hiện tại.", title: "Chưa có dữ liệu quyết toán SB" };

  return (
    <section aria-labelledby="finance-orders-settlement-title" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      <div>
        <h2 className="text-section-title font-semibold text-text-strong" id="finance-orders-settlement-title">
          Quyết toán chi phí vận hành SB
        </h2>
        <p className="mt-0.5 text-secondary text-text-muted">{describeSettlementIntro({ filtered: filteredByType })}</p>
      </div>
      <DataTableFrame
        body={view.kind === "rows" ? view.rows.map((line) => <SettlementRow key={line.period} line={line} />) : null}
        caption={SETTLEMENT_CAPTION}
        empty={
          <TableState className="py-6">
            <p className="text-body font-semibold text-text-strong">{empty.title}</p>
            <p className="max-w-xl text-secondary text-text-muted">{empty.description}</p>
          </TableState>
        }
        footer={
          view.kind === "rows" ? (
            <p>Xác nhận chỉ ghi dấu kế toán đã kiểm tra, chưa phải chốt quyết toán.</p>
          ) : undefined
        }
        header={
          <tr>
            <TableHeaderCell className="w-[180px]">Đợt</TableHeaderCell>
            <TableHeaderCell className="w-[104px]" numeric>
              Tuyển mới
            </TableHeaderCell>
            <TableHeaderCell className="w-[96px]" numeric>
              Tái phí
            </TableHeaderCell>
            <TableHeaderCell className="w-[150px]" numeric>
              Học phí
            </TableHeaderCell>
            <TableHeaderCell className="w-[160px]" numeric>
              Chi phí vận hành
            </TableHeaderCell>
            <TableHeaderCell>Xác nhận</TableHeaderCell>
          </tr>
        }
        status={view.kind === "rows" ? "ready" : "empty"}
        tableClassName="min-w-[840px] table-fixed"
      />
    </section>
  );
}

function SettlementRow({ line }: { line: FinanceOrderSettlementLine }) {
  const { period, status, values } = line;
  const note = describeFinanceOrderPeriodStatus(status);
  // A period that has not started, or a type the Loại đơn filter left out, is not a zero.
  const missing = <span className="text-text-muted">—</span>;

  return (
    <TableRow tall={note !== null}>
      <TableCell className={note ? "py-2" : undefined}>
        <span className="font-medium text-text-strong">{getSettlementPeriodShortLabel(period)}</span>{" "}
        <span className="text-caption tabular-nums text-text-muted">{getSettlementPeriodRange(period)}</span>
        {note ? (
          <span className={cn("block text-caption", status === "current" ? "text-info" : "text-text-muted")}>{note}</span>
        ) : null}
      </TableCell>
      <TableCell numeric>{line.newEnrollmentCount ?? missing}</TableCell>
      <TableCell numeric>{line.renewalCount ?? missing}</TableCell>
      <TableCell className="font-semibold text-text-strong" numeric>
        {values ? formatVnd(values.tuitionAmountVnd) : missing}
      </TableCell>
      <TableCell numeric>{line.operatingCostLabel ?? missing}</TableCell>
      <TableCell className="tabular-nums">
        {values ? `${values.checkedCount} đã · ${values.uncheckedCount} chưa` : missing}
        {values && values.unconfiguredCount > 0 ? (
          <span className="text-warning">{` · ${values.unconfiguredCount} chưa cấu hình`}</span>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
