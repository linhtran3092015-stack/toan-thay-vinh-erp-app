import type { SepayTransactionReadModel } from "./read-models";

export type SepayAccountPurposeFilter = "" | SepayTransactionReadModel["accountPurpose"];

const validPurposes = new Set(["new_enrollment", "renewal", "unknown"]);

export function parseSepayAccountPurposeFilter(value: string | string[] | undefined): SepayAccountPurposeFilter {
  if (typeof value !== "string" || !validPurposes.has(value)) return "";
  return value as SepayAccountPurposeFilter;
}

export function getSepayAccountPurposeQuery(purpose: SepayAccountPurposeFilter): string {
  return purpose ? `?accountPurpose=${purpose}` : "";
}

/** Transactions still waiting for an accountant decision. */
export const SEPAY_REVIEW_MATCH_STATUSES = [
  "unmatched",
  "amount_mismatch",
  "account_purpose_mismatch",
  "identity_conflict",
] as const;

export type SepayQueueFilter = "" | "review";

export function parseSepayQueueFilter(value: string | string[] | undefined): SepayQueueFilter {
  return value === "review" ? "review" : "";
}

/** Query string for the SePay directory keeping both filters. */
export function getSepayDirectoryQuery(purpose: SepayAccountPurposeFilter, queue: SepayQueueFilter, page = 1): string {
  const params = new URLSearchParams();
  if (purpose) params.set("accountPurpose", purpose);
  if (queue) params.set("queue", queue);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export type SepayReviewMatchStatus = (typeof SEPAY_REVIEW_MATCH_STATUSES)[number];
/** "" = every status in the review queue. */
export type SepayReviewStatusFilter = "" | SepayReviewMatchStatus;

const reviewStatuses = new Set<string>(SEPAY_REVIEW_MATCH_STATUSES);

/** `?status=` inside "Cần xử lý": narrows the loaded queue rows client-side. */
export function parseSepayReviewStatusFilter(value: string | string[] | undefined): SepayReviewStatusFilter {
  return typeof value === "string" && reviewStatuses.has(value) ? (value as SepayReviewMatchStatus) : "";
}

/** `?tx=` selected queue transaction; ids are uuids, anything else is ignored. */
export function parseSepaySelectedTransactionId(value: string | string[] | undefined): string {
  return typeof value === "string" && /^[0-9a-f-]{1,64}$/i.test(value) ? value : "";
}

/**
 * Rewrites only `status` and `tx` on an existing query string, keeping every
 * other parameter (accountPurpose, queue, page, and the /dev/sepay preview's
 * own role/state). Empty values are removed.
 */
export function withSepayReviewSelection(
  search: string,
  { status, transactionId }: { status: SepayReviewStatusFilter; transactionId: string },
): string {
  const params = new URLSearchParams(search);
  if (status) params.set("status", status);
  else params.delete("status");
  if (transactionId) params.set("tx", transactionId);
  else params.delete("tx");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Per-status counts of the review queue, only when every queue row is loaded
 * (one page holds the whole queue). A partial page would give counts that look
 * like totals but are not, so the caller hides the status chips instead.
 */
export function getSepayReviewStatusCounts(
  transactions: readonly Pick<SepayTransactionReadModel, "matchStatus">[],
  total: number,
): Record<SepayReviewMatchStatus, number> | null {
  if (transactions.length < total) return null;
  const counts = Object.fromEntries(SEPAY_REVIEW_MATCH_STATUSES.map((status) => [status, 0])) as Record<SepayReviewMatchStatus, number>;
  for (const transaction of transactions) {
    if (reviewStatuses.has(transaction.matchStatus)) counts[transaction.matchStatus as SepayReviewMatchStatus] += 1;
  }
  return counts;
}

/** Selected queue row: the requested id when it is in the visible rows, else the first row. */
export function resolveSepayQueueSelection<T extends { id: string }>(rows: readonly T[], requestedId: string): T | null {
  return rows.find((row) => row.id === requestedId) ?? rows[0] ?? null;
}
