import { formatMonth, getVietnamTime } from "@/lib/datetime";

import type {
  KnownSalesCommissionAccrualStatus,
  KnownSalesCommissionSourceGroup,
  SalesCommissionAccrualDashboardEntry,
} from "./read-models";

/**
 * Pure helpers for the eligible-revenue list (/commissions, design 16a row
 * "Hoa hồng"). The page file may not filter, sort or sum (pinned by
 * commissions-management.test.tsx), so options, filtering, paging and the
 * "is this month complete" rule live here. No server-only or browser imports.
 */

/** `get_sales_commission_accruals_dashboard` accepts 1-500; /commissions asks for the maximum. */
export const COMMISSIONS_LIMIT = 500;
/** The loader's default `p_limit` (`getSalesCommissionAccrualsDashboardResult()` with no argument). */
export const COMMISSIONS_DEFAULT_LIMIT = 200;
export const COMMISSIONS_PAGE_SIZE = 20;
export const ALL_OPTION = "all";

export type CommissionPresentationTone = "info" | "neutral" | "warning";

export interface CommissionPresentation {
  label: string;
  tone: CommissionPresentationTone;
}

const sourceGroupMetadata: Record<KnownSalesCommissionSourceGroup, CommissionPresentation> = {
  mma: { label: "MMA", tone: "info" },
  sandbox: { label: "Sandbox", tone: "warning" },
};

/** Display order of the known groups in the "Nguồn" filter. */
const knownSourceGroups: readonly KnownSalesCommissionSourceGroup[] = ["mma", "sandbox"];

const statusMetadata: Record<KnownSalesCommissionAccrualStatus, CommissionPresentation> = {
  provisional: { label: "Chờ chính sách", tone: "warning" },
};

/** Fails closed: a raw value the app does not know (even `constructor`) is named, never mapped. */
export function getSourceGroupPresentation(value: string): CommissionPresentation {
  if (Object.hasOwn(sourceGroupMetadata, value)) {
    return sourceGroupMetadata[value as KnownSalesCommissionSourceGroup];
  }

  return { label: `Nguồn chưa hỗ trợ: ${value}`, tone: "neutral" };
}

export function getStatusPresentation(value: string): CommissionPresentation {
  if (Object.hasOwn(statusMetadata, value)) {
    return statusMetadata[value as KnownSalesCommissionAccrualStatus];
  }

  return { label: `Trạng thái chưa hỗ trợ: ${value}`, tone: "neutral" };
}

export interface CommissionFilters {
  /** `YYYY-MM` of `recognizedOn` (already a Vietnam business date) or `all`. */
  month: string;
  /** `saleOwnerId` or `all`; ignored without `commissions.manage`. */
  saleOwnerId: string;
  /** Raw `leadSourceGroup` or `all`. */
  sourceGroup: string;
}

export const allCommissionFilters: CommissionFilters = {
  month: ALL_OPTION,
  saleOwnerId: ALL_OPTION,
  sourceGroup: ALL_OPTION,
};

export interface CommissionOption {
  label: string;
  value: string;
}

export interface CommissionOptions {
  months: CommissionOption[];
  sales: CommissionOption[];
  sources: CommissionOption[];
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * The commission month of a row: `recognizedOn.slice(0, 7)`. `recognized_on` is
 * the Vietnam date the money arrived, so no timezone conversion applies (never
 * bucket by `recognizedAt`). Null for a malformed date.
 */
export function getRecognizedMonth(recognizedOn: string): string | null {
  return ISO_DATE.test(recognizedOn) ? recognizedOn.slice(0, 7) : null;
}

/** `recognizedAt` → `HH:mm` in Vietnam time, or null for an unparseable timestamp. */
export function formatRecognizedTime(recognizedAt: string): string | null {
  const date = new Date(recognizedAt);
  return Number.isNaN(date.getTime()) ? null : getVietnamTime(date).slice(0, 5);
}

/** "Nguyễn Minh An · NS-001": the code tells two sales with the same name apart. */
export function getSaleOwnerLabel(entry: SalesCommissionAccrualDashboardEntry): string {
  return entry.saleOwnerEmployeeCode
    ? `${entry.saleOwnerDisplayName} · ${entry.saleOwnerEmployeeCode}`
    : entry.saleOwnerDisplayName;
}

/**
 * Options come only from the loaded rows (a `Map`, never plain-object keys), so
 * data with only unsupported groups offers no "MMA"/"Sandbox" option.
 */
export function buildCommissionOptions(
  entries: readonly SalesCommissionAccrualDashboardEntry[],
): CommissionOptions {
  const months = new Set<string>();
  const sales = new Map<string, string>();
  const sources = new Map<string, string>();

  for (const entry of entries) {
    const month = getRecognizedMonth(entry.recognizedOn);
    if (month) months.add(month);
    if (!sales.has(entry.saleOwnerId)) sales.set(entry.saleOwnerId, getSaleOwnerLabel(entry));
    if (!sources.has(entry.leadSourceGroup)) {
      sources.set(entry.leadSourceGroup, getSourceGroupPresentation(entry.leadSourceGroup).label);
    }
  }

  const known: CommissionOption[] = [];
  for (const group of knownSourceGroups) {
    const label = sources.get(group);
    if (label !== undefined) known.push({ label, value: group });
  }
  const unknown = [...sources]
    .filter(([value]) => !Object.hasOwn(sourceGroupMetadata, value))
    .map(([value, label]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));

  return {
    // YYYY-MM sorts lexically, newest first.
    months: [...months]
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ label: `Tháng ${formatMonth(value)}`, value })),
    sales: [...sales]
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi")),
    sources: [...known, ...unknown],
  };
}

/**
 * A selected value no loaded row offers anymore (the list refreshed) falls back
 * to "all" instead of a blank select; the Sale filter only exists with manage.
 */
export function resolveCommissionFilters(
  filters: CommissionFilters,
  options: CommissionOptions,
  { canManage }: { canManage: boolean },
): CommissionFilters {
  const keep = (value: string, list: readonly CommissionOption[]) =>
    value === ALL_OPTION || list.some((option) => option.value === value) ? value : ALL_OPTION;

  return {
    month: keep(filters.month, options.months),
    saleOwnerId: canManage ? keep(filters.saleOwnerId, options.sales) : ALL_OPTION,
    sourceGroup: keep(filters.sourceGroup, options.sources),
  };
}

export function countActiveCommissionFilters(
  filters: CommissionFilters,
  { canManage }: { canManage: boolean },
): number {
  return [filters.month, canManage ? filters.saleOwnerId : ALL_OPTION, filters.sourceGroup].filter(
    (value) => value !== ALL_OPTION,
  ).length;
}

/** Keeps the server order (recognized_on desc, recognized_at desc, id desc). */
export function filterCommissions(
  entries: readonly SalesCommissionAccrualDashboardEntry[],
  filters: CommissionFilters,
  { canManage }: { canManage: boolean },
): SalesCommissionAccrualDashboardEntry[] {
  return entries.filter(
    (entry) =>
      (filters.month === ALL_OPTION || getRecognizedMonth(entry.recognizedOn) === filters.month) &&
      (!canManage || filters.saleOwnerId === ALL_OPTION || entry.saleOwnerId === filters.saleOwnerId) &&
      (filters.sourceGroup === ALL_OPTION || entry.leadSourceGroup === filters.sourceGroup),
  );
}

export interface CommissionCoverage {
  /** The load filled `limit`: older rows than the oldest loaded one may exist. */
  capped: boolean;
  /** The selected month when it may be missing rows; null when it is complete or no month is selected. */
  partialMonth: string | null;
}

/**
 * Whether the loaded rows hold every row of the selected month (no sums).
 *
 * The RPC returns the newest `limit` rows by `recognized_on desc`. The load is
 * complete when fewer than `limit` came back; otherwise a month is complete only
 * when the oldest loaded `recognizedOn` is strictly before its first day. A tie
 * on the 1st is not enough: other rows of that date may have been cut. Sale and
 * source filters narrow a month, so the same rule covers them.
 */
export function describeCommissionCoverage({
  entries,
  limit,
  month,
}: {
  entries: readonly SalesCommissionAccrualDashboardEntry[];
  limit: number;
  month: string;
}): CommissionCoverage {
  const capped = entries.length >= limit;
  if (!capped || month === ALL_OPTION) return { capped, partialMonth: null };

  let oldest: string | null = null;
  for (const entry of entries) {
    if (ISO_DATE.test(entry.recognizedOn) && (oldest === null || entry.recognizedOn < oldest)) {
      oldest = entry.recognizedOn;
    }
  }

  const complete = oldest !== null && oldest < `${month}-01`;
  return { capped, partialMonth: complete ? null : month };
}

/**
 * Header context line: "2 bản ghi" / "1 trong 2 bản ghi", plus the cap when the
 * load filled it. Counts only: no money total exists for this ledger.
 */
export function describeCommissionCounts({
  capped,
  filteredCount,
  hasFilters,
  limit,
  total,
}: {
  capped: boolean;
  filteredCount: number;
  hasFilters: boolean;
  limit: number;
  total: number;
}): string {
  const counts = hasFilters ? `${filteredCount} trong ${total} bản ghi` : `${total} bản ghi`;
  return capped ? `${counts} · chỉ tải ${limit} bản ghi mới nhất theo ngày tiền về` : counts;
}

/** "Tháng 08/2026 có thể chưa đủ: chỉ tải 500 bản ghi mới nhất." */
export function describePartialMonth(month: string, limit: number): string {
  return `Tháng ${formatMonth(month)} có thể chưa đủ: chỉ tải ${limit} bản ghi mới nhất.`;
}

export function paginateCommissions<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize = COMMISSIONS_PAGE_SIZE,
) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, rows.length);

  return {
    end,
    page,
    pageCount,
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    start,
  };
}
