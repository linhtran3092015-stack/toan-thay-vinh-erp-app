/**
 * Vietnamese phone number as stored on guardians: "+84 912.345.678",
 * "84912345678" and "0912 345 678" all become "0912345678". `isValid` only
 * for mobile numbers (0 + 3/5/7/8/9 + 8 digits). `compact` is the input
 * without spaces, dots and dashes, before the +84/84 rewrite.
 */
export function normalizeVietnamPhoneNumber(value: string): { compact: string; isValid: boolean; normalized: string } {
  const compact = value.trim().replace(/[\s.-]/g, "");
  const normalized = compact.startsWith("+84")
    ? `0${compact.slice(3)}`
    : compact.startsWith("84")
      ? `0${compact.slice(2)}`
      : compact;
  return { compact, isValid: /^0(3|5|7|8|9)\d{8}$/.test(normalized), normalized };
}
