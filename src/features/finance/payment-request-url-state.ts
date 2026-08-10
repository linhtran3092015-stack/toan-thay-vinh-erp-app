import type { PaymentRequestFiltersState } from "./read-models";

const ownedParams = ["search", "status", "topupType", "createdFrom", "createdTo", "page"] as const;
type OwnedParam = (typeof ownedParams)[number];

const statuses = new Set(["pending", "partially_paid", "paid", "expired", "cancelled"]);
const topupTypes = new Set(["new", "renewal"]);

export const defaultPaymentRequestFilters: PaymentRequestFiltersState = {
  createdFrom: "",
  createdTo: "",
  search: "",
  status: "",
  topupType: "",
};

export interface PaymentRequestDirectoryViewState {
  filters: PaymentRequestFiltersState;
  page: number;
}

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

/** Finance-local composition buffer for rapid filter replacements. */
export function mergePendingPaymentRequestFilter(
  pending: PaymentRequestFiltersState | null,
  rendered: PaymentRequestFiltersState,
  key: keyof PaymentRequestFiltersState,
  value: string,
): PaymentRequestFiltersState {
  return { ...(pending ?? rendered), [key]: value };
}

export function arePaymentRequestFiltersEqual(
  left: PaymentRequestFiltersState,
  right: PaymentRequestFiltersState,
): boolean {
  return left.search === right.search
    && left.status === right.status
    && left.topupType === right.topupType
    && left.createdFrom === right.createdFrom
    && left.createdTo === right.createdTo;
}

export function parsePaymentRequestDirectoryViewState(
  params: SearchParamsLike,
): PaymentRequestDirectoryViewState {
  const status = params.get("status");
  const topupType = params.get("topupType");

  return {
    filters: {
      createdFrom: parseCalendarDate(params.get("createdFrom")),
      createdTo: parseCalendarDate(params.get("createdTo")),
      search: params.get("search") ?? defaultPaymentRequestFilters.search,
      status: status && statuses.has(status) ? status as PaymentRequestFiltersState["status"] : defaultPaymentRequestFilters.status,
      topupType: topupType && topupTypes.has(topupType) ? topupType as PaymentRequestFiltersState["topupType"] : defaultPaymentRequestFilters.topupType,
    },
    page: parsePage(params.get("page")),
  };
}

export function serializePaymentRequestDirectoryViewState(
  current: SearchParamsLike,
  state: PaymentRequestDirectoryViewState,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  ownedParams.forEach((key) => next.delete(key));

  if (state.filters.search.trim()) next.set("search", state.filters.search);
  if (state.filters.status) next.set("status", state.filters.status);
  if (state.filters.topupType) next.set("topupType", state.filters.topupType);
  if (isCalendarDate(state.filters.createdFrom)) next.set("createdFrom", state.filters.createdFrom);
  if (isCalendarDate(state.filters.createdTo)) next.set("createdTo", state.filters.createdTo);
  if (state.page > 1) next.set("page", String(state.page));

  return next;
}

export function getPaymentRequestDirectoryHref(
  current: SearchParamsLike,
  state: PaymentRequestDirectoryViewState,
): string {
  const query = serializePaymentRequestDirectoryViewState(current, state).toString();
  return query ? `/finance/payment-requests?${query}` : "/finance/payment-requests";
}

export function getPaymentRequestDirectoryQuery(params: SearchParamsLike): string {
  const query = new URLSearchParams();

  ownedParams.forEach((key) => {
    const value = params.get(key);
    if (isSafeValue(key, value)) query.set(key, value);
  });

  return query.toString();
}

export function resetPaymentRequestDirectoryViewState(): PaymentRequestDirectoryViewState {
  return { filters: defaultPaymentRequestFilters, page: 1 };
}

function parsePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function parseCalendarDate(value: string | null): string {
  return value && isCalendarDate(value) ? value : "";
}

function isSafeValue(key: OwnedParam, value: string | null): value is string {
  if (value === null) return false;
  if (key === "search") return value.length <= 160;
  if (key === "status") return statuses.has(value);
  if (key === "topupType") return topupTypes.has(value);
  if (key === "createdFrom" || key === "createdTo") return isCalendarDate(value);
  return /^[1-9]\d*$/.test(value);
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
