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
