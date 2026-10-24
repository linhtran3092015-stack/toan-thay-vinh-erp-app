/**
 * /payroll shows the latest few periods; each "older periods" click adds this many.
 * The RPC's default list size (migration 20261024150000) uses the same number.
 */
export const RECENT_PAYROLL_PERIOD_COUNT = 3;
/** Upper bound get_payroll_period_details() accepts for one list read; the migration checks the same 60. */
export const MAX_PAYROLL_PERIOD_COUNT = 60;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `?period=` on /payroll: a period a link asks to show even outside the recent window. */
export function parsePayrollPeriodId(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && uuidPattern.test(candidate) ? candidate : null;
}

/** `?periods=` on /payroll: how many recent periods to read, clamped to the RPC's range. */
export function parsePayrollPeriodCount(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const count = candidate && /^\d+$/.test(candidate) ? Number(candidate) : RECENT_PAYROLL_PERIOD_COUNT;
  return Math.min(Math.max(count, RECENT_PAYROLL_PERIOD_COUNT), MAX_PAYROLL_PERIOD_COUNT);
}

/** The next batch of older periods: how many it adds and the link that loads it. */
export function getOlderPayrollPeriodsLink(
  periodCount: number,
  olderPeriodCount: number,
  includedPeriodId: string | null = null,
): { addedCount: number; href: string } | null {
  const nextCount = Math.min(periodCount + RECENT_PAYROLL_PERIOD_COUNT, MAX_PAYROLL_PERIOD_COUNT);
  const addedCount = Math.min(nextCount - periodCount, olderPeriodCount);
  if (addedCount <= 0) return null;
  const included = includedPeriodId ? `&period=${encodeURIComponent(includedPeriodId)}` : "";
  return { addedCount, href: `/payroll?periods=${periodCount + addedCount}${included}` };
}

/** A payslip link that remembers how many periods /payroll was showing. */
export function getPayslipHref(
  periodId: string,
  statementId: string,
  periodCount: number = RECENT_PAYROLL_PERIOD_COUNT,
): string {
  const href = `/payroll/${periodId}/statements/${statementId}/payslip`;
  return periodCount > RECENT_PAYROLL_PERIOD_COUNT ? `${href}?periods=${periodCount}` : href;
}

/**
 * Back from a payslip: the same window, with the payslip's own period loaded
 * (it may be older than the window, e.g. opened from a Tạm ứng link) and in view.
 */
export function getPayrollReturnHref(
  periodId: string,
  periodCount: number = RECENT_PAYROLL_PERIOD_COUNT,
): string {
  const id = encodeURIComponent(periodId);
  const periods = periodCount > RECENT_PAYROLL_PERIOD_COUNT ? `periods=${periodCount}&` : "";
  return `/payroll?${periods}period=${id}#payroll-period-${id}`;
}
