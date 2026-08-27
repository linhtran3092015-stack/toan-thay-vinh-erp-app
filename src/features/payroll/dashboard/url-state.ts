const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function getCurrentPayrollMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}-01`;
}

export function parsePayrollDashboardMonth(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && monthPattern.test(candidate)
    ? `${candidate}-01`
    : getCurrentPayrollMonth();
}

export function parsePayrollDashboardPosition(
  value: string | string[] | undefined,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  const normalized = candidate.trim();
  return normalized.length > 0 && normalized.length <= 80 ? normalized : null;
}
