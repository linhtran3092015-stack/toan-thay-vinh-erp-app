import { careFilterSchema } from "./models";

/** Route `searchParams` as Next passes them: a repeated key arrives as an array. */
export type CareRouteSearchParams = Record<string, string | string[] | undefined>;

export type CareTab = "tasks" | "assignments" | "inactive";
export type CareFilter = ReturnType<typeof careFilterSchema.parse>;

/** Every query key the /student-care page owns; other keys (e.g. the /dev preview's) are left alone. */
export const careOwnedSearchParams = [
  "tab",
  "page",
  "month",
  "kind",
  "status",
  "search",
  "student_id",
  "mine",
  "overdue",
] as const;

type CareOwnedSearchParam = (typeof careOwnedSearchParams)[number];

/** Search cap shared by the input's maxLength, the URL reader and careFilterSchema (max 160). */
export const CARE_SEARCH_MAX_LENGTH = 160;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The month input's value as a filter change: `YYYY-MM` → the RPC's
 * first-of-month date, "" → clear (`undefined`), anything else → `null` (no
 * change). Browsers without a month picker (Safari, Firefox desktop) show a
 * text box, so "2026-1" while typing must not reach the URL.
 */
export function parseCareMonthInput(value: string): string | undefined | null {
  if (value === "") return undefined;
  return MONTH_PATTERN.test(value) ? `${value}-01` : null;
}

/**
 * First value of each owned param (`?kind=a&kind=b` filters by "a"), search
 * cut to 160 characters like the RPC, everything else dropped.
 */
export function getCareSearchParamValues(params: CareRouteSearchParams): Partial<Record<CareOwnedSearchParam, string>> {
  const values: Partial<Record<CareOwnedSearchParam, string>> = {};
  careOwnedSearchParams.forEach((key) => {
    const raw = params[key];
    const value = typeof raw === "string" ? raw : raw?.[0];
    if (value !== undefined) values[key] = key === "search" ? value.slice(0, CARE_SEARCH_MAX_LENGTH) : value;
  });
  return values;
}

/** URLSearchParams → route-style record (repeated keys become arrays, so the first value wins as on the server). */
export function toCareRouteSearchParams(params: URLSearchParams | string): CareRouteSearchParams {
  const record: CareRouteSearchParams = {};
  new URLSearchParams(params.toString()).forEach((value, key) => {
    const existing = record[key];
    record[key] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  });
  return record;
}

export function getCareTab(value: string | null | undefined): CareTab {
  return value === "assignments" || value === "inactive" ? value : "tasks";
}

/**
 * The dashboard filter from URL values through `careFilterSchema`: invalid
 * values are dropped (page falls back to 1), the month input's `YYYY-MM`
 * becomes the RPC's first-of-month date, a blank search is no search.
 */
export function parseCareFilter(values: Partial<Record<CareOwnedSearchParam, string>>): CareFilter {
  const month = values.month?.slice(0, 7);
  const search = values.search?.trim();
  return careFilterSchema.parse({
    kind: values.kind || undefined,
    mine: values.mine || undefined,
    month: month && MONTH_PATTERN.test(month) ? `${month}-01` : undefined,
    overdue: values.overdue || undefined,
    page: values.page,
    search: search ? search.slice(0, CARE_SEARCH_MAX_LENGTH) : undefined,
    status: values.status || undefined,
    student_id: values.student_id || undefined,
  });
}

/** Canonical owned query for a filter (only valid, non-default values), plus the tab. */
export function serializeCareFilter(filter: Partial<CareFilter>, tab: CareTab = "tasks"): URLSearchParams {
  const query = new URLSearchParams();
  if (tab !== "tasks") query.set("tab", tab);
  if (filter.search) query.set("search", filter.search);
  if (filter.student_id) query.set("student_id", filter.student_id);
  if (tab === "tasks") {
    if (filter.kind) query.set("kind", filter.kind);
    if (filter.status) query.set("status", filter.status);
    if (filter.month) query.set("month", filter.month.slice(0, 7));
    if (filter.overdue === "true") query.set("overdue", "true");
    if (filter.mine === "true") query.set("mine", "true");
  }
  if (filter.page && filter.page > 1) query.set("page", String(filter.page));
  return query;
}

/**
 * `current` with its owned keys replaced by the canonical query for `filter`
 * on `tab`: foreign keys (the preview's view/state/role) survive.
 */
export function withCareQuery(current: URLSearchParams | string, filter: Partial<CareFilter>, tab: CareTab = "tasks"): string {
  const next = new URLSearchParams(current.toString());
  careOwnedSearchParams.forEach((key) => next.delete(key));
  serializeCareFilter(filter, tab).forEach((value, key) => next.set(key, value));
  return next.toString();
}

/** Filters counted by "Xóa lọc (n)": search, kind, month, status, overdue, mine and the student filter. */
export function countCareActiveFilters(filter: Partial<CareFilter>, tab: CareTab = "tasks"): number {
  const shared = [filter.search, filter.student_id].filter(Boolean).length;
  if (tab !== "tasks") return shared;
  return shared + [filter.kind, filter.month, filter.status, filter.overdue === "true", filter.mine === "true"].filter(Boolean).length;
}

export type CareChip = "all" | "alert" | "monthly" | "followup" | "unassigned" | "overdue" | "mine";

/**
 * The quick chip matching the filter: "all" when no chip-owned filter and no
 * other status is set, the chip when exactly one is, `null` (no chip active)
 * when several are combined or a status from the filter bar narrows the list
 * that "Tất cả" would claim to show.
 */
export function getCareActiveChip(filter: Partial<CareFilter>): CareChip | null {
  const active: CareChip[] = [];
  if (filter.kind) active.push(filter.kind);
  if (filter.status === "unassigned") active.push("unassigned");
  if (filter.overdue === "true") active.push("overdue");
  if (filter.mine === "true") active.push("mine");
  if (active.length === 0) return filter.status ? null : "all";
  return active.length === 1 ? active[0] : null;
}

/**
 * One chip at a time: choosing a chip clears the other chip-owned filters
 * (kind, status "unassigned", overdue, mine) and sets its own; "all" clears
 * them. Search, month, student and a real status from the filter bar stay;
 * the page resets.
 */
export function applyCareChip(filter: Partial<CareFilter>, chip: CareChip): Partial<CareFilter> {
  const next: Partial<CareFilter> = {
    ...filter,
    kind: undefined,
    mine: undefined,
    overdue: undefined,
    page: 1,
    status: filter.status === "unassigned" ? undefined : filter.status,
  };
  if (chip === "alert" || chip === "monthly" || chip === "followup") next.kind = chip;
  if (chip === "unassigned") next.status = "unassigned";
  if (chip === "overdue") next.overdue = "true";
  if (chip === "mine") next.mine = "true";
  return next;
}
