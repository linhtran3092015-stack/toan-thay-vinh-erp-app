import { formatMonth, toVietnamDate } from "@/lib/datetime";

import type { GradingCreditDashboardEntry } from "./read-models";

/**
 * Pure helpers for the grading-credit list (design 16a). No server-only or
 * browser imports so the client page, the loader and tests can share them.
 */

/** `get_grading_credits_dashboard` accepts 1-500; this is the loader's argument. */
export const GRADING_CREDITS_LIMIT = 500;
export const GRADING_CREDITS_PAGE_SIZE = 20;
export const ALL_OPTION = "all";

export interface GradingCreditFilters {
  classCode: string;
  graderId: string;
  /** `YYYY-MM` (Vietnam month of `credited_at`) or `all`. */
  month: string;
}

export const allGradingCreditFilters: GradingCreditFilters = {
  classCode: ALL_OPTION,
  graderId: ALL_OPTION,
  month: ALL_OPTION,
};

export interface GradingCreditOption {
  label: string;
  value: string;
}

export interface GradingCreditOptions {
  classes: GradingCreditOption[];
  graders: GradingCreditOption[];
  months: GradingCreditOption[];
}

/**
 * `credited_at` -> Vietnam month `YYYY-MM`, the rule payroll uses. The server
 * timezone must never decide the month: 2026-09-30T17:30:00Z is October there.
 * Returns null for an unparseable timestamp instead of throwing.
 */
export function getCreditMonth(creditedAt: string): string | null {
  const date = new Date(creditedAt);
  if (Number.isNaN(date.getTime())) return null;
  return toVietnamDate(date).slice(0, 7);
}

/** Instant (ms) at which a Vietnam month starts, or null for a malformed value. */
export function getVietnamMonthStart(month: string): number | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const start = new Date(`${month}-01T00:00:00+07:00`).getTime();
  return Number.isNaN(start) ? null : start;
}

export function buildCreditOptions(
  entries: readonly GradingCreditDashboardEntry[],
): GradingCreditOptions {
  const months = new Set<string>();
  const graders = new Map<string, string>();
  const classes = new Map<string, string>();

  for (const entry of entries) {
    const month = getCreditMonth(entry.creditedAt);
    if (month) months.add(month);
    if (!graders.has(entry.graderId)) graders.set(entry.graderId, entry.graderDisplayName);
    if (!classes.has(entry.classCode)) classes.set(entry.classCode, entry.className);
  }

  return {
    classes: [...classes]
      .map(([value, name]) => ({ label: `${value} · ${name}`, value }))
      .sort((a, b) => a.value.localeCompare(b.value, "vi", { numeric: true })),
    graders: [...graders]
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi")),
    // YYYY-MM sorts lexically, newest first.
    months: [...months]
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ label: `Tháng ${formatMonth(value)}`, value })),
  };
}

/** The current Vietnam month when any row falls in it, otherwise every month. */
export function getDefaultMonth(
  entries: readonly GradingCreditDashboardEntry[],
  currentMonth: string,
): string {
  return entries.some((entry) => getCreditMonth(entry.creditedAt) === currentMonth)
    ? currentMonth
    : ALL_OPTION;
}

/**
 * A selected value that no loaded row offers anymore (the list refreshed and
 * the row aged out of the window) falls back to "all" instead of a blank select.
 */
export function resolveCreditFilters(
  filters: GradingCreditFilters,
  options: GradingCreditOptions,
): GradingCreditFilters {
  const keep = (value: string, list: readonly GradingCreditOption[]) =>
    value === ALL_OPTION || list.some((option) => option.value === value) ? value : ALL_OPTION;

  return {
    classCode: keep(filters.classCode, options.classes),
    graderId: keep(filters.graderId, options.graders),
    month: keep(filters.month, options.months),
  };
}

export function countActiveCreditFilters(
  filters: GradingCreditFilters,
  { canViewAll }: { canViewAll: boolean },
): number {
  return [
    filters.month,
    canViewAll ? filters.graderId : ALL_OPTION,
    filters.classCode,
  ].filter((value) => value !== ALL_OPTION).length;
}

export function filterCredits(
  entries: readonly GradingCreditDashboardEntry[],
  filters: GradingCreditFilters,
  { canViewAll }: { canViewAll: boolean },
): GradingCreditDashboardEntry[] {
  return entries.filter(
    (entry) =>
      (filters.month === ALL_OPTION || getCreditMonth(entry.creditedAt) === filters.month) &&
      (!canViewAll || filters.graderId === ALL_OPTION || entry.graderId === filters.graderId) &&
      (filters.classCode === ALL_OPTION || entry.classCode === filters.classCode),
  );
}

export interface GradingCreditTotal {
  /** True when no credit that matches the month is missing from the loaded rows. */
  exact: boolean;
  limit: number;
  total: number;
}

/**
 * Total credits for the filtered rows, and whether it is the whole truth.
 *
 * The RPC returns the newest `limit` credits (credited_at desc). The loaded
 * rows are therefore complete when fewer than `limit` came back, or for a
 * month that starts strictly after the oldest loaded credit. A tie with the
 * oldest row is not enough: rows sharing that instant may have been cut.
 */
export function summarizeCreditTotal({
  entries,
  filtered,
  limit,
  month,
}: {
  entries: readonly GradingCreditDashboardEntry[];
  filtered: readonly GradingCreditDashboardEntry[];
  limit: number;
  month: string;
}): GradingCreditTotal {
  const total = filtered.reduce((sum, entry) => sum + entry.creditUnits, 0);

  if (entries.length < limit) return { exact: true, limit, total };
  if (month === ALL_OPTION) return { exact: false, limit, total };

  const monthStart = getVietnamMonthStart(month);
  const oldest = entries.reduce(
    (min, entry) => Math.min(min, new Date(entry.creditedAt).getTime()),
    Number.POSITIVE_INFINITY,
  );

  return {
    exact: monthStart !== null && Number.isFinite(oldest) && oldest < monthStart,
    limit,
    total,
  };
}

/** `Tổng tín chỉ (tháng 10/2026, theo bộ lọc)`: what the number covers. */
export function describeCreditTotalScope(
  filters: GradingCreditFilters,
  { canViewAll }: { canViewAll: boolean },
): string {
  const parts: string[] = [];
  if (filters.month !== ALL_OPTION) parts.push(`tháng ${formatMonth(filters.month)}`);
  if (filters.classCode !== ALL_OPTION || (canViewAll && filters.graderId !== ALL_OPTION)) {
    parts.push("theo bộ lọc");
  }
  return parts.length > 0 ? `Tổng tín chỉ (${parts.join(", ")})` : "Tổng tín chỉ";
}

export function paginateCredits<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize = GRADING_CREDITS_PAGE_SIZE,
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
