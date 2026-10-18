import type { BadgeTone } from "@/components/ui/badge";
import { formatVnd } from "@/lib/format";

import { defaultPaymentRequestFilters, getPaymentRequestDirectoryHref } from "./payment-request-url-state";

/**
 * Pure presentation rules for the center session ledger (/finance/session-ledger).
 * The page is a read-only audit of the existing read: no filters, totals or
 * actions are derived here.
 */

/** `getCenterSessionLedgerEntriesResult` reads the newest rows by `created_at` with `.limit(100)` (data.ts). */
export const SESSION_LEDGER_ENTRY_LIMIT = 100;

const entryTypeLabels: Record<string, string> = {
  annual_carryover: "Kết chuyển năm",
  bonus_credit: "Thưởng buổi",
  manual_adjustment: "Điều chỉnh thủ công",
  payment_credit: "Nạp học phí",
  refund_debit: "Hoàn phí",
  session_charge: "Trừ buổi học",
  session_reversal: "Đảo trừ",
  transfer_in: "Chuyển buổi đến",
  transfer_out: "Chuyển buổi đi",
};

/** Finance-local event wording. A ledger event is not a balance or lifecycle status. */
export function getLedgerEntryLabel(entryType: string): string {
  return Object.hasOwn(entryTypeLabels, entryType)
    ? entryTypeLabels[entryType]
    : `Loại phát sinh chưa hỗ trợ: ${entryType}`;
}

const entryTypeTones: Record<string, BadgeTone> = {
  bonus_credit: "info",
  manual_adjustment: "warning",
  payment_credit: "success",
  session_reversal: "info",
};

/**
 * Badge family per event. Every debit (`session_charge`, `refund_debit`,
 * `transfer_out`), the other credits and unsupported types stay neutral: a
 * debit is routine history, never an error, so no event is `danger`.
 */
export function getLedgerEntryTone(entryType: string): BadgeTone {
  return Object.hasOwn(entryTypeTones, entryType) ? entryTypeTones[entryType] : "neutral";
}

/** `+3 buổi` / `-1 buổi`: integer sessions with an ASCII hyphen-minus (the sign is the text). */
export function formatDeltaSessions(value: number): string {
  return `${value > 0 ? "+" : ""}${value} buổi`;
}

/** The loader turns a null `unit_price_vnd` into 0 (`Number(null)`), so zero or less reads "—". */
export function formatLedgerUnitPrice(value: number): string {
  return value > 0 ? formatVnd(value) : "—";
}

/**
 * Only a payment-request code (`PAY-YYMMDD-…`) can open the payment-request
 * list, filtered by its existing `search` URL param. `ALLOC-…` (manual SePay
 * allocation), `REV-…` (allocation reversal) and `OPENING-BALANCE-…` (import)
 * codes have no screen to open.
 */
export function getLedgerPaymentRequestHref(referenceCode: string | null): string | null {
  if (!referenceCode?.startsWith("PAY-")) return null;
  // Through the payment-request list's own URL contract (path + `search` param).
  return getPaymentRequestDirectoryHref(new URLSearchParams(), {
    filters: { ...defaultPaymentRequestFilters, search: referenceCode },
    page: 1,
  });
}
