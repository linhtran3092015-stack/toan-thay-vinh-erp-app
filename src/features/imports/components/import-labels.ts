import { formatIsoDate, getVietnamTime, toVietnamDate } from "@/lib/datetime";

/*
 * Shared wording helpers for the four import wizards (design 17c). Pure and
 * server-safe; every lookup is prototype-safe (`Object.hasOwn`), so a code
 * such as "constructor" falls back instead of printing a function.
 */

const ISO_WEEKDAY_LABELS: Readonly<Record<string, string>> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ nhật",
};

/**
 * ISO weekday (1 = Monday … 7 = Sunday, as the class schedule import stores
 * it) → "Thứ Hai" … "Chủ nhật". Never "Thứ 1": ISO 1 is Monday, which
 * Vietnamese calls Thứ Hai. A blank value reads "Không rõ thứ"; anything
 * else keeps the raw value visible, e.g. "Không rõ thứ (8)".
 */
export function formatIsoWeekday(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "Không rõ thứ";
  const text = String(value).trim();
  if (text === "") return "Không rõ thứ";
  if (/^[1-7]$/.test(text) && Object.hasOwn(ISO_WEEKDAY_LABELS, text)) {
    return ISO_WEEKDAY_LABELS[text];
  }
  return `Không rõ thứ (${text})`;
}

/**
 * ISO timestamp → "dd/MM/yyyy HH:mm" in Vietnam time (batch created,
 * committed and posted times), whatever the server or browser time zone.
 * Empty → "—"; an unparseable value is shown as given.
 */
export function formatImportTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatIsoDate(toVietnamDate(date))} ${getVietnamTime(date).slice(0, 5)}`;
}

/**
 * Code → label from a feature-owned map, or the fallback when the map has no
 * own entry for it (inherited keys such as "constructor" or "toString" never
 * match). The fallback may be a function of the raw code, e.g.
 * `(code) => \`Trạng thái chưa hỗ trợ: ${code}\``.
 */
export function labelFrom(
  map: Readonly<Record<string, string>>,
  code: string | null | undefined,
  fallback: string | ((code: string) => string),
): string {
  const key = code ?? "";
  if (Object.hasOwn(map, key)) return map[key];
  return typeof fallback === "function" ? fallback(key) : fallback;
}
