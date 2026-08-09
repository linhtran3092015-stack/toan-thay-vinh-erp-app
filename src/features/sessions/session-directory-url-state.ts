import type { SessionDirectoryFiltersState } from "./session-filters";
import { defaultSessionFilters } from "./session-filters";

const ownedParams = ["search", "class", "status", "kind", "from", "to", "page"] as const;
type OwnedParam = (typeof ownedParams)[number];
export interface SessionDirectoryViewState { filters: SessionDirectoryFiltersState; page: number; }
type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;
const statuses = new Set(["scheduled", "in_progress", "completed", "cancelled"]);
const kinds = new Set(["regular", "makeup", "additional"]);
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Sessions-local buffer for consecutive replaces before the router settles. */
export function mergePendingSessionDirectoryFilter(pending: SessionDirectoryFiltersState | null, rendered: SessionDirectoryFiltersState, key: keyof SessionDirectoryFiltersState, value: string): SessionDirectoryFiltersState {
  return { ...(pending ?? rendered), [key]: value };
}
export function areSessionDirectoryFiltersEqual(left: SessionDirectoryFiltersState, right: SessionDirectoryFiltersState): boolean {
  return left.classId === right.classId && left.dateFrom === right.dateFrom && left.dateTo === right.dateTo && left.kind === right.kind && left.search === right.search && left.status === right.status;
}
export function parseSessionDirectoryViewState(params: SearchParamsLike, classIds: readonly string[]): SessionDirectoryViewState {
  const classId = params.get("class"); const status = params.get("status"); const kind = params.get("kind"); const from = params.get("from"); const to = params.get("to");
  return { filters: { search: params.get("search") ?? defaultSessionFilters.search, classId: classId && classIds.includes(classId) ? classId : defaultSessionFilters.classId, status: status && statuses.has(status) ? status : defaultSessionFilters.status, kind: kind && kinds.has(kind) ? kind : defaultSessionFilters.kind, dateFrom: from && isValidIsoCalendarDate(from) ? from : defaultSessionFilters.dateFrom, dateTo: to && isValidIsoCalendarDate(to) ? to : defaultSessionFilters.dateTo }, page: parsePage(params.get("page")) };
}
export function serializeSessionDirectoryViewState(current: SearchParamsLike, state: SessionDirectoryViewState): URLSearchParams {
  const next = new URLSearchParams(current.toString()); ownedParams.forEach((key) => next.delete(key));
  if (state.filters.search.trim()) next.set("search", state.filters.search);
  if (state.filters.classId !== "all") next.set("class", state.filters.classId);
  if (state.filters.status !== "all") next.set("status", state.filters.status);
  if (state.filters.kind !== "all") next.set("kind", state.filters.kind);
  if (isValidIsoCalendarDate(state.filters.dateFrom)) next.set("from", state.filters.dateFrom);
  if (isValidIsoCalendarDate(state.filters.dateTo)) next.set("to", state.filters.dateTo);
  if (state.page > 1) next.set("page", String(state.page)); return next;
}
export function getSessionDirectoryHref(current: SearchParamsLike, state: SessionDirectoryViewState): string { const query = serializeSessionDirectoryViewState(current, state).toString(); return query ? `/sessions?${query}` : "/sessions"; }
export function getSessionDirectoryQuery(params: SearchParamsLike): string { const query = new URLSearchParams(); ownedParams.forEach((key) => { const value = params.get(key); if (isSafeValue(key, value)) query.set(key, value); }); return query.toString(); }
export function resetSessionDirectoryViewState(): SessionDirectoryViewState { return { filters: defaultSessionFilters, page: 1 }; }
function parsePage(value: string | null): number { if (!value || !/^[1-9]\d*$/.test(value)) return 1; const page = Number(value); return Number.isSafeInteger(page) ? page : 1; }
function isSafeValue(key: OwnedParam, value: string | null): value is string { if (value === null) return false; if (key === "search") return value.length <= 160; if (key === "class") return value.length > 0 && value.length <= 160; if (key === "status") return statuses.has(value); if (key === "kind") return kinds.has(value); if (key === "from" || key === "to") return isValidIsoCalendarDate(value); return /^[1-9]\d*$/.test(value); }

function isValidIsoCalendarDate(value: string): boolean {
  const match = datePattern.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
