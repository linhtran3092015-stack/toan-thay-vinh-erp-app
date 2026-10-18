import type { QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { formatMonth, formatShortDateTime } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";

import {
  getFinanceOrderSourceLabel,
  getSettlementPeriodRange,
  getSettlementPeriodShortLabel,
} from "./finance-order-presentation";
import type {
  FinanceOrderFiltersState,
  FinanceOrderReadModel,
  FinanceOrderSettlementReadModel,
} from "./read-models";

/**
 * Pure helpers for /finance/orders (design 16a row "Đơn hàng"). The RPC
 * `get_finance_orders_dashboard` returns the whole filtered month (no row cap),
 * so counts over the loaded rows are exact. Money stays server-side: the strip
 * and the settlement table show the RPC's `summary`/`settlement` sums and this
 * file adds none. Review counts are derived from the rows with the page's
 * local review overrides applied: a tick is shown at once, before the
 * revalidated dashboard (which carries the server counts) lands.
 * No server-only or browser imports.
 */

export const FINANCE_ORDERS_PAGE_SIZE = 20;
export const FINANCE_ORDER_PERIODS = [1, 2, 3] as const;

export type FinanceOrderPeriod = (typeof FINANCE_ORDER_PERIODS)[number];

/**
 * The route's gate and denial (the RPC itself checks `finance.view`), shared
 * with the /dev/lists preview so both show the same copy. A Next page file
 * may not export extra names, so it lives here.
 */
export const FINANCE_ORDERS_ACCESS = {
  permission: "finance.view",
  deniedTitle: "Không có quyền xem Đơn hàng",
} as const;
export type FinanceOrderReviewChip = "all" | "unchecked" | "checked" | "unconfigured";
/**
 * Successful client ticks keyed by `sourceCashflowRecordId`. They only bridge
 * the window before the revalidated dashboard lands and are discarded with it:
 * the refreshed server row (with `checkedAt`) then wins.
 */
export type FinanceOrderReviewOverrides = Readonly<Record<string, boolean>>;

/** Same rule as `getFinanceOrderCostPresentation`: never present a missing cost as 0. */
export function isFinanceOrderUnconfigured(
  order: Pick<FinanceOrderReadModel, "operatingCostStatus" | "operatingCostVnd">,
): boolean {
  return order.operatingCostStatus === "unconfigured" || order.operatingCostVnd === null;
}

/** Rows as the viewer last left them: `Object.hasOwn`, so an id like `constructor` never reads the prototype. */
export function applyFinanceOrderReviewOverrides(
  orders: readonly FinanceOrderReadModel[],
  overrides: FinanceOrderReviewOverrides,
): FinanceOrderReadModel[] {
  return orders.map((order) => {
    const id = order.sourceCashflowRecordId;
    if (!Object.hasOwn(overrides, id) || overrides[id] === order.isChecked) return order;
    return { ...order, isChecked: overrides[id] };
  });
}

export interface FinanceOrderCounts {
  checked: number;
  total: number;
  unchecked: number;
  unconfigured: number;
}

export function countFinanceOrders(rows: readonly FinanceOrderReadModel[]): FinanceOrderCounts {
  let checked = 0;
  let unconfigured = 0;
  for (const row of rows) {
    if (row.isChecked) checked += 1;
    if (isFinanceOrderUnconfigured(row)) unconfigured += 1;
  }
  return { checked, total: rows.length, unchecked: rows.length - checked, unconfigured };
}

const chipLabels: Record<FinanceOrderReviewChip, string> = {
  all: "Tất cả",
  checked: "Đã xác nhận",
  unchecked: "Chưa xác nhận",
  unconfigured: "Chưa cấu hình",
};

const chipOrder: readonly FinanceOrderReviewChip[] = ["all", "unchecked", "checked", "unconfigured"];

/** "Tất cả" always; another chip only with a count or while it is the active one. */
export function buildFinanceOrderChips(
  counts: FinanceOrderCounts,
  active: FinanceOrderReviewChip,
): QuickFilterChip<FinanceOrderReviewChip>[] {
  const countOf: Record<FinanceOrderReviewChip, number> = {
    all: counts.total,
    checked: counts.checked,
    unchecked: counts.unchecked,
    unconfigured: counts.unconfigured,
  };

  return chipOrder
    .filter((value) => value === "all" || value === active || countOf[value] > 0)
    .map((value) => ({ count: countOf[value], label: chipLabels[value], value }));
}

function matchesChip(row: FinanceOrderReadModel, chip: FinanceOrderReviewChip): boolean {
  switch (chip) {
    case "all":
      return true;
    case "checked":
      return row.isChecked;
    case "unchecked":
      return !row.isChecked;
    case "unconfigured":
      return isFinanceOrderUnconfigured(row);
  }
}

/**
 * Keeps the server order. `keepIds` are rows ticked under the active chip: they
 * stay in place ("vừa xác nhận", then the stored time once the dashboard is
 * refreshed) until the chip or the query changes, so the control the viewer
 * just used does not vanish and take focus with it.
 */
export function filterFinanceOrdersByChip(
  rows: readonly FinanceOrderReadModel[],
  chip: FinanceOrderReviewChip,
  keepIds: readonly string[] = [],
): FinanceOrderReadModel[] {
  if (chip === "all") return [...rows];
  return rows.filter((row) => matchesChip(row, chip) || keepIds.includes(row.sourceCashflowRecordId));
}

export function paginateFinanceOrders<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize = FINANCE_ORDERS_PAGE_SIZE,
) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, rows.length);

  return { end, page, pageCount, rows: rows.slice((page - 1) * pageSize, page * pageSize), start };
}

/** Where a period stands on the business clock: finished, running (up to today) or not started. */
export type FinanceOrderPeriodStatus = "closed" | "current" | "upcoming";

function getPeriodOfDay(day: number): FinanceOrderPeriod {
  return day <= 10 ? 1 : day <= 20 ? 2 : 3;
}

/**
 * Status of `period` in `month` (`YYYY-MM`) against `today` (Vietnam
 * `YYYY-MM-DD`): a past month is closed, a future month has not started, and
 * in the current month the period holding today is still running.
 */
export function getFinanceOrderPeriodStatus(
  month: string,
  period: FinanceOrderPeriod,
  today: string,
): FinanceOrderPeriodStatus {
  const currentMonth = today.slice(0, 7);
  if (month < currentMonth) return "closed";
  if (month > currentMonth) return "upcoming";
  const todayPeriod = getPeriodOfDay(Number(today.slice(8, 10)));
  return period < todayPeriod ? "closed" : period === todayPeriod ? "current" : "upcoming";
}

const periodStatusNotes: Record<FinanceOrderPeriodStatus, string | null> = {
  closed: null,
  current: "đang diễn ra (đến hôm nay)",
  upcoming: "chưa tới",
};

export function describeFinanceOrderPeriodStatus(status: FinanceOrderPeriodStatus): string | null {
  return periodStatusNotes[status];
}

export interface FinanceOrderSettlementLine {
  /** Null when a Loại đơn filter leaves this type out (filtered out, not zero) or with `values`. */
  newEnrollmentCount: number | null;
  /** The period's cost sum with the strip's rule ("—" when none of its SB orders has a configured cost); null with `values`. */
  operatingCostLabel: string | null;
  period: FinanceOrderPeriod;
  /** Null when a Loại đơn filter leaves this type out (filtered out, not zero) or with `values`. */
  renewalCount: number | null;
  status: FinanceOrderPeriodStatus;
  /** Null for a period that has not started and has no SB order: drawn as "—", not as a closed zero. */
  values: FinanceOrderSettlementReadModel | null;
}

export type FinanceOrderSettlementView =
  /** Source filter MMA or SB F1: SB settlement does not apply (`settlementEligible` false). */
  | { kind: "ineligible" }
  /** No SB order under the current filters. */
  | { kind: "empty" }
  | { kind: "rows"; rows: FinanceOrderSettlementLine[] };

/**
 * Settlement rows for the table above the orders. Money, type counts and the
 * unconfigured count are the RPC's (SB rows only); the checked/unchecked split
 * is recounted from the SB rows with overrides, like the summary strip.
 * Without a period filter every period is drawn: a finished period with no SB
 * order is a real zero, the running one is marked as such, and one that has
 * not started is "—" (not a zero). With a period filter, only that period: the
 * others were filtered out, not zero. The RPC builds the settlement from orders
 * already narrowed by Loại đơn, so under a type filter the other type's count
 * is filtered out ("—"), not zero.
 */
export function buildFinanceOrderSettlement({
  eligible,
  month,
  orderType = "",
  period,
  rows,
  settlement,
  today,
}: {
  eligible: boolean;
  month: string;
  orderType?: FinanceOrderFiltersState["orderType"];
  period: FinanceOrderFiltersState["period"];
  rows: readonly FinanceOrderReadModel[];
  settlement: readonly FinanceOrderSettlementReadModel[];
  today: string;
}): FinanceOrderSettlementView {
  if (!eligible) return { kind: "ineligible" };
  if (settlement.length === 0) return { kind: "empty" };

  const periods: readonly FinanceOrderPeriod[] = period ? [Number(period) as FinanceOrderPeriod] : FINANCE_ORDER_PERIODS;
  const byPeriod = new Map(settlement.map((row) => [row.period, row]));

  return {
    kind: "rows",
    rows: periods.map((value) => {
      const status = getFinanceOrderPeriodStatus(month, value, today);
      const server = byPeriod.get(value);
      if (!server && status === "upcoming") {
        return { newEnrollmentCount: null, operatingCostLabel: null, period: value, renewalCount: null, status, values: null };
      }
      const sbRows = rows.filter((row) => row.sourceCode === "sb" && row.settlementPeriod === value);
      const counts = countFinanceOrders(sbRows);
      const values = { ...(server ?? zeroSettlement(value)), checkedCount: counts.checked, uncheckedCount: counts.unchecked };
      return {
        newEnrollmentCount: orderType === "renewal" ? null : values.newEnrollmentCount,
        operatingCostLabel: describeOperatingCostFigure(values.operatingCostVnd, counts),
        period: value,
        renewalCount: orderType === "new_enrollment" ? null : values.renewalCount,
        status,
        values,
      };
    }),
  };
}

function zeroSettlement(period: FinanceOrderPeriod): FinanceOrderSettlementReadModel {
  return {
    checkedCount: 0,
    newEnrollmentCount: 0,
    operatingCostVnd: 0,
    period,
    renewalCount: 0,
    tuitionAmountVnd: 0,
    uncheckedCount: 0,
    unconfiguredCount: 0,
  };
}

/**
 * "Chỉ tính đơn nguồn SB · Đợt 1: 01–10 · Đợt 2: 11–20 · Đợt 3: 21–cuối tháng.",
 * with "· theo bộ lọc" after the source when a Loại đơn filter narrows the sums.
 */
export function describeSettlementIntro({ filtered = false }: { filtered?: boolean } = {}): string {
  const periods = FINANCE_ORDER_PERIODS.map(
    (period) => `${getSettlementPeriodShortLabel(period)}: ${getSettlementPeriodRange(period)}`,
  );
  return `Chỉ tính đơn nguồn SB${filtered ? " · theo bộ lọc" : ""} · ${periods.join(" · ")}.`;
}

/** "Tháng 08/2026", plus "· theo bộ lọc" when a type/source/period filter narrows the month. */
function describeFinanceOrdersScope(month: string, filtered: boolean): string {
  return filtered ? `Tháng ${formatMonth(month)} · theo bộ lọc` : `Tháng ${formatMonth(month)}`;
}

/**
 * Header line: "Tháng 08/2026 · 12 đơn · 3 chưa xác nhận · 1 chưa cấu hình"
 * ("Tháng 08/2026 · theo bộ lọc · …" under filters, so it never reads as the
 * whole month). Counts only.
 */
export function describeFinanceOrdersContext(
  month: string,
  counts: FinanceOrderCounts,
  { filtered = false }: { filtered?: boolean } = {},
): string {
  return `${describeFinanceOrdersScope(month, filtered)} · ${counts.total} đơn · ${counts.unchecked} chưa xác nhận · ${counts.unconfigured} chưa cấu hình`;
}

/** Accessible name of the summary strip, scoped like the header line. */
export function describeFinanceOrdersSummaryLabel(month: string, { filtered = false }: { filtered?: boolean } = {}): string {
  return `Tóm tắt đơn hàng ${describeFinanceOrdersScope(month, filtered).toLocaleLowerCase("vi")}`;
}

/** The server cost sum skips unconfigured orders: say so instead of implying they cost 0. */
export function describeOperatingCostCaption(unconfigured: number): string | null {
  return unconfigured > 0 ? `chưa gồm ${unconfigured} đơn chưa cấu hình` : null;
}

/**
 * Strip value for the server cost sum: "—" when no order in view has a
 * configured cost (e.g. only SB F1), since the sum then covers nothing; a real
 * 0 (MMA Tái phí) stays "0 ₫" as soon as one configured order is in view.
 */
export function describeOperatingCostFigure(operatingCostVnd: number, counts: FinanceOrderCounts): string {
  return counts.total > 0 && counts.unconfigured === counts.total ? "—" : formatVnd(operatingCostVnd);
}

/** Polite status after a successful tick: the focused toggle only changes its name, which is not announced. */
export function describeFinanceOrderReviewAnnouncement(bankTransactionId: string, isChecked: boolean): string {
  return isChecked ? `Đã xác nhận đơn ${bankTransactionId}.` : `Đã bỏ xác nhận đơn ${bankTransactionId}.`;
}

/** Visible state word beside the toggle (its text "Xác nhận" never changes) and the row's failure note. */
export const FINANCE_ORDER_REVIEW_STATE_LABEL = "Đã xác nhận";
/** The alert above the chips carries the reason; a refusal is not fixed by retrying, so no "thử lại". */
export const FINANCE_ORDER_REVIEW_FAILED_LABEL = "Không lưu được";

/**
 * Detail after the state word: the stored time when known, "vừa xác nhận"
 * after a tick on this page that the refreshed dashboard has not confirmed yet
 * (the action returns no time), nothing otherwise.
 */
export function describeFinanceOrderReviewCaption(
  order: Pick<FinanceOrderReadModel, "checkedAt" | "isChecked">,
  { justChecked, today }: { justChecked: boolean; today: string },
): string | null {
  if (!order.isChecked) return null;
  if (justChecked) return "vừa xác nhận";
  // No-break space: "lúc" stays with the date; a narrow cell wraps before it or between date and time.
  return order.checkedAt ? `lúc\u00a0${formatShortDateTime(order.checkedAt, today)}` : null;
}

export function getFinanceOrderClassLabel(order: Pick<FinanceOrderReadModel, "classCode" | "className">): string {
  return order.className ? `${order.classCode ?? ""} ${order.className}`.trim() : "Chưa xác định";
}

/** "HV001 · 7A Toán 7A" */
export function describeFinanceOrderStudentCaption(
  order: Pick<FinanceOrderReadModel, "classCode" | "className" | "studentPublicCode">,
): string {
  return `${order.studentPublicCode} · ${getFinanceOrderClassLabel(order)}`;
}

export function getFinanceOrderGuardianLabel(order: Pick<FinanceOrderReadModel, "guardianFullName">): string {
  return order.guardianFullName ?? "Phụ huynh chưa xác định";
}

export function getFinanceOrderSaleLabel(order: Pick<FinanceOrderReadModel, "saleOwnerFullName">): string {
  return order.saleOwnerFullName ?? "Chưa xác định";
}

/**
 * Card value "SB F1 · CTV F1 · Sale Trần Hải" as ONE string: the source label
 * alone is the table cell's own text and is pinned as a single element.
 */
export function describeFinanceOrderSourceAndSale(
  order: Pick<FinanceOrderReadModel, "leadSourceName" | "saleOwnerFullName" | "sourceLabel">,
): string {
  return `${getFinanceOrderSourceLabel(order)} · Sale ${getFinanceOrderSaleLabel(order)}`;
}

export interface FinanceOrdersEmptyCopy {
  /** "reset": clear the server filters; "all": back to the "Tất cả" chip. */
  action: "all" | "reset" | null;
  description: string;
  title: string;
}

/** In-frame empty state: no order in the month, none under the filters, or none under the chip. */
export function describeFinanceOrdersEmpty({
  activeFilterCount,
  chip,
  hasRows,
  month,
}: {
  activeFilterCount: number;
  chip: FinanceOrderReviewChip;
  hasRows: boolean;
  month: string;
}): FinanceOrdersEmptyCopy {
  if (hasRows && chip !== "all") {
    return {
      action: "all",
      description: "Các đơn khác của tháng vẫn có trong “Tất cả”.",
      title: `Không có đơn ${chipLabels[chip].toLocaleLowerCase("vi")}`,
    };
  }
  if (activeFilterCount > 0) {
    return {
      action: "reset",
      description: "Không có khoản thu học phí khớp với bộ lọc này.",
      title: "Chưa có đơn hàng",
    };
  }
  return {
    action: null,
    description: `Chưa có khoản thu học phí nào trong tháng ${formatMonth(month)}.`,
    title: "Chưa có đơn hàng",
  };
}
