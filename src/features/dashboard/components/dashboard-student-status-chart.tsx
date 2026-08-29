import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/features/dashboard/format";
import type { DashboardSectionState, StudentStatusDistribution } from "@/features/dashboard/read-models";

interface DashboardStudentStatusChartProps {
  section: DashboardSectionState<StudentStatusDistribution>;
}

export function DashboardStudentStatusChart({
  section,
}: DashboardStudentStatusChartProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <Card className="flex h-80 items-center justify-center rounded-2xl border border-warning-border bg-warning-bg p-6 text-center text-warning">
        <div>
          <p className="font-bold">Không thể tải tình hình học sinh</p>
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
            Tình hình học sinh
          </h2>
          <p className="text-xs text-ink-muted">
            Phân loại theo trạng thái học tập của học viên
          </p>
        </div>

        <Link
          className="text-xs font-semibold text-primary transition hover:underline"
          href="/students"
        >
          Danh sách HS →
        </Link>
      </div>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[minmax(160px,1fr)_minmax(0,1.2fr)]">
        {/* Donut Chart */}
        <div className="relative mx-auto aspect-square w-full max-w-[210px]">
          <svg
            aria-label={`Biểu đồ tình hình học sinh, tổng ${formatNumber(data.totalCount)} học sinh`}
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
            {data.totalCount > 0 ? (
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
                  <title>{`${item.label}: ${formatNumber(item.count)} (${formatPercent(item.percentage)})`}</title>
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
              Tổng số
            </span>
            <strong className="mt-0.5 font-display text-xl font-bold tabular-nums text-ink sm:text-2xl">
              {formatNumber(data.totalCount)}
            </strong>
            <span className="text-[11px] text-ink-muted">học sinh</span>
          </div>
        </div>

        {/* Legend */}
        <ul className="grid gap-2.5 text-xs" aria-label="Chú giải trạng thái học sinh">
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
                  {formatNumber(item.count)} học sinh
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
