// Dashboard formatting now lives in the shared library; this module keeps the
// feature-local import path stable.
export { formatCompactVnd, formatNumber, formatPercent, formatVnd } from "@/lib/format";
import { formatDateTime as sharedFormatDateTime } from "@/lib/datetime";

const decimalFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function formatTrendPercent(value: number | null): {
  direction: "down" | "neutral" | "up";
  formatted: string;
} {
  if (value === null || Number.isNaN(value)) {
    return {
      direction: "neutral",
      formatted: "−",
    };
  }

  if (value > 0) {
    return {
      direction: "up",
      formatted: `+${decimalFormatter.format(value)}%`,
    };
  }

  if (value < 0) {
    return {
      direction: "down",
      formatted: `${decimalFormatter.format(value)}%`,
    };
  }

  return {
    direction: "neutral",
    formatted: "0%",
  };
}

export function formatMonthYear(monthStr: string): string {
  // Format YYYY-MM into "Tháng M/YYYY"
  const match = /^(\d{4})-(\d{2})/.exec(monthStr);
  if (!match) return monthStr;
  return `Tháng ${Number(match[2])}/${match[1]}`;
}

export function formatShortMonthLabel(monthIndex: number): string {
  // 1-12 -> T1..T12
  return `T${monthIndex}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  return sharedFormatDateTime(value);
}
