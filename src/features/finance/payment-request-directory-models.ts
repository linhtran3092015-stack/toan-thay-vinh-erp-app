import type { QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { PAYMENT_REQUEST_OVERDUE_DAYS } from "@/features/students/student-directory-metrics";
import { toVietnamDate } from "@/lib/datetime";
import { formatNumber, formatVnd } from "@/lib/format";
import { normalizeSearchText } from "@/lib/search";

import type { PaymentRequestFiltersState, PaymentRequestReadModel } from "./read-models";

/**
 * Pure helpers of the payment-request list (design 16a "Yêu cầu thanh toán").
 * Every number here is computed over the rows the route loaded: filters, chip
 * counts and the money strip never claim more than that list.
 */

export const PAYMENT_REQUEST_PAGE_SIZE = 20;

/** The route's denial title (no `payments.view`/`payments.manage`), shared with the /dev/lists preview. */
export const PAYMENT_REQUESTS_DENIED_TITLE = "Không có quyền xem yêu cầu thanh toán";

/**
 * Row cap of the list read: `getPaymentRequestsResult` in `data.ts` selects
 * `student_payment_requests` newest first with `.limit(1000)`. A list that holds
 * this many rows may be missing older requests, so the header says so.
 */
export const PAYMENT_REQUEST_LOAD_LIMIT = 1000;

export type PaymentRequestStatus = PaymentRequestReadModel["status"];
export type PaymentRequestStatusChip = "all" | PaymentRequestStatus;

/** The words of `PaymentRequestStatusBadge` (that component stays the badge's only source). */
export const paymentRequestStatusLabels: Record<PaymentRequestStatus, string> = {
  cancelled: "Đã hủy",
  expired: "Hết hạn",
  paid: "Đã thanh toán",
  partially_paid: "Thanh toán một phần",
  pending: "Chờ thanh toán",
};

/** Chip order; "Hết hạn" last and only when it has rows (nothing writes it today). */
const chipStatuses: readonly PaymentRequestStatus[] = ["pending", "partially_paid", "paid", "cancelled", "expired"];

const searchableFields = (item: PaymentRequestReadModel): string =>
  [item.publicCode, item.studentFullName, item.studentPublicCode, item.guardianFullName, item.guardianPhone, item.transferCode]
    .filter(Boolean)
    .join(" ");

/**
 * Vietnam business date of a creation timestamp. `createdAt.slice(0, 10)` would
 * be the UTC date: a request created at 01:00 on 10/08 in Vietnam is still
 * 09/08 in UTC.
 */
export function getPaymentRequestCreatedDate(createdAt: string): string {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? createdAt.slice(0, 10) : toVietnamDate(date);
}

/** Search, top-up type and created-date range: every filter except the status. */
function matchesNonStatusFilters(item: PaymentRequestReadModel, filters: PaymentRequestFiltersState, search: string): boolean {
  if (search && !normalizeSearchText(searchableFields(item)).includes(search)) return false;
  if (filters.topupType && item.topupType !== filters.topupType) return false;
  if (filters.createdFrom || filters.createdTo) {
    const createdDate = getPaymentRequestCreatedDate(item.createdAt);
    if (filters.createdFrom && createdDate < filters.createdFrom) return false;
    if (filters.createdTo && createdDate > filters.createdTo) return false;
  }
  return true;
}

export function filterPaymentRequests(items: PaymentRequestReadModel[], filters: PaymentRequestFiltersState): PaymentRequestReadModel[] {
  const search = normalizeSearchText(filters.search);
  return items.filter(
    (item) => matchesNonStatusFilters(item, filters, search) && (!filters.status || item.status === filters.status),
  );
}

/** 20 rows a page; an out-of-range page is clamped. `start` is 0-based, `end` the last shown row (1-based). */
export function paginatePaymentRequests(items: PaymentRequestReadModel[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAYMENT_REQUEST_PAGE_SIZE));
  const page = Math.min(Math.max(requestedPage, 1), pageCount);
  const start = (page - 1) * PAYMENT_REQUEST_PAGE_SIZE;
  const pageItems = items.slice(start, start + PAYMENT_REQUEST_PAGE_SIZE);
  return { end: start + pageItems.length, items: pageItems, page, pageCount, start };
}

/** The page is never a filter; a blank search is not one either (the URL drops it too). */
export function countActivePaymentRequestFilters(filters: PaymentRequestFiltersState): number {
  return [filters.search.trim(), filters.status, filters.topupType, filters.createdFrom, filters.createdTo].filter(Boolean).length;
}

export interface PaymentRequestSummary {
  /** Σ expected of requests still owed or settled: cancelled and expired are left out. */
  expectedVnd: number;
  /** Σ paid (a cancelled request has none: cancelling needs paid = 0). */
  paidVnd: number;
  /** Σ max(expected − paid, 0) of pending and partially paid requests. */
  outstandingVnd: number;
}

/** The loaded-rows strip "Phải thu · Đã thu · Còn chờ nhận". Never a centre-wide total. */
export function summarizePaymentRequests(items: readonly PaymentRequestReadModel[]): PaymentRequestSummary {
  const summary: PaymentRequestSummary = { expectedVnd: 0, outstandingVnd: 0, paidVnd: 0 };
  for (const item of items) {
    if (item.status !== "cancelled" && item.status !== "expired") summary.expectedVnd += item.expectedAmountVnd;
    summary.paidVnd += item.paidAmountVnd;
    if (item.status === "pending" || item.status === "partially_paid") {
      summary.outstandingVnd += Math.max(item.expectedAmountVnd - item.paidAmountVnd, 0);
    }
  }
  return summary;
}

/**
 * Status chips over the loaded rows that match the other filters (so a count
 * equals the rows its chip would show). A status chip at 0 is disabled unless
 * active; "Tất cả" always stays clickable so a status can be cleared.
 */
export function buildPaymentRequestStatusChips(
  items: readonly PaymentRequestReadModel[],
  filters: PaymentRequestFiltersState,
): QuickFilterChip<PaymentRequestStatusChip>[] {
  const search = normalizeSearchText(filters.search);
  const counts: Record<PaymentRequestStatus, number> = { cancelled: 0, expired: 0, paid: 0, partially_paid: 0, pending: 0 };
  let total = 0;
  for (const item of items) {
    if (!matchesNonStatusFilters(item, filters, search)) continue;
    total += 1;
    if (Object.hasOwn(counts, item.status)) counts[item.status] += 1;
  }

  return [
    { count: total, label: "Tất cả", value: "all" },
    ...chipStatuses
      .filter((status) => status !== "expired" || counts.expired > 0 || filters.status === "expired")
      .map((status) => ({
        count: counts[status],
        disabled: counts[status] === 0 && filters.status !== status,
        label: paymentRequestStatusLabels[status],
        value: status,
      })),
  ];
}

export function getPaymentRequestStatusChipValue(filters: PaymentRequestFiltersState): PaymentRequestStatusChip {
  return filters.status || "all";
}

/** Header context line: "{filtered}/{loaded} yêu cầu trong danh sách đã tải[ · chỉ gồm 1.000 yêu cầu mới nhất]". */
export function describePaymentRequestDirectoryContext(filteredCount: number, loadedCount: number): string {
  const base = `${filteredCount}/${loadedCount} yêu cầu trong danh sách đã tải`;
  return loadedCount >= PAYMENT_REQUEST_LOAD_LIMIT
    ? `${base} · chỉ gồm ${formatNumber(PAYMENT_REQUEST_LOAD_LIMIT)} yêu cầu mới nhất`
    : base;
}

export function getPaymentRequestTopupLabel(topupType: PaymentRequestReadModel["topupType"]): string {
  return topupType === "renewal" ? "Tái phí" : "Tuyển mới";
}

/** "+2 tặng": the slip's bonus sessions, or null without any. */
export function describePaymentRequestBonus(item: PaymentRequestReadModel): string | null {
  return item.bonusSessions > 0 ? `+${item.bonusSessions} tặng` : null;
}

/** "140.000 ₫/buổi": the slip's unit price (bonus sessions excluded), or null when unknown. */
export function describePaymentRequestUnitPrice(item: PaymentRequestReadModel): string | null {
  return item.calculatedUnitPriceVnd > 0 ? `${formatVnd(item.calculatedUnitPriceVnd)}/buổi` : null;
}

/** "+2 tặng", "140.000 ₫/buổi": bonus and unit price together (the card's one line), each omitted when absent. */
export function describePaymentRequestSessionExtras(item: PaymentRequestReadModel): string[] {
  return [describePaymentRequestBonus(item), describePaymentRequestUnitPrice(item)].filter((part): part is string => part !== null);
}

/** A short date-time that never breaks across lines ("16/10 09:40" with a no-break space). */
export function keepTogether(value: string): string {
  return value.replace(/ /g, "\u00a0");
}

/**
 * Money caption under "Đã thu": "Còn X" only while the request is still owed
 * (pending or partially paid; a cancelled request owes nothing), "Thừa X" when
 * more than expected arrived (overpay is allowed and becomes extra sessions).
 */
export function describePaymentRequestBalance(item: PaymentRequestReadModel): string | null {
  const difference = item.expectedAmountVnd - item.paidAmountVnd;
  if (difference > 0 && (item.status === "pending" || item.status === "partially_paid")) return `Còn ${formatVnd(difference)}`;
  if (difference < 0) return `Thừa ${formatVnd(-difference)}`;
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The app's only age rule for requests, with the dashboard's own threshold
 * (`payments_overdue`: status = 'pending' and created_at < now() - 14 days; the
 * same as `summarizeDirectoryDebt` on the students list): still pending more
 * than `PAYMENT_REQUEST_OVERDUE_DAYS` × 24h after creation. `nowMs` comes from
 * the server render (or one captured client clock) so SSR and hydration agree.
 * It is a caption, never the status "Hết hạn".
 */
export function isPaymentRequestOverdue(item: PaymentRequestReadModel, nowMs: number): boolean {
  if (item.status !== "pending") return false;
  const createdMs = Date.parse(item.createdAt);
  return !Number.isNaN(createdMs) && createdMs < nowMs - PAYMENT_REQUEST_OVERDUE_DAYS * DAY_MS;
}

export const PAYMENT_REQUEST_OVERDUE_CAPTION = `chờ quá ${PAYMENT_REQUEST_OVERDUE_DAYS} ngày`;

/** The RPC cancels only a pending request with nothing paid (a tuition-linked one is still refused by the server). */
export function canCancelPaymentRequest(item: PaymentRequestReadModel): boolean {
  return item.status === "pending" && item.paidAmountVnd === 0;
}
