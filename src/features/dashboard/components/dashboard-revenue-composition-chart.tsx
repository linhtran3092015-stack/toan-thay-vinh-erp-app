import { Card } from "@/components/ui/card";
import { formatCompactVnd, formatPercent, formatVnd } from "@/features/dashboard/format";
import type { DashboardSectionState, RevenueCompositionItem } from "@/features/dashboard/read-models";

interface DashboardRevenueCompositionChartProps {
  section: DashboardSectionState<RevenueCompositionItem[]>;
}

const colorPalette = [
  "#315FCC", // Violet/Blue
  "#16794C", // Emerald
  "#8B5FBF", // Purple
  "#C06A1B", // Amber/Orange
  "#2E7D8A", // Teal
  "#B04462", // Rose
  "#667085", // Slate
];

export function DashboardRevenueCompositionChart({
  section,
}: DashboardRevenueCompositionChartProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <Card className="flex h-80 items-center justify-center rounded-2xl border border-warning-border bg-warning-bg p-6 text-center text-warning">
        <div>
          <p className="font-bold">Không thể tải cơ cấu doanh thu</p>
          <p className="mt-1 text-xs text-ink-muted">Vui lòng thử lại sau.</p>
        </div>
      </Card>
    );
  }

  const items = section.data;
  const totalRevenue = items.reduce((sum, item) => sum + item.amountVnd, 0);

  // SVG Donut calculation
  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  const segments = items.reduce<
    {
      color: string;
      dashOffset: number;
      item: RevenueCompositionItem;
      segment: number;
      totalOffset: number;
    }[]
  >((acc, item, index) => {
    const color = colorPalette[index % colorPalette.length];
    const segment = Math.max(0, item.sharePercent / 100) * circumference;
    const previousOffset = acc.at(-1)?.totalOffset ?? 0;
    return [
      ...acc,
      {
        color,
        dashOffset: -previousOffset,
        item,
        segment,
        totalOffset: previousOffset + segment,
      },
    ];
  }, []);

  return (
    <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6">
      <div>
        <h2 className="font-display text-base font-bold text-ink sm:text-lg">
          Cơ cấu doanh thu
        </h2>
        <p className="text-xs text-ink-muted">
          Tỷ trọng các nguồn thu đã ghi nhận trong kỳ
        </p>
      </div>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[minmax(160px,1fr)_minmax(0,1.2fr)]">
        {/* Donut Chart */}
        <div className="relative mx-auto aspect-square w-full max-w-[210px]">
          <svg
            aria-label={`Biểu đồ cơ cấu doanh thu, tổng ${formatVnd(totalRevenue)}`}
            className="h-full w-full"
            role="img"
            viewBox="0 0 180 180"
          >
            <circle
              cx="90"
              cy="90"
              fill="none"
              r={radius}
              stroke="var(--color-surface-2, #F1F3F7)"
              strokeWidth="20"
            />
            {totalRevenue > 0 ? (
              segments.map(({ color, dashOffset, item, segment }) => (
                <circle
                  cx="90"
                  cy="90"
                  fill="none"
                  key={item.category}
                  r={radius}
                  stroke={color}
                  strokeDasharray={`${segment} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeWidth="20"
                  transform="rotate(-90 90 90)"
                >
                  <title>{`${item.label}: ${formatVnd(item.amountVnd)} (${formatPercent(item.sharePercent)})`}</title>
                </circle>
              ))
            ) : (
              <circle
                cx="90"
                cy="90"
                fill="none"
                r={radius}
                stroke="#CBD5E1"
                strokeWidth="20"
              />
            )}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Tổng thu
            </span>
            <strong className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink sm:text-xl">
              {formatCompactVnd(totalRevenue)}
            </strong>
          </div>
        </div>

        {/* Legend */}
        <ul className="grid gap-2.5 text-xs" aria-label="Chú giải cơ cấu doanh thu">
          {items.map((item, index) => {
            const color = colorPalette[index % colorPalette.length];
            return (
              <li
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-surface-2"
                key={item.category}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-xs"
                  style={{ backgroundColor: color }}
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink" title={item.label}>
                    {item.label}
                  </p>
                  <p className="text-[11px] tabular-nums text-ink-muted">
                    {formatVnd(item.amountVnd)}
                  </p>
                </div>
                <div className="text-right font-bold tabular-nums text-ink">
                  {formatPercent(item.sharePercent)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
