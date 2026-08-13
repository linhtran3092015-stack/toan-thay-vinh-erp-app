import type { FinanceOrderFiltersState } from "./read-models";

const ownedParams = ["month", "orderType", "source", "period"] as const;
const orderTypes = new Set(["new_enrollment", "renewal"]);
const sources = new Set(["mma", "sb", "sb_f1"]);
const periods = new Set(["1", "2", "3"]);

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

export function defaultFinanceOrdersFilters(now = new Date()): FinanceOrderFiltersState {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(now);
  const year = dateParts.find((part) => part.type === "year")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;

  return {
    month: year && month ? `${year}-${month}` : "",
    orderType: "",
    period: "",
    source: "",
  };
}

export function parseFinanceOrdersFilters(
  params: SearchParamsLike,
  now = new Date(),
): FinanceOrderFiltersState {
  const defaults = defaultFinanceOrdersFilters(now);
  const orderType = params.get("orderType");
  const source = params.get("source");
  const period = params.get("period");

  return {
    month: parseMonth(params.get("month")) ?? defaults.month,
    orderType: orderType && orderTypes.has(orderType)
      ? orderType as FinanceOrderFiltersState["orderType"]
      : "",
    period: period && periods.has(period)
      ? period as FinanceOrderFiltersState["period"]
      : "",
    source: source && sources.has(source)
      ? source as FinanceOrderFiltersState["source"]
      : "",
  };
}

export function serializeFinanceOrdersFilters(
  current: SearchParamsLike,
  filters: FinanceOrderFiltersState,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  ownedParams.forEach((key) => next.delete(key));

  next.set("month", filters.month);
  if (filters.orderType) next.set("orderType", filters.orderType);
  if (filters.source) next.set("source", filters.source);
  if (filters.period) next.set("period", filters.period);

  return next;
}

export function getFinanceOrdersQuery(filters: FinanceOrderFiltersState): string {
  return serializeFinanceOrdersFilters(new URLSearchParams(), filters).toString();
}

function parseMonth(value: string | null): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}
