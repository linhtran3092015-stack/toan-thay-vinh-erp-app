const crmOwnedSearchParams = [
  "search",
  "status",
  "grade",
  "source",
  "sale",
] as const;

type CrmOwnedSearchParam = (typeof crmOwnedSearchParams)[number];

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

const statusValues = new Set([
  "interested",
  "trial_booked",
  "trial_completed",
  "pending_enrollment_confirmation",
  "converted",
  "dropped",
]);

/**
 * CRM remains server-filtered. This small helper only preserves CRM's own
 * view query while links and controls leave unrelated URL state untouched.
 */
export function getCrmDirectoryQuery(params: SearchParamsLike): string {
  const query = new URLSearchParams();

  crmOwnedSearchParams.forEach((key) => {
    const value = params.get(key);
    if (isSafeOwnedValue(key, value)) query.set(key, value);
  });

  return query.toString();
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
  if (key === "search") return value.trim().length > 0 && value.length <= 160;
  if (key === "status") return statusValues.has(value);
  if (key === "grade") return /^(?:[1-9]|1[0-2])$/.test(value);
  if (key === "source" || key === "sale") return value.length > 0 && value.length <= 160;
  return false;
}
