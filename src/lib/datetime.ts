/**
 * Shared date/time helpers. Business dates are `YYYY-MM-DD` strings in
 * Vietnam time; timestamps are ISO strings rendered in Asia/Ho_Chi_Minh.
 */

export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const VI_SHORT_WEEKDAYS = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"] as const;

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
});

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/** `2026-10-13` → `13/10/2026`. Accepts timestamps too (uses the date part as-is). */
export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = ISO_DATE_PATTERN.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/**
 * `2026-10-13` → `Thứ 2, 13/10/2026`; with `{ year: false }` → `Thứ 2 13/10`
 * (compact form for tight spaces such as KPI tiles).
 */
export function formatWeekdayDate(value: string, options?: { year?: boolean }): string {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return value;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const weekday = VI_SHORT_WEEKDAYS[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
  if (options?.year === false) return `${weekday} ${match[3]}/${match[2]}`;
  return `${weekday}, ${match[3]}/${match[2]}/${match[1]}`;
}

/** ISO timestamp → `13/10/2026 08:30` in Vietnam time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

/** `18:00:00` → `18:00`. */
export function formatTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "—";
}

/** Today's business date in Vietnam as `YYYY-MM-DD`. */
export function getVietnamToday(now: Date = new Date()): string {
  const parts = dateOnlyFormatter.formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

const timeOnlyFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  second: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
});

/** Current wall-clock time in Vietnam as `HH:MM:SS` (comparable with `time` columns). */
export function getVietnamTime(now: Date = new Date()): string {
  const parts = timeOnlyFormatter.formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.hour}:${value.minute}:${value.second}`;
}

/** Timestamp → Vietnam business date `YYYY-MM-DD`. */
export function toVietnamDate(value: string | Date): string {
  return getVietnamToday(typeof value === "string" ? new Date(value) : value);
}

/** Add days to a `YYYY-MM-DD` date without timezone drift. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** `2026-10` → `10/2026`. */
export function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[2]}/${match[1]}` : value;
}
