import { hasSessionEnded } from "@/features/classes/detail/class-detail-models";
import { addDays } from "@/lib/datetime";

import type { SessionDirectoryItem, SessionKind, SessionLearningMode } from "./read-models";
import { defaultSessionFilters, filterSessions, type SessionDirectoryFiltersState } from "./session-filters";
import type { SessionAttendanceFilter } from "./session-directory-url-state";

/**
 * Pure models for the /sessions directory (design 16b). The page, the dev
 * preview and unit tests share them; nothing here reads the clock or the URL.
 * `today` is a Vietnam business date (YYYY-MM-DD) and `nowTime` HH:MM[:SS]
 * Vietnam wall-clock time, both injected by the server page.
 */

/** Rows the directory loads per request (newest session_date first) when no range bounds the query. */
export const SESSION_DIRECTORY_WINDOW_LIMIT = 300;

/**
 * Rows /sessions asks the lock-queue RPC for: its maximum (`p_limit` <= 500 in
 * get_unlocked_completed_sessions). The dashboard keeps its own, smaller cap.
 */
export const SESSION_QUEUE_LIMIT = 500;

/**
 * Whether the lock queue covers every completed, unlocked session: `failed`
 * (the RPC errored, no facts at all) or `partial` (a full page came back, so
 * the most recently completed sessions may be missing from it).
 */
export type SessionQueueStatus = "ok" | "failed" | "partial";

/**
 * The lock-queue facts the list needs per completed-but-unlocked session
 * (`get_unlocked_completed_sessions`, oldest completed first, capped).
 * A row without an item has unknown readiness, never "ready".
 */
export interface SessionQueueFacts {
  id: string;
  missingAttendanceCount: number;
  rosterCount: number;
}

type SessionQueueMap = ReadonlyMap<string, SessionQueueFacts>;

export interface SessionDirectoryClock {
  nowTime?: string;
  queue: SessionQueueMap;
  /** Omitted = "ok": a completed, unlocked row without a queue item is then simply not waiting. */
  queueStatus?: SessionQueueStatus;
  today: string;
}

export function createSessionQueueMap(items: readonly SessionQueueFacts[] | undefined): SessionQueueMap {
  return new Map((items ?? []).map((item) => [item.id, item]));
}

/** Monday–Sunday of the Vietnam week containing `today` (same rule as the dashboard's getWeekRange). */
export function getSessionWeekRange(today: string): { from: string; to: string } {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay() || 7;
  const from = addDays(today, 1 - weekday);
  return { from, to: addDays(from, 6) };
}

/** "Tuần 12–18/10/2026" when `from`–`to` is exactly one Monday–Sunday week; otherwise null. */
export function getSessionWeekLabel(from: string, to: string): string | null {
  if (!from || !to) return null;
  const week = getSessionWeekRange(from);
  if (week.from !== from || week.to !== to) return null;
  const [fromYear, fromMonth, fromDay] = from.split("-");
  const [toYear, toMonth, toDay] = to.split("-");
  if (fromYear !== toYear) return `Tuần ${fromDay}/${fromMonth}/${fromYear}–${toDay}/${toMonth}/${toYear}`;
  if (fromMonth !== toMonth) return `Tuần ${fromDay}/${fromMonth}–${toDay}/${toMonth}/${toYear}`;
  return `Tuần ${fromDay}–${toDay}/${toMonth}/${toYear}`;
}

const COMPACT_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

/** `2026-10-12` → `T2 12/10` (design 16b). */
export function formatSessionCompactDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const weekday = COMPACT_WEEKDAYS[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)).getUTCDay()];
  return `${weekday} ${match[3]}/${match[2]}`;
}

/** `08:00:00`, `10:00:00` → `08:00–10:00`. */
function formatSessionTimeRange(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`;
}

/** `T2 12/10 · 08:00–10:00`. */
export function formatSessionDateTime(row: Pick<SessionDirectoryItem, "endTime" | "sessionDate" | "startTime">): string {
  return `${formatSessionCompactDate(row.sessionDate)} · ${formatSessionTimeRange(row.startTime, row.endTime)}`;
}

export function formatSessionKindShort(kind: SessionKind): string {
  return { additional: "Bổ sung", makeup: "Bù", regular: "Chính" }[kind];
}

function formatSessionMode(mode: SessionLearningMode): string {
  return { hybrid: "Kết hợp", offline: "Offline", online: "Online" }[mode];
}

/** "Offline · P.102", "Kết hợp · P.101", "Online · có link", "Online". No provider name is stored. */
export function formatSessionModeRoom(row: Pick<SessionDirectoryItem, "hasMeetingUrl" | "learningMode" | "roomName">): string {
  const mode = formatSessionMode(row.learningMode);
  if (row.learningMode === "online") return row.hasMeetingUrl ? `${mode} · có link` : mode;
  return row.roomName ? `${mode} · ${row.roomName}` : mode;
}

/** "K6 · A" plus the component code when the session belongs to one. */
export function formatSessionClassCaption(row: Pick<SessionDirectoryItem, "componentCode" | "grade" | "level">): string {
  return [`K${row.grade}`, row.level, row.componentCode].filter(Boolean).join(" · ");
}

export type SessionLockReadiness =
  | { kind: "ready" }
  | { kind: "missing"; missing: number }
  | { kind: "no_roster" };

/** The lock rule on one queue item: a non-empty roster, every roster student present or absent. */
export function getSessionQueueItemReadiness(item: Pick<SessionQueueFacts, "missingAttendanceCount" | "rosterCount">): SessionLockReadiness {
  if (item.rosterCount <= 0) return { kind: "no_roster" };
  if (item.missingAttendanceCount > 0) return { kind: "missing", missing: item.missingAttendanceCount };
  return { kind: "ready" };
}

/**
 * Readiness of a completed, unlocked session from its lock-queue item.
 * `null` when the row is not waiting for a lock or the queue has no item for it.
 */
export function getSessionLockReadiness(
  row: Pick<SessionDirectoryItem, "id" | "lockedAt" | "status">,
  queue: SessionQueueMap,
): SessionLockReadiness | null {
  if (row.status !== "completed" || row.lockedAt !== null) return null;
  const item = queue.get(row.id);
  return item ? getSessionQueueItemReadiness(item) : null;
}

/**
 * Badge copy (D6), shared by the table and the lock-queue panel: "Sẵn sàng
 * khóa" only when the queue says the lock would succeed. "Chờ khóa" stays the
 * chip/header word for every completed, unlocked session.
 */
export function getSessionLockReadinessLabel(readiness: SessionLockReadiness): { label: string; tone: "info" | "neutral" | "warning" } {
  if (readiness.kind === "missing") return { label: `Thiếu ${readiness.missing} điểm danh`, tone: "warning" };
  if (readiness.kind === "no_roster") return { label: "Không có học sinh", tone: "neutral" };
  return { label: "Sẵn sàng khóa", tone: "info" };
}

/**
 * A completed, unlocked row whose attendance the list cannot know: the queue
 * failed, or it came back full without an item for this row.
 */
export function hasUnknownSessionQueueFacts(
  row: Pick<SessionDirectoryItem, "id" | "lockedAt" | "status">,
  clock: Pick<SessionDirectoryClock, "queue" | "queueStatus">,
): boolean {
  if ((clock.queueStatus ?? "ok") === "ok") return false;
  return row.status === "completed" && row.lockedAt === null && !clock.queue.has(row.id);
}

/**
 * Whether "Chưa điểm danh" over these rows is a full count. A failed queue
 * never is; a partial one is when every completed, unlocked row has an item.
 */
export function isSessionAttendanceCountKnown(
  rows: readonly Pick<SessionDirectoryItem, "id" | "lockedAt" | "status">[],
  clock: Pick<SessionDirectoryClock, "queue" | "queueStatus">,
): boolean {
  if (clock.queueStatus === "failed") return false;
  return !rows.some((row) => hasUnknownSessionQueueFacts(row, clock));
}

/**
 * "Chưa điểm danh" (D2, the dashboard's unmarked rule): a completed, unlocked
 * session whose queue item still misses roster marks, or a scheduled /
 * in-progress session whose end time has passed in Vietnam time. A completed
 * row without a queue item is not claimed.
 */
export function needsSessionAttendance(
  row: Pick<SessionDirectoryItem, "endTime" | "id" | "lockedAt" | "sessionDate" | "status">,
  clock: SessionDirectoryClock,
): boolean {
  if (row.status === "completed") {
    const readiness = getSessionLockReadiness(row, clock.queue);
    return readiness?.kind === "missing";
  }
  if (row.status === "scheduled" || row.status === "in_progress") return hasSessionEnded(row, clock.today, clock.nowTime);
  return false;
}

/** Dashboard vocabulary for a session whose end time passed without the next lifecycle step. */
export function getSessionOverdueCaption(
  row: Pick<SessionDirectoryItem, "endTime" | "sessionDate" | "status">,
  today: string,
  nowTime?: string,
): string | null {
  if (row.status !== "scheduled" && row.status !== "in_progress") return null;
  if (!hasSessionEnded(row, today, nowTime)) return null;
  return row.status === "scheduled" ? "Chưa bắt đầu" : "Chưa hoàn thành";
}

/** The seven-key filters plus the separate attendance filter (D2). */
export function applySessionDirectoryFilters(
  rows: readonly SessionDirectoryItem[],
  filters: SessionDirectoryFiltersState,
  attendance: SessionAttendanceFilter,
  clock: SessionDirectoryClock,
): SessionDirectoryItem[] {
  const filtered = filterSessions([...rows], filters);
  return attendance === "missing" ? filtered.filter((row) => needsSessionAttendance(row, clock)) : filtered;
}

export const sessionQuickFilters = ["all", "today", "week", "missing", "pending_lock", "locked", "cancelled"] as const;
export type SessionQuickFilter = (typeof sessionQuickFilters)[number];

export const sessionQuickFilterLabels: Record<SessionQuickFilter, string> = {
  all: "Tất cả",
  cancelled: "Đã hủy",
  locked: "Đã khóa",
  missing: "Chưa điểm danh",
  pending_lock: "Chờ khóa",
  today: "Hôm nay",
  week: "Tuần này",
};

type QuickFilterKeys = Pick<SessionDirectoryFiltersState, "dateFrom" | "dateTo" | "lock" | "status">;

/**
 * URL state each chip writes. Chips own status, lock, the date range and the
 * attendance filter; search, class and kind are kept. "Chờ khóa"
 * (status=completed&lock=unlocked) and "Chưa điểm danh" (attendance=missing)
 * only ever hold sessions on or before today (completed, or past their end
 * time), so both end their range at today: the server read then spends its
 * row cap on past sessions, not on scheduled future ones. The lock-queue
 * panel's "Lọc danh sách" and the dashboard's awaiting-lock and unmarked links
 * write these same states (`…&to=<today>`), so landing on them presses the chip.
 * The daily lock-queue digest notification links to the undated
 * `status=completed&lock=unlocked`, which `deriveSessionQuickFilter` maps to the
 * same chip (see `SESSION_UNTIL_TODAY_CHIPS`).
 */
function getSessionQuickFilterState(chip: SessionQuickFilter, today: string): { attendance: SessionAttendanceFilter; filters: QuickFilterKeys } {
  const cleared: QuickFilterKeys = {
    dateFrom: defaultSessionFilters.dateFrom,
    dateTo: defaultSessionFilters.dateTo,
    lock: defaultSessionFilters.lock,
    status: defaultSessionFilters.status,
  };
  switch (chip) {
    case "today":
      return { attendance: "all", filters: { ...cleared, dateFrom: today, dateTo: today } };
    case "week": {
      const week = getSessionWeekRange(today);
      return { attendance: "all", filters: { ...cleared, dateFrom: week.from, dateTo: week.to } };
    }
    case "missing":
      return { attendance: "missing", filters: { ...cleared, dateTo: today } };
    case "pending_lock":
      return { attendance: "all", filters: { ...cleared, dateTo: today, lock: "unlocked", status: "completed" } };
    case "locked":
      return { attendance: "all", filters: { ...cleared, lock: "locked" } };
    case "cancelled":
      return { attendance: "all", filters: { ...cleared, status: "cancelled" } };
    default:
      return { attendance: "all", filters: cleared };
  }
}

/**
 * Chips whose set only holds sessions on or before today: without `to` the
 * undated URL shows the same set, so it presses the chip too (the stored digest
 * notifications link to `/sessions?status=completed&lock=unlocked`). Pressing
 * the chip still writes `to=<today>`.
 */
const SESSION_UNTIL_TODAY_CHIPS: ReadonlySet<SessionQuickFilter> = new Set(["missing", "pending_lock"]);

/** The chip the current filters correspond to, or null when no single chip matches (class-list precedent). */
export function deriveSessionQuickFilter(
  filters: SessionDirectoryFiltersState,
  attendance: SessionAttendanceFilter,
  today: string,
): SessionQuickFilter | null {
  for (const chip of sessionQuickFilters) {
    const state = getSessionQuickFilterState(chip, today);
    const dateToMatches = state.filters.dateTo === filters.dateTo || (SESSION_UNTIL_TODAY_CHIPS.has(chip) && filters.dateTo === "");
    if (
      state.attendance === attendance &&
      state.filters.status === filters.status &&
      state.filters.lock === filters.lock &&
      state.filters.dateFrom === filters.dateFrom &&
      dateToMatches
    ) {
      return chip;
    }
  }
  return null;
}

/** The filters after pressing a chip (search, class and kind stay). */
export function applySessionQuickFilter(
  filters: SessionDirectoryFiltersState,
  chip: SessionQuickFilter,
  today: string,
): { attendance: SessionAttendanceFilter; filters: SessionDirectoryFiltersState } {
  const state = getSessionQuickFilterState(chip, today);
  return { attendance: state.attendance, filters: { ...filters, ...state.filters } };
}

/** Rows each chip would show, over the loaded rows with the kept filters (search, class, kind) applied. */
export function countSessionQuickFilters(
  rows: readonly SessionDirectoryItem[],
  filters: SessionDirectoryFiltersState,
  clock: SessionDirectoryClock,
): Record<SessionQuickFilter, number> {
  const counts = {} as Record<SessionQuickFilter, number>;
  for (const chip of sessionQuickFilters) {
    const next = applySessionQuickFilter(filters, chip, clock.today);
    counts[chip] = applySessionDirectoryFilters(rows, next.filters, next.attendance, clock).length;
  }
  return counts;
}

/** Window facts for the chip counts: the server bounds and the row cap of the loaded rows. */
export interface SessionLoadedWindow {
  limit: number;
  loadedFrom: string | null;
  loadedTo: string | null;
}

/**
 * Whether a chip's count covers every session it would show. Chips replace
 * the date range, so a chip whose range was not loaded in full
 * (a bounded load, or the newest-N window cut) gets no number; "Chờ khóa" and
 * "Chưa điểm danh" are checked over their own range (…, today]. "Chưa điểm
 * danh" also needs known queue facts for the completed, unlocked rows.
 */
export function isSessionQuickFilterCountComplete(
  chip: SessionQuickFilter,
  { clock, filters, loaded, sessions }: {
    clock: SessionDirectoryClock;
    filters: SessionDirectoryFiltersState;
    loaded: SessionLoadedWindow;
    sessions: readonly SessionDirectoryItem[];
  },
): boolean {
  const next = applySessionQuickFilter(filters, chip, clock.today);
  const notice = getSessionWindowNotice({
    ...loaded,
    requestedFrom: next.filters.dateFrom,
    requestedTo: next.filters.dateTo,
    sessions,
  });
  if (notice !== "complete") return false;
  if (chip !== "missing") return true;
  return isSessionAttendanceCountKnown(filterSessions([...sessions], next.filters), clock);
}

export type SessionCountCell =
  | { kind: "dash"; reason?: string }
  | { incomplete: boolean; kind: "ratio"; total: number; value: number }
  | { kind: "recorded"; value: number }
  | { kind: "count"; value: number };

/**
 * Điểm danh (D4, attendance.view). Locked: the lock required every roster
 * student marked, so the marked count is the roster (y/y). Completed and
 * unlocked with a queue item: (roster − missing)/roster, the lock rule.
 * Otherwise only the marked roster count is known ("x đã ghi"); there is no
 * per-session roster read in the list.
 */
export function getSessionAttendanceCell(
  row: Pick<SessionDirectoryItem, "id" | "lockedAt" | "status"> & { markedRosterCount?: number | null },
  queue: SessionQueueMap,
): SessionCountCell {
  if (row.status === "scheduled" || row.status === "cancelled") return { kind: "dash" };
  const marked = typeof row.markedRosterCount === "number" ? row.markedRosterCount : null;
  if (row.status === "completed" && row.lockedAt !== null) {
    return marked === null ? { kind: "dash", reason: "Chưa tải được điểm danh" } : { incomplete: false, kind: "ratio", total: marked, value: marked };
  }
  const item = row.status === "completed" ? queue.get(row.id) : undefined;
  if (item) {
    if (item.rosterCount <= 0) return { kind: "dash", reason: "Không có học sinh trong danh sách" };
    const recorded = Math.max(0, item.rosterCount - item.missingAttendanceCount);
    return { incomplete: item.missingAttendanceCount > 0, kind: "ratio", total: item.rosterCount, value: recorded };
  }
  return marked === null ? { kind: "dash", reason: "Chưa tải được điểm danh" } : { kind: "recorded", value: marked };
}

/**
 * Kết quả (D4, results.view): results over students present or additional
 * study (who may receive one) when attendance is visible; else the count only.
 */
export function getSessionResultCell(
  row: Pick<SessionDirectoryItem, "resultCount" | "status"> & { resultEligibleCount?: number | null },
  canViewAttendance: boolean,
): SessionCountCell {
  if (row.status === "scheduled" || row.status === "cancelled") return { kind: "dash" };
  if (row.resultCount === null) return { kind: "dash", reason: "Không có quyền xem kết quả" };
  if (canViewAttendance && typeof row.resultEligibleCount === "number") {
    return { incomplete: false, kind: "ratio", total: row.resultEligibleCount, value: row.resultCount };
  }
  return { kind: "count", value: row.resultCount };
}

/** Plain text of a count cell (mobile metrics, accessible names). */
export function formatSessionCountCell(cell: SessionCountCell): string {
  if (cell.kind === "dash") return "—";
  if (cell.kind === "ratio") return `${cell.value}/${cell.total}`;
  if (cell.kind === "recorded") return `${cell.value} đã ghi`;
  return String(cell.value);
}

type SessionRowAction = "lock" | "attendance" | "open";

/**
 * One row link (D8), all to the session page. "Khóa" only when the queue says
 * the session is lockable; "Điểm danh" only when marking is possible (a started
 * session that still needs attendance); otherwise "Mở".
 */
export function getSessionRowAction(
  row: Pick<SessionDirectoryItem, "endTime" | "id" | "lockedAt" | "sessionDate" | "status">,
  clock: SessionDirectoryClock,
  permissions: { canLock: boolean; canMarkAttendance: boolean },
): SessionRowAction {
  const readiness = getSessionLockReadiness(row, clock.queue);
  if (permissions.canLock && readiness?.kind === "ready") return "lock";
  // Marking needs a started session: a scheduled one past its end is opened to be started first.
  if (permissions.canMarkAttendance && row.status !== "scheduled" && needsSessionAttendance(row, clock)) return "attendance";
  return "open";
}

export const sessionRowActionLabels: Record<SessionRowAction, string> = {
  attendance: "Điểm danh",
  lock: "Khóa",
  open: "Mở",
};

type SessionWindowNotice = "complete" | "truncated" | "reload";

/**
 * Whether the rows on screen can be trusted for the requested date range.
 * The loader orders newest date first and stops at `limit`, so after a cut only
 * dates after the oldest loaded date are complete. Date changes are client-side
 * URL writes; a range outside what the server read needs a reload.
 */
export function getSessionWindowNotice({
  limit,
  loadedFrom,
  loadedTo,
  requestedFrom,
  requestedTo,
  sessions,
}: {
  limit: number;
  loadedFrom: string | null;
  loadedTo: string | null;
  requestedFrom: string;
  requestedTo: string;
  sessions: readonly Pick<SessionDirectoryItem, "sessionDate">[];
}): SessionWindowNotice {
  const truncated = sessions.length >= limit;
  if ((requestedFrom || null) === loadedFrom && (requestedTo || null) === loadedTo) return truncated ? "truncated" : "complete";
  const withinFrom = loadedFrom === null || (requestedFrom !== "" && requestedFrom >= loadedFrom);
  const withinTo = loadedTo === null || (requestedTo !== "" && requestedTo <= loadedTo);
  if (!withinFrom || !withinTo) return "reload";
  if (!truncated) return "complete";
  const oldest = sessions.reduce((min, row) => (row.sessionDate < min ? row.sessionDate : min), sessions[0]?.sessionDate ?? "");
  return requestedFrom !== "" && requestedFrom > oldest ? "complete" : "reload";
}
