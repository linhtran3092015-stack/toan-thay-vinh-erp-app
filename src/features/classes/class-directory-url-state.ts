import type { ClassDirectoryFiltersState } from "./class-filters";
import { defaultClassFilters } from "./class-filters";

const ownedParams = ["search", "year", "grade", "level", "mode", "status", "page"] as const;
type OwnedParam = (typeof ownedParams)[number];

export interface ClassDirectoryViewState {
  filters: ClassDirectoryFiltersState;
  page: number;
}

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

const levels = new Set(["A", "B", "CLC"]);
const modes = new Set(["offline", "online", "hybrid"]);
const statuses = new Set(["draft", "active", "closed", "archived"]);

/** Classes-local composition buffer: merges a change onto the filters of the last update, even before the page re-renders. */
export function mergePendingClassDirectoryFilter(
  pending: ClassDirectoryFiltersState | null,
  rendered: ClassDirectoryFiltersState,
  key: keyof ClassDirectoryFiltersState,
  value: string,
): ClassDirectoryFiltersState {
  return { ...(pending ?? rendered), [key]: value };
}

export function parseClassDirectoryViewState(
  params: SearchParamsLike,
  years: readonly string[],
): ClassDirectoryViewState {
  const year = params.get("year");
  const grade = params.get("grade");
  const level = params.get("level");
  const mode = params.get("mode");
  const status = params.get("status");
  return {
    filters: {
      search: params.get("search") ?? defaultClassFilters.search,
      year: year && years.includes(year) ? year : defaultClassFilters.year,
      grade: grade && /^(?:[1-9]|1[0-2])$/.test(grade) ? grade : defaultClassFilters.grade,
      level: level && levels.has(level) ? level : defaultClassFilters.level,
      mode: mode && modes.has(mode) ? mode : defaultClassFilters.mode,
      status: status && statuses.has(status) ? status : defaultClassFilters.status,
    },
    page: parsePage(params.get("page")),
  };
}

export function serializeClassDirectoryViewState(
  current: SearchParamsLike,
  state: ClassDirectoryViewState,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  ownedParams.forEach((key) => next.delete(key));
  if (state.filters.search.trim()) next.set("search", state.filters.search);
  if (state.filters.year !== "all") next.set("year", state.filters.year);
  if (state.filters.grade !== "all") next.set("grade", state.filters.grade);
  if (state.filters.level !== "all") next.set("level", state.filters.level);
  if (state.filters.mode !== "all") next.set("mode", state.filters.mode);
  if (state.filters.status !== "all") next.set("status", state.filters.status);
  if (state.page > 1) next.set("page", String(state.page));
  return next;
}

export function getClassDirectoryHref(current: SearchParamsLike, state: ClassDirectoryViewState): string {
  const query = serializeClassDirectoryViewState(current, state).toString();
  return query ? `/classes?${query}` : "/classes";
}

export function getClassDirectoryQuery(params: SearchParamsLike): string {
  const query = new URLSearchParams();
  ownedParams.forEach((key) => {
    const value = params.get(key);
    if (isSafeValue(key, value)) query.set(key, value);
  });
  return query.toString();
}

export function withClassDirectoryQuery(pathname: string, params: SearchParamsLike): string {
  const query = getClassDirectoryQuery(params);
  return query ? `${pathname}?${query}` : pathname;
}

export function resetClassDirectoryViewState(): ClassDirectoryViewState {
  return { filters: defaultClassFilters, page: 1 };
}

function parsePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function isSafeValue(key: OwnedParam, value: string | null): value is string {
  if (value === null) return false;
  if (key === "search") return value.length <= 160;
  if (key === "year") return value.length > 0 && value.length <= 80;
  if (key === "grade") return /^(?:[1-9]|1[0-2])$/.test(value);
  if (key === "level") return levels.has(value);
  if (key === "mode") return modes.has(value);
  if (key === "status") return statuses.has(value);
  return /^[1-9]\d*$/.test(value);
}
