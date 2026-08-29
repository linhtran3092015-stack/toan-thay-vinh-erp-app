"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { formatCompactVnd, formatVnd } from "@/features/dashboard/format";
import type { DashboardSectionState, MonthlyRevenueTrendItem } from "@/features/dashboard/read-models";

interface DashboardRevenueTrendChartProps {
  availableYears: readonly number[];
  section: DashboardSectionState<MonthlyRevenueTrendItem[]>;
  selectedYear: number;
}

export function DashboardRevenueTrendChart({
  section,
  selectedYear,
}: DashboardRevenueTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <Card className="flex h-80 items-center justify-center rounded-2xl border border-warning-border bg-warning-bg p-6 text-center text-warning">
        <div>
          <p className="font-bold">Không thể tải biểu đồ doanh thu theo tháng</p>
          <p className="mt-1 text-xs text-ink-muted">Vui lòng thử lại sau.</p>
        </div>
      </Card>
    );
  }

  const items = section.data;
  const maxVal = Math.max(
    1_000_000,
    ...items.map((i) => Math.max(i.revenueVnd, i.costVnd)),
  );

  // SVG Chart Geometry
  const width = 640;
  const height = 260;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const groupWidth = chartWidth / 12;
  const barWidth = Math.max(6, Math.min(14, groupWidth * 0.35));

  const totalYearRevenue = items.reduce((sum, i) => sum + i.revenueVnd, 0);
  const totalYearCost = items.reduce((sum, i) => sum + i.costVnd, 0);

  return (
    <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-base font-bold text-ink sm:text-lg">
            Doanh thu & Chi phí theo tháng
          </h2>
          <p className="text-xs text-ink-muted">
            Xu hướng tài chính 12 tháng năm {selectedYear} (Đơn vị: VNĐ)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-emerald-600" />
            <span className="font-medium text-ink">Doanh thu ({formatCompactVnd(totalYearRevenue)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-amber-500" />
            <span className="font-medium text-ink">Chi phí ({formatCompactVnd(totalYearCost)})</span>
          </div>
        </div>
      </div>

      <div className="relative mt-5 w-full overflow-x-auto">
        <svg
          aria-label={`Biểu đồ doanh thu 12 tháng năm ${selectedYear}`}
          className="h-auto min-w-[580px] w-full"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* Y-axis Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingTop + chartHeight - ratio * chartHeight;
            const value = maxVal * ratio;
            return (
              <g key={ratio}>
                <line
                  stroke="var(--color-hairline, #E6EAF2)"
                  strokeDasharray="3 3"
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                />
                <text
                  className="fill-ink-subtle text-[10px]"
                  textAnchor="end"
                  x={paddingLeft - 8}
                  y={y + 3}
                >
                  {formatCompactVnd(value)}
                </text>
              </g>
            );
          })}

          {/* Month Bars */}
          {items.map((item, index) => {
            const groupX = paddingLeft + index * groupWidth;
            const centerX = groupX + groupWidth / 2;

            const revenueHeight = (item.revenueVnd / maxVal) * chartHeight;
            const costHeight = (item.costVnd / maxVal) * chartHeight;

            const revenueY = paddingTop + chartHeight - revenueHeight;
            const costY = paddingTop + chartHeight - costHeight;

            const isHovered = hoveredIndex === index;

            return (
              <g
                className="cursor-pointer transition-opacity"
                key={item.month}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Background hover column */}
                <rect
                  className={`transition-colors ${
                    isHovered ? "fill-primary/5" : "fill-transparent"
                  }`}
                  height={chartHeight + 10}
                  rx={4}
                  width={groupWidth - 4}
                  x={groupX + 2}
                  y={paddingTop}
                />

                {/* Revenue Bar */}
                <rect
                  className="fill-emerald-600 transition-all hover:brightness-110"
                  height={Math.max(2, revenueHeight)}
                  rx={3}
                  width={barWidth}
                  x={centerX - barWidth - 1}
                  y={revenueY}
                >
                  <title>{`Doanh thu ${item.monthLabel}: ${formatVnd(item.revenueVnd)}`}</title>
                </rect>

                {/* Cost Bar */}
                <rect
                  className="fill-amber-500 transition-all hover:brightness-110"
                  height={Math.max(2, costHeight)}
                  rx={3}
                  width={barWidth}
                  x={centerX + 1}
                  y={costY}
                >
                  <title>{`Chi phí ${item.monthLabel}: ${formatVnd(item.costVnd)}`}</title>
                </rect>

                {/* Month Label */}
                <text
                  className={`text-[11px] font-medium transition-colors ${
                    isHovered ? "fill-primary font-bold" : "fill-ink-muted"
                  }`}
                  textAnchor="middle"
                  x={centerX}
                  y={height - 12}
                >
                  {item.monthLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip on Hover */}
        {hoveredIndex !== null && items[hoveredIndex] ? (
          <div
            className="pointer-events-none absolute top-2 rounded-xl border border-hairline bg-surface-1/95 p-3 text-xs shadow-md backdrop-blur-xs transition"
            style={{
              left: `${Math.min(
                80,
                Math.max(10, ((hoveredIndex + 0.5) / 12) * 100 - 10),
              )}%`,
            }}
          >
            <p className="font-bold text-ink">
              Tháng {hoveredIndex + 1}/{selectedYear}
            </p>
            <div className="mt-1 space-y-0.5">
              <p className="text-emerald-700 font-semibold">
                Thu: {formatVnd(items[hoveredIndex].revenueVnd)}
              </p>
              <p className="text-amber-700 font-semibold">
                Chi: {formatVnd(items[hoveredIndex].costVnd)}
              </p>
              <p className="text-primary font-bold border-t border-hairline pt-0.5 mt-0.5">
                Dòng tiền: {formatVnd(items[hoveredIndex].netVnd)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
