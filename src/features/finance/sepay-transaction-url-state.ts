import type { SepayTransactionReadModel } from "./read-models";

export type SepayAccountPurposeFilter = "" | SepayTransactionReadModel["accountPurpose"];

const validPurposes = new Set(["new_enrollment", "renewal", "unknown"]);

export function parseSepayAccountPurposeFilter(value: string | string[] | undefined): SepayAccountPurposeFilter {
  if (typeof value !== "string" || !validPurposes.has(value)) return "";
  return value as SepayAccountPurposeFilter;
}

export function getSepayAccountPurposeQuery(purpose: SepayAccountPurposeFilter): string {
  return purpose ? `?accountPurpose=${purpose}` : "";
}
