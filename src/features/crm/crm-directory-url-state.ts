import { CRM_CASE_STATUSES } from "./crm-presentation";
import type { CrmCaseStatus } from "./read-models";

const crmOwnedSearchParams = [
  "search",
  "status",
  "grade",
  "source",
  "sale",
] as const;

type CrmOwnedSearchParam = (typeof crmOwnedSearchParams)[number];

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

const statusValues = new Set<string>(CRM_CASE_STATUSES);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GRADE_PATTERN = /^(?:[1-9]|1[0-2])$/;

/** Longest search the directory uses; a longer one is cut to this length everywhere. */
const SEARCH_MAX_LENGTH = 160;

/**
 * True when the URL's `sale` is a profile id. The loaders and the filter bar
 * both ignore anything else (a hand-edited URL) instead of failing or counting it.
 */
export function isCrmSaleOwnerId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * The URL's `grade` as a whole grade 1–12, else `null`. The loaders and the
 * filter bar both ignore anything else (`abc`, `1.5`, `13`) instead of casting
 * it in the query or counting it as an active filter.
 */
export function getCrmDirectoryGrade(value: string | null | undefined): number | null {
  return typeof value === "string" && GRADE_PATTERN.test(value) ? Number(value) : null;
}

/**
 * Search term safe inside a PostgREST `.or()` list: `,` `(` `)` would split or
 * nest the filter, `"` and `\` would open quoting/escapes, so a typed
 * "Nguyễn (Hân)" otherwise turns into a failed query instead of a search. A
 * search that is empty after this (e.g. `()`) filters nothing, so the URL
 * helpers and the filter bar do not treat it as an active filter either.
 */
export function sanitizeCrmSearchTerm(search: string): string {
  return search.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Route `searchParams` as Next passes them: a repeated key arrives as an array. */
export type CrmRouteSearchParams = Record<string, string | string[] | undefined>;

/**
 * The first value of each CRM-owned param, so `?search=a&search=b` filters by
 * "a" instead of handing an array to the loaders. A search longer than 160
 * characters is cut to 160, as in the directory query string.
 */
export function getCrmOwnedSearchParamValues(
  params: CrmRouteSearchParams,
): Partial<Record<CrmOwnedSearchParam, string>> {
  const values: Partial<Record<CrmOwnedSearchParam, string>> = {};
  crmOwnedSearchParams.forEach((key) => {
    const raw = params[key];
    const value = typeof raw === "string" ? raw : raw?.[0];
    if (value !== undefined) values[key] = key === "search" ? value.slice(0, SEARCH_MAX_LENGTH) : value;
  });
  return values;
}

/**
 * CRM remains server-filtered. This small helper only preserves CRM's own
 * view query while links and controls leave unrelated URL state untouched.
 */
export function getCrmDirectoryQuery(params: SearchParamsLike): string {
  const query = new URLSearchParams();

  crmOwnedSearchParams.forEach((key) => {
    const raw = params.get(key);
    const value = key === "search" && raw !== null ? raw.slice(0, SEARCH_MAX_LENGTH) : raw;
    if (isSafeOwnedValue(key, value)) query.set(key, value);
  });

  return query.toString();
}

/**
 * The URL's `status` when it is a known CRM status, else `null`: an unknown
 * value is ignored by the directory query, as it is in detail links.
 */
export function getCrmDirectoryStatus(value: string | null | undefined): CrmCaseStatus | null {
  return isSafeOwnedValue("status", value ?? null) ? (value as CrmCaseStatus) : null;
}

export function getCrmDirectoryHref(params: SearchParamsLike): string {
  const query = getCrmDirectoryQuery(params);
  return query ? `/crm?${query}` : "/crm";
}

export function serializeCrmDirectoryFilterChange(
  currentParams: SearchParamsLike,
  key: CrmOwnedSearchParam,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(currentParams.toString());

  if (value) next.set(key, value);
  else next.delete(key);

  return next;
}

export function resetCrmDirectoryFilters(
  currentParams: SearchParamsLike,
): URLSearchParams {
  const next = new URLSearchParams(currentParams.toString());
  crmOwnedSearchParams.forEach((key) => next.delete(key));
  return next;
}

function isSafeOwnedValue(
  key: CrmOwnedSearchParam,
  value: string | null,
): value is string {
  if (value === null) return false;
  if (key === "search") return sanitizeCrmSearchTerm(value).length > 0 && value.length <= SEARCH_MAX_LENGTH;
  if (key === "status") return statusValues.has(value);
  if (key === "grade") return getCrmDirectoryGrade(value) !== null;
  if (key === "source") return value.length > 0 && value.length <= 160;
  if (key === "sale") return isCrmSaleOwnerId(value);
  return false;
}
