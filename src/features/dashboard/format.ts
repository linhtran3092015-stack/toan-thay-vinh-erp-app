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

export function formatVnd(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatCompactVnd(amount: number): string {
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";

  if (absolute >= 1_000_000_000) {
    const value = absolute / 1_000_000_000;
    return `${sign}${decimalFormatter.format(value)} tỷ`;
  }

  if (absolute >= 1_000_000) {
    const value = absolute / 1_000_000;
    return `${sign}${decimalFormatter.format(value)} tr`;
  }

  if (absolute >= 1_000) {
    const value = absolute / 1_000;
    return `${sign}${decimalFormatter.format(value)} k`;
  }

  return `${sign}${integerFormatter.format(absolute)} ₫`;
}

export function formatNumber(value: number): string {
  return integerFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${decimalFormatter.format(value)}%`;
}

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
  const year = match[1];
  const month = Number(match[2]);
  return `Tháng ${month}/${year}`;
}

export function formatShortMonthLabel(monthIndex: number): string {
  // 1-12 -> T1..T12
  return `T${monthIndex}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
