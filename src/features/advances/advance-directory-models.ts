import { formatDateTime, formatMonth, formatShortDate, formatShortDateTime } from "@/lib/datetime";
import { formatNumber, formatVnd } from "@/lib/format";
import { normalizeSearchText } from "@/lib/search";

import type { KnownSalaryAdvanceStatus, SalaryAdvanceDashboardEntry } from "./read-models";

/**
 * Pure helpers for the salary advance list (design 16a/16c): status wording,
 * captions, filters, chips, pagination and the header line. No server-only or
 * browser imports so the client page, the dialogs and tests share them. Counts
 * only: payroll owns every deduction amount, so nothing here adds money up.
 */

export const ADVANCES_PAGE_SIZE = 20;
/**
 * `get_salary_advances_dashboard` has no limit of its own; PostgREST `max_rows`
 * (1000) silently cuts the oldest rows past it, so a full load may be partial.
 */
export const ADVANCES_MAX_ROWS = 1000;
export const ALL_OPTION = "all";

/** Lifecycle order: the order options and chips are offered in. */
export const KNOWN_ADVANCE_STATUSES: readonly KnownSalaryAdvanceStatus[] = [
  "requested",
  "review",
  "approved",
  "deducted",
  "rejected",
];

export type AdvanceStatusTone = "danger" | "info" | "neutral" | "success" | "warning";

export interface AdvanceStatusPresentation {
  label: string;
  tone: AdvanceStatusTone;
}

// Badge texts are the code vocabulary (pinned); design 16c phrasing lives in the captions.
const statusMetadata: Record<KnownSalaryAdvanceStatus, AdvanceStatusPresentation> = {
  approved: { label: "Đã phê duyệt", tone: "success" },
  deducted: { label: "Đã khấu trừ", tone: "neutral" },
  rejected: { label: "Đã từ chối", tone: "danger" },
  requested: { label: "Chờ đối soát", tone: "warning" },
  review: { label: "Chờ phê duyệt", tone: "info" },
};

/** `Object.hasOwn`: a raw status such as "constructor" must not hit the prototype. */
export function isKnownAdvanceStatus(status: string): status is KnownSalaryAdvanceStatus {
  return Object.hasOwn(statusMetadata, status);
}

export function getAdvanceStatusPresentation(status: string): AdvanceStatusPresentation {
  if (isKnownAdvanceStatus(status)) {
    return statusMetadata[status];
  }

  return { label: `Trạng thái chưa hỗ trợ: ${status}`, tone: "neutral" };
}

// ---------------------------------------------------------------------------
// Viewer and row actions
// ---------------------------------------------------------------------------

export interface AdvanceViewer {
  /** `advances.owner_approve` */
  canApprove: boolean;
  /** `advances.review` */
  canReview: boolean;
  /** Signed-in user id; null when unknown, and own rows are then not set apart. */
  viewerId: string | null;
}

export type AdvanceDecisionStage = "approve" | "review";

/** Review or approval authority: such viewers see every row (the RPC's own scope rule). */
export function canDecideAdvances(viewer: AdvanceViewer): boolean {
  return viewer.canReview || viewer.canApprove;
}

/** The dialog stage the row's status and the viewer's permissions allow, before the self-decision ban. */
export function getAdvanceDecisionStage(
  entry: SalaryAdvanceDashboardEntry,
  viewer: AdvanceViewer,
): AdvanceDecisionStage | null {
  if (entry.status === "requested" && viewer.canReview) return "review";
  if (entry.status === "review" && viewer.canApprove) return "approve";
  return null;
}

export function isOwnAdvance(entry: SalaryAdvanceDashboardEntry, viewer: AdvanceViewer): boolean {
  return viewer.viewerId !== null && entry.staffId === viewer.viewerId;
}

/** Rows this viewer can decide now: the RPCs refuse a decision on one's own request. */
export function isActionableAdvance(entry: SalaryAdvanceDashboardEntry, viewer: AdvanceViewer): boolean {
  return getAdvanceDecisionStage(entry, viewer) !== null && !isOwnAdvance(entry, viewer);
}

/** Still waiting for someone: sent, or reviewed and waiting for the owner. */
export function isWaitingAdvance(entry: SalaryAdvanceDashboardEntry): boolean {
  return entry.status === "requested" || entry.status === "review";
}

export type AdvanceRowAction =
  | { kind: "decide"; stage: AdvanceDecisionStage }
  /** The viewer could decide this stage, but it is their own request. */
  | { kind: "own-pending" }
  | { kind: "view"; payrollPeriodId: string | null };

export function getAdvanceRowAction(
  entry: SalaryAdvanceDashboardEntry,
  viewer: AdvanceViewer,
  { canViewPayroll }: { canViewPayroll: boolean },
): AdvanceRowAction {
  const stage = getAdvanceDecisionStage(entry, viewer);

  if (stage) {
    return isOwnAdvance(entry, viewer) ? { kind: "own-pending" } : { kind: "decide", stage };
  }

  return {
    kind: "view",
    payrollPeriodId:
      entry.status === "deducted" && canViewPayroll ? entry.deductionPayrollPeriodId : null,
  };
}

/** `/payroll` anchors each period by id; there is no per-period route. */
export function getPayrollPeriodHref(payrollPeriodId: string): string {
  return `/payroll#payroll-period-${encodeURIComponent(payrollPeriodId)}`;
}

// ---------------------------------------------------------------------------
// Captions (Vietnam time; nulls drop their piece)
// ---------------------------------------------------------------------------

type CaptionPrecision = "full" | "short";

function joinWords(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}

function atDate(value: string | null, today: string, precision: CaptionPrecision): string | null {
  if (!value) return null;
  return precision === "short" ? formatShortDate(value, today) : formatDateTime(value);
}

function byActor(name: string | null): string | null {
  return name ? `bởi ${name}` : null;
}

/** `deduction_period_month` is a plain date (`YYYY-MM-01`): the month is its first 7 characters. */
export function getAdvancePeriod(entry: SalaryAdvanceDashboardEntry): string {
  return entry.deductionPeriodMonth.slice(0, 7);
}

/**
 * The latest lifecycle event: "gửi 12/10 09:40", "đối soát 10/10 bởi …",
 * "duyệt 03/10 bởi …", "trừ kỳ 09/2026", "từ chối 02/10 bởi …". `full` spells
 * timestamps out (`09:40 12/10/2026`, `formatDateTime`) for a `title`.
 */
export function describeAdvanceEvent(
  entry: SalaryAdvanceDashboardEntry,
  today: string,
  precision: CaptionPrecision = "short",
): string {
  switch (entry.status) {
    case "review":
      return joinWords(["đối soát", atDate(entry.reviewedAt, today, precision), byActor(entry.reviewedByDisplayName)]);
    case "approved":
      return joinWords(["duyệt", atDate(entry.approvedAt, today, precision), byActor(entry.approvedByDisplayName)]);
    case "rejected":
      return joinWords(["từ chối", atDate(entry.rejectedAt, today, precision), byActor(entry.rejectedByDisplayName)]);
    case "deducted": {
      const period = `trừ kỳ ${formatMonth(entry.deductionPeriodMonth)}`;
      return precision === "full" && entry.deductedAt
        ? `${period}, tính lương ${formatDateTime(entry.deductedAt)}`
        : period;
    }
    default:
      // requested, and any status the client cannot interpret: the request time is always known.
      return `gửi ${precision === "short" ? formatShortDateTime(entry.requestedAt, today) : formatDateTime(entry.requestedAt)}`;
  }
}

/** Line under the staff name: "NS-007 · gửi 12/10 09:40" (no code segment when the code is null). */
export function describeAdvanceIdentity(
  entry: SalaryAdvanceDashboardEntry,
  today: string,
  precision: CaptionPrecision = "short",
): string {
  return [entry.staffEmployeeCode, describeAdvanceEvent(entry, today, precision)]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/** Copy for a status the client cannot interpret (pinned). */
export const UNKNOWN_ADVANCE_STATUS_CAPTION = "Không thể diễn giải trạng thái này.";

/**
 * Line under the status badge. "Đã trừ" means a payroll calculation included
 * the advance (`deducted_at`), not that money moved: never "đã chi"/"đã trả".
 */
export function describeAdvanceStatusCaption(
  entry: SalaryAdvanceDashboardEntry,
  today: string,
): string | null {
  switch (entry.status) {
    case "requested":
      return "đã gửi, chờ kế toán đối soát";
    case "review":
      return "đã đối soát, chờ chủ duyệt";
    case "approved":
      return "chưa trừ vào lương";
    case "deducted":
      return entry.deductedAt
        ? `tính lương ${formatShortDate(entry.deductedAt, today)}`
        : `tính lương kỳ ${formatMonth(entry.deductionPeriodMonth)}`;
    case "rejected":
      return entry.rejectionReason;
    default:
      return UNKNOWN_ADVANCE_STATUS_CAPTION;
  }
}

export interface AdvanceTimelineEvent {
  key: "deducted" | "approved" | "rejected" | "requested" | "review";
  label: string;
  /** Vietnam time, actor and period, already joined; null when nothing is known. */
  meta: string | null;
  note: string | null;
}

function joinMeta(parts: readonly (string | null)[]): string | null {
  const present = parts.filter((part): part is string => Boolean(part));
  return present.length > 0 ? present.join(" · ") : null;
}

/** Read-only history for "Chi tiết tạm ứng": a step appears only when the server recorded something for it. */
export function buildAdvanceTimeline(entry: SalaryAdvanceDashboardEntry): AdvanceTimelineEvent[] {
  const events: AdvanceTimelineEvent[] = [
    { key: "requested", label: "Gửi yêu cầu", meta: formatDateTime(entry.requestedAt), note: null },
  ];

  if (entry.reviewedAt || entry.reviewedByDisplayName || entry.reviewNote) {
    events.push({
      key: "review",
      label: "Đối soát",
      meta: joinMeta([entry.reviewedAt ? formatDateTime(entry.reviewedAt) : null, byActor(entry.reviewedByDisplayName)]),
      note: entry.reviewNote,
    });
  }

  if (entry.approvedAt || entry.approvedByDisplayName || entry.approvalNote) {
    events.push({
      key: "approved",
      label: "Phê duyệt",
      meta: joinMeta([entry.approvedAt ? formatDateTime(entry.approvedAt) : null, byActor(entry.approvedByDisplayName)]),
      note: entry.approvalNote,
    });
  }

  if (entry.rejectedAt || entry.rejectedByDisplayName || entry.rejectionReason) {
    events.push({
      key: "rejected",
      label: "Từ chối",
      meta: joinMeta([entry.rejectedAt ? formatDateTime(entry.rejectedAt) : null, byActor(entry.rejectedByDisplayName)]),
      note: entry.rejectionReason,
    });
  }

  if (entry.status === "deducted" || entry.deductedAt || entry.deductionPayrollPeriodId) {
    events.push({
      key: "deducted",
      label: "Khấu trừ",
      meta: joinMeta([
        `kỳ ${formatMonth(entry.deductionPeriodMonth)}`,
        entry.deductedAt ? `tính lương lúc ${formatDateTime(entry.deductedAt)}` : null,
      ]),
      note: null,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Related requests (decision dialog "Đơn khác cùng kỳ"): a list, never a sum
// ---------------------------------------------------------------------------

/** Every row id → the other loaded rows of the same staff member and deduction month, in input order. */
export function buildRelatedAdvances(
  entries: readonly SalaryAdvanceDashboardEntry[],
): Map<string, SalaryAdvanceDashboardEntry[]> {
  const groups = new Map<string, SalaryAdvanceDashboardEntry[]>();

  for (const entry of entries) {
    const key = `${entry.staffId}\u0000${getAdvancePeriod(entry)}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  const related = new Map<string, SalaryAdvanceDashboardEntry[]>();

  for (const entry of entries) {
    const group = groups.get(`${entry.staffId}\u0000${getAdvancePeriod(entry)}`) ?? [];
    related.set(entry.id, group.filter((other) => other.id !== entry.id));
  }

  return related;
}

/** "2.000.000 ₫ · Đã phê duyệt · gửi 04/10" */
export function describeRelatedAdvance(entry: SalaryAdvanceDashboardEntry, today: string): string {
  return `${formatVnd(entry.amountVnd)} · ${getAdvanceStatusPresentation(entry.status).label} · gửi ${formatShortDate(entry.requestedAt, today)}`;
}

// ---------------------------------------------------------------------------
// Filters, chips, pagination
// ---------------------------------------------------------------------------

/** "actionable" = Cần xử lý (deciders), "waiting" = Đang chờ (everyone else), or one raw known status. */
export type AdvanceStatusFilter = typeof ALL_OPTION | "actionable" | "waiting" | KnownSalaryAdvanceStatus;

export interface AdvanceDirectoryFilters {
  /** `YYYY-MM` deduction month, or `all`. */
  period: string;
  search: string;
  status: AdvanceStatusFilter;
}

export const allAdvanceFilters: AdvanceDirectoryFilters = {
  period: ALL_OPTION,
  search: "",
  status: ALL_OPTION,
};

export interface AdvanceOption<T extends string = string> {
  label: string;
  value: T;
}

export interface AdvanceDirectoryOptions {
  /** Newest first, labelled `09/2026`. */
  periods: AdvanceOption[];
  /** Known statuses present in the loaded rows, lifecycle order, pinned badge labels. */
  statuses: AdvanceOption<KnownSalaryAdvanceStatus>[];
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function buildAdvanceOptions(entries: readonly SalaryAdvanceDashboardEntry[]): AdvanceDirectoryOptions {
  const periods = new Set<string>();
  const statuses = new Set<string>();

  for (const entry of entries) {
    const period = getAdvancePeriod(entry);
    if (PERIOD_PATTERN.test(period)) periods.add(period);
    statuses.add(entry.status);
  }

  return {
    // YYYY-MM sorts lexically.
    periods: [...periods]
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ label: formatMonth(value), value })),
    statuses: KNOWN_ADVANCE_STATUSES.filter((status) => statuses.has(status)).map((status) => ({
      label: statusMetadata[status].label,
      value: status,
    })),
  };
}

/** The status-select entry for the viewer's own group chip. */
export function getAdvanceGroupOption(viewer: AdvanceViewer): AdvanceOption<"actionable" | "waiting"> {
  return canDecideAdvances(viewer)
    ? { label: "Cần xử lý", value: "actionable" }
    : { label: "Đang chờ", value: "waiting" };
}

/**
 * A choice the loaded rows no longer offer (the list refreshed) or the viewer's
 * permissions do not allow falls back to "all" instead of a blank select.
 */
export function resolveAdvanceFilters(
  filters: AdvanceDirectoryFilters,
  options: AdvanceDirectoryOptions,
  viewer: AdvanceViewer,
): AdvanceDirectoryFilters {
  const groupValue = getAdvanceGroupOption(viewer).value;
  const status =
    filters.status === ALL_OPTION ||
    filters.status === groupValue ||
    options.statuses.some((option) => option.value === filters.status)
      ? filters.status
      : ALL_OPTION;
  const period =
    filters.period === ALL_OPTION || options.periods.some((option) => option.value === filters.period)
      ? filters.period
      : ALL_OPTION;

  return { period, search: filters.search, status };
}

export function countActiveAdvanceFilters(filters: AdvanceDirectoryFilters): number {
  return [filters.search.trim() !== "", filters.status !== ALL_OPTION, filters.period !== ALL_OPTION].filter(
    Boolean,
  ).length;
}

function matchesSearchAndPeriod(
  entry: SalaryAdvanceDashboardEntry,
  normalizedQuery: string,
  period: string,
): boolean {
  if (period !== ALL_OPTION && getAdvancePeriod(entry) !== period) return false;
  if (!normalizedQuery) return true;
  return (
    normalizeSearchText(entry.staffDisplayName).includes(normalizedQuery) ||
    (entry.staffEmployeeCode !== null && normalizeSearchText(entry.staffEmployeeCode).includes(normalizedQuery))
  );
}

export function matchesAdvanceStatus(
  entry: SalaryAdvanceDashboardEntry,
  status: AdvanceStatusFilter,
  viewer: AdvanceViewer,
): boolean {
  if (status === ALL_OPTION) return true;
  if (status === "actionable") return isActionableAdvance(entry, viewer);
  if (status === "waiting") return isWaitingAdvance(entry);
  return entry.status === status;
}

/** Rows matching every filter, in server order (requested_at desc). */
export function filterAdvances(
  entries: readonly SalaryAdvanceDashboardEntry[],
  filters: AdvanceDirectoryFilters,
  viewer: AdvanceViewer,
): SalaryAdvanceDashboardEntry[] {
  const query = normalizeSearchText(filters.search);
  return entries.filter(
    (entry) =>
      matchesSearchAndPeriod(entry, query, filters.period) &&
      matchesAdvanceStatus(entry, filters.status, viewer),
  );
}

export type AdvanceChipValue = typeof ALL_OPTION | "actionable" | "approved" | "deducted" | "rejected" | "waiting";

const chipLabels: Record<AdvanceChipValue, string> = {
  actionable: "Cần xử lý",
  all: "Tất cả",
  approved: "Đã duyệt, chưa trừ",
  deducted: "Đã trừ",
  rejected: "Từ chối",
  waiting: "Đang chờ",
};

export interface AdvanceChip {
  count: number;
  label: string;
  value: AdvanceChipValue;
}

/**
 * Chips over the rows that match the search and period (design 16c). A chip
 * shows only when it has rows or is active ("Tất cả" always), so data that
 * holds only unknown statuses offers no "Từ chối" or "Cần xử lý" control.
 */
export function buildAdvanceChips(
  entries: readonly SalaryAdvanceDashboardEntry[],
  filters: AdvanceDirectoryFilters,
  viewer: AdvanceViewer,
): AdvanceChip[] {
  const query = normalizeSearchText(filters.search);
  const counts: Record<AdvanceChipValue, number> = {
    actionable: 0,
    all: 0,
    approved: 0,
    deducted: 0,
    rejected: 0,
    waiting: 0,
  };

  for (const entry of entries) {
    if (!matchesSearchAndPeriod(entry, query, filters.period)) continue;
    counts.all += 1;
    if (isActionableAdvance(entry, viewer)) counts.actionable += 1;
    if (isWaitingAdvance(entry)) counts.waiting += 1;
    if (entry.status === "approved") counts.approved += 1;
    if (entry.status === "deducted") counts.deducted += 1;
    if (entry.status === "rejected") counts.rejected += 1;
  }

  const values: AdvanceChipValue[] = [
    ALL_OPTION,
    getAdvanceGroupOption(viewer).value,
    "approved",
    "deducted",
    "rejected",
  ];

  return values
    .filter((value) => value === ALL_OPTION || counts[value] > 0 || filters.status === value)
    .map((value) => ({ count: counts[value], label: chipLabels[value], value }));
}

/** The pressed chip, or null when the status select picked a status no chip stands for. */
export function getActiveAdvanceChip(filters: AdvanceDirectoryFilters): AdvanceChipValue | null {
  return Object.hasOwn(chipLabels, filters.status) ? (filters.status as AdvanceChipValue) : null;
}

/**
 * Header line over the rows of the selected deduction month (counts only):
 * deciders "Kỳ trừ 10/2026 · 6 đơn · 2 chờ đối soát · 1 chờ phê duyệt",
 * others "4 đơn của bạn · 1 đang chờ duyệt".
 */
export function describeAdvanceSummary(
  entries: readonly SalaryAdvanceDashboardEntry[],
  { period, viewer }: { period: string; viewer: AdvanceViewer },
): string {
  let total = 0;
  let requested = 0;
  let review = 0;

  for (const entry of entries) {
    if (period !== ALL_OPTION && getAdvancePeriod(entry) !== period) continue;
    total += 1;
    if (entry.status === "requested") requested += 1;
    if (entry.status === "review") review += 1;
  }

  const prefix = period === ALL_OPTION ? "" : `Kỳ trừ ${formatMonth(period)} · `;
  const body = canDecideAdvances(viewer)
    ? `${total} đơn · ${requested} chờ đối soát · ${review} chờ phê duyệt`
    : `${total} đơn của bạn · ${requested + review} đang chờ duyệt`;
  const cap =
    entries.length >= ADVANCES_MAX_ROWS
      ? ` · có thể chưa đủ (hệ thống trả tối đa ${formatNumber(ADVANCES_MAX_ROWS)} dòng)`
      : "";

  return `${prefix}${body}${cap}`;
}

export interface AdvancePage<T> {
  end: number;
  page: number;
  pageCount: number;
  rows: T[];
  start: number;
}

export function paginateAdvances<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize = ADVANCES_PAGE_SIZE,
): AdvancePage<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);

  return {
    end: Math.min(page * pageSize, rows.length),
    page,
    pageCount,
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    start: rows.length === 0 ? 0 : (page - 1) * pageSize + 1,
  };
}
