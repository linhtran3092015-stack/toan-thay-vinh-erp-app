import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatCompactVnd, formatPercent, formatVnd } from "@/features/dashboard/format";
import type { DashboardSectionState, ReceivablesAgingDistribution } from "@/features/dashboard/read-models";

interface DashboardReceivablesAgingChartProps {
  section: DashboardSectionState<ReceivablesAgingDistribution>;
}

export function DashboardReceivablesAgingChart({
  section,
}: DashboardReceivablesAgingChartProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <Card className="flex h-80 items-center justify-center rounded-2xl border border-warning-border bg-warning-bg p-6 text-center text-warning">
        <div>
          <p className="font-bold">Không thể tải phân tích công nợ</p>
          <p className="mt-1 text-xs text-ink-muted">Vui lòng thử lại sau.</p>
        </div>
      </Card>
    );
  }

  const data = section.data;

  // SVG Donut calculation
  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  const segments = data.items.reduce<
    {
      color: string;
      dashOffset: number;
      item: (typeof data.items)[0];
      segment: number;
      totalOffset: number;
    }[]
  >((acc, item) => {
    const segment = Math.max(0, item.percentage / 100) * circumference;
    const previousOffset = acc.at(-1)?.totalOffset ?? 0;
    return [
      ...acc,
      {
        color: item.color,
        dashOffset: -previousOffset,
        item,
        segment,
        totalOffset: previousOffset + segment,
      },
    ];
  }, []);

  return (
    <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink sm:text-lg">
            Công nợ & Tuổi nợ phải thu
          </h2>
          <p className="text-xs text-ink-muted">
            Phân loại thời hạn chưa thanh toán học phí
          </p>
        </div>

        <Link
          className="text-xs font-semibold text-primary transition hover:underline"
          href="/finance/payment-requests"
        >
          Yêu cầu thu →
        </Link>
      </div>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[minmax(160px,1fr)_minmax(0,1.2fr)]">
        {/* Donut Chart */}
        <div className="relative mx-auto aspect-square w-full max-w-[210px]">
          <svg
            aria-label={`Biểu đồ tuổi nợ học phí, tổng nợ ${formatVnd(data.totalReceivablesVnd)}`}
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
            {data.totalReceivablesVnd > 0 ? (
              segments.map(({ color, dashOffset, item, segment }) => (
                <circle
                  cx="90"
                  cy="90"
                  fill="none"
                  key={item.key}
                  r={radius}
                  stroke={color}
                  strokeDasharray={`${segment} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeWidth="20"
                  transform="rotate(-90 90 90)"
                >
                  <title>{`${item.label}: ${formatVnd(item.amountVnd)} (${formatPercent(item.percentage)})`}</title>
                </circle>
              ))
            ) : (
              <circle
                cx="90"
                cy="90"
                fill="none"
                r={radius}
                stroke="#16794C"
                strokeWidth="20"
              />
            )}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Tổng công nợ
            </span>
            <strong className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink sm:text-xl">
              {formatCompactVnd(data.totalReceivablesVnd)}
            </strong>
          </div>
        </div>

        {/* Legend */}
        <ul className="grid gap-2.5 text-xs" aria-label="Chú giải tuổi nợ">
          {data.items.map((item) => (
            <li
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-surface-2"
              key={item.key}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-xs"
                style={{ backgroundColor: item.color }}
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
                {formatPercent(item.percentage)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
