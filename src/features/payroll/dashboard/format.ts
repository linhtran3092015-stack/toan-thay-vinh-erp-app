const fullCurrencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
  style: "currency",
});

const compactNumberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
});

const percentageFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function formatVnd(value: number): string {
  return fullCurrencyFormatter.format(value).replace(/\s+/g, " ");
}

export function formatCompactVnd(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";

  if (absolute >= 1_000_000_000) {
    return `${sign}${compactNumberFormatter.format(absolute / 1_000_000_000)} tỷ`;
  }

  if (absolute >= 1_000_000) {
    return `${sign}${compactNumberFormatter.format(absolute / 1_000_000)} triệu`;
  }

  if (absolute >= 1_000) {
    return `${sign}${compactNumberFormatter.format(absolute / 1_000)} nghìn`;
  }

  return `${sign}${compactNumberFormatter.format(absolute)} ₫`;
}

export function formatPercent(value: number): string {
  return `${percentageFormatter.format(value)}%`;
}

export function formatSignedPercent(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatPercent(Math.abs(value))}`;
}

export function formatDashboardMonth(value: string): string {
  const [year, month] = value.slice(0, 10).split("-");
  return `Tháng ${month}/${year}`;
}

export function formatShortMonth(value: string): string {
  const [year, month] = value.slice(0, 10).split("-");
  return `${month}/${year}`;
}
