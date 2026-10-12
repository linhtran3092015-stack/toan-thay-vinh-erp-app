/**
 * Shared number and money formatting. One currency symbol (₫) everywhere;
 * compact "triệu/tỷ" only for dashboard-style summaries.
 */

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const integerFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

/** `1.400.000 ₫` */
export function formatVnd(amount: number): string {
  return currencyFormatter.format(amount);
}

/** `1,4 triệu`, `2,3 tỷ`, `850.000 ₫` for small amounts. */
export function formatCompactVnd(amount: number): string {
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";

  if (absolute >= 1_000_000_000) {
    return `${sign}${decimalFormatter.format(absolute / 1_000_000_000)} tỷ`;
  }
  if (absolute >= 1_000_000) {
    return `${sign}${decimalFormatter.format(absolute / 1_000_000)} triệu`;
  }
  return `${sign}${integerFormatter.format(absolute)} ₫`;
}

/** Plain integer with Vietnamese thousands separators. */
export function formatNumber(value: number): string {
  return integerFormatter.format(value);
}

/** `12,5%` */
export function formatPercent(value: number): string {
  return `${decimalFormatter.format(value)}%`;
}

/** Learning mode copy shared by students, classes and sessions. */
export function formatLearningMode(value: string | null | undefined): string {
  if (value === "offline") return "Tại lớp";
  if (value === "online") return "Trực tuyến";
  if (value === "hybrid") return "Kết hợp";
  return "Chưa xác định";
}

/** Session counts read naturally in Vietnamese ("12 buổi"). */
export function formatSessions(count: number): string {
  return `${integerFormatter.format(count)} buổi`;
}
