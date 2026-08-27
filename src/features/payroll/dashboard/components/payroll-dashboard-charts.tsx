import { formatCompactVnd, formatPercent, formatShortMonth, formatVnd } from "@/features/payroll/dashboard/format";
import type {
  PayrollDashboardCompositionItem,
  PayrollDashboardPositionSummary,
} from "@/features/payroll/dashboard/read-models";

const chartColors = [
  "var(--payroll-chart-1)",
  "var(--payroll-chart-2)",
  "var(--payroll-chart-3)",
  "var(--payroll-chart-4)",
  "var(--payroll-chart-5)",
  "var(--payroll-chart-6)",
  "var(--payroll-chart-7)",
  "var(--payroll-chart-8)",
] as const;

function hashCode(value: string): number {
  return [...value].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0);
}

export function getPositionColor(positionCode: string): string {
  return chartColors[hashCode(positionCode) % chartColors.length];
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h2 className="text-section-title font-semibold text-text-strong">{title}</h2>
      <p className="mt-1 text-secondary text-text-muted">{description}</p>
    </div>
  );
}

export function PayrollByPositionDonut({
  items,
  totalPayroll,
}: {
  items: readonly PayrollDashboardPositionSummary[];
  totalPayroll: number;
}) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const segments = items.reduce<{
    dashOffset: number;
    item: PayrollDashboardPositionSummary;
    segment: number;
    totalOffset: number;
  }[]>((result, item) => {
    const segment = Math.max(0, item.sharePercent / 100) * circumference;
    const previousOffset = result.at(-1)?.totalOffset ?? 0;
    return [...result, {
      dashOffset: -previousOffset,
      item,
      segment,
      totalOffset: previousOffset + segment,
    }];
  }, []);

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-base p-5" aria-labelledby="payroll-position-donut-title">
      <div id="payroll-position-donut-title">
        <SectionHeading
          description="Tỷ trọng chi phí thực trả theo vị trí trong kỳ."
          title="Cơ cấu chi phí lương theo vị trí"
        />
      </div>
      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[minmax(190px,0.8fr)_minmax(0,1.2fr)]">
        <div className="relative mx-auto aspect-square w-full max-w-[230px]">
          <svg
            aria-label={`Biểu đồ cơ cấu quỹ lương, tổng ${formatVnd(totalPayroll)}`}
            className="h-full w-full"
            role="img"
            viewBox="0 0 180 180"
          >
            <circle cx="90" cy="90" fill="none" r={radius} stroke="var(--surface-sunken)" strokeWidth="22" />
            {segments.map(({ dashOffset, item, segment }) => {
              return (
                <circle
                  cx="90"
                  cy="90"
                  fill="none"
                  key={item.positionCode}
                  r={radius}
                  stroke={getPositionColor(item.positionCode)}
                  strokeDasharray={`${segment} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeWidth="22"
                  transform="rotate(-90 90 90)"
                >
                  <title>{`${item.positionName}: ${formatVnd(item.totalPayroll)} · ${formatPercent(item.sharePercent)} tổng quỹ lương`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-caption font-medium text-text-muted">Tổng quỹ</span>
            <strong className="mt-1 text-body font-bold tabular-nums text-text-strong">{formatCompactVnd(totalPayroll)}</strong>
          </div>
        </div>
        <ul className="grid gap-3" aria-label="Chú giải cơ cấu chi phí lương">
          {items.map((item) => (
            <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3" key={item.positionCode}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: getPositionColor(item.positionCode) }} />
              <div className="min-w-0">
                <p className="truncate text-secondary font-medium text-text-default" title={item.positionName}>{item.positionName}</p>
                <p className="text-caption text-text-muted">{item.employeeCount} nhân sự</p>
              </div>
              <div className="text-right">
                <p className="tabular-nums text-secondary font-semibold text-text-strong">{formatCompactVnd(item.totalPayroll)}</p>
                <p className="tabular-nums text-caption text-text-muted">{formatPercent(item.sharePercent)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PayrollByPositionBars({ items }: { items: readonly PayrollDashboardPositionSummary[] }) {
  const maximum = Math.max(0, ...items.map((item) => item.totalPayroll));
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-base p-5" aria-labelledby="payroll-position-bars-title">
      <div id="payroll-position-bars-title">
        <SectionHeading description="Sắp xếp giảm dần theo số tiền trung tâm thực trả." title="Chi phí lương theo vị trí" />
      </div>
      <div className="mt-6 grid gap-4" role="img" aria-label="Biểu đồ thanh chi phí lương theo vị trí">
        {items.map((item) => {
          const width = maximum === 0 ? 0 : Math.max(2, (item.totalPayroll / maximum) * 100);
          return (
            <div className="grid gap-1.5" key={item.positionCode} title={`${item.positionName}: ${formatVnd(item.totalPayroll)}`}>
              <div className="flex items-end justify-between gap-3 text-secondary">
                <span className="min-w-0 truncate font-medium text-text-default" title={item.positionName}>{item.positionName}</span>
                <span className="shrink-0 tabular-nums font-semibold text-text-strong">{formatCompactVnd(item.totalPayroll)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-sm bg-surface-sunken">
                <div className="h-full rounded-sm" style={{ backgroundColor: getPositionColor(item.positionCode), width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PayrollTrendChart({
  items,
}: {
  items: readonly { employeeCount: number; month: string; totalPayroll: number }[];
}) {
  const maximum = Math.max(1, ...items.map((item) => Math.max(0, item.totalPayroll)));
  const left = 42;
  const right = 578;
  const top = 20;
  const bottom = 170;
  const xFor = (index: number) => left + (index * (right - left)) / Math.max(1, items.length - 1);
  const yFor = (value: number) => bottom - (Math.max(0, value) / maximum) * (bottom - top);
  const points = items.map((item, index) => `${xFor(index)},${yFor(item.totalPayroll)}`).join(" ");
  const areaPoints = `${left},${bottom} ${points} ${right},${bottom}`;

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-base p-5" aria-labelledby="payroll-trend-title">
      <div id="payroll-trend-title">
        <SectionHeading description="Sáu tháng kết thúc tại kỳ đang chọn, dùng cùng bộ lọc vị trí." title="Xu hướng quỹ lương" />
      </div>
      <svg className="mt-5 h-auto w-full" role="img" aria-label="Biểu đồ xu hướng quỹ lương sáu tháng" viewBox="0 0 620 220">
        {[0, 0.5, 1].map((ratio) => {
          const y = bottom - ratio * (bottom - top);
          return <line key={ratio} x1={left} x2={right} y1={y} y2={y} stroke="var(--border-subtle)" strokeDasharray="3 5" />;
        })}
        <polygon fill="var(--payroll-chart-area)" points={areaPoints} />
        <polyline fill="none" points={points} stroke="var(--payroll-chart-1)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {items.map((item, index) => (
          <g key={item.month}>
            <circle cx={xFor(index)} cy={yFor(item.totalPayroll)} fill="var(--surface-base)" r="5" stroke="var(--payroll-chart-1)" strokeWidth="3">
              <title>{`${formatShortMonth(item.month)}: ${formatVnd(item.totalPayroll)} · ${item.employeeCount} nhân sự`}</title>
            </circle>
            <text fill="var(--text-muted)" fontSize="11" textAnchor="middle" x={xFor(index)} y="202">{formatShortMonth(item.month)}</text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-caption text-text-muted">
        <span>0 ₫</span>
        <span>Đỉnh kỳ: {formatCompactVnd(maximum)}</span>
      </div>
    </section>
  );
}

export function PayrollCompositionChart({
  items,
  netPayroll,
}: {
  items: readonly PayrollDashboardCompositionItem[];
  netPayroll: number;
}) {
  const earnings = items.filter((item) => item.direction === "earning");
  const deductions = items.filter((item) => item.direction === "deduction");
  const earningColors = new Map(
    earnings.map((item, index) => [item.lineType, chartColors[index % chartColors.length]]),
  );
  const gross = earnings.reduce((sum, item) => sum + item.amountVnd, 0);
  const deductionTotal = deductions.reduce((sum, item) => sum + item.amountVnd, 0);
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-base p-5" aria-labelledby="payroll-composition-title">
      <div id="payroll-composition-title">
        <SectionHeading description="Các dòng lương đã được Payroll Engine ghi nhận trong kỳ." title="Cơ cấu các khoản chi" />
      </div>
      <dl className="mt-5 grid gap-px overflow-hidden rounded-md border border-border-subtle bg-border-subtle sm:grid-cols-3">
        <CompositionTotal label="Tổng khoản cộng" value={gross} />
        <CompositionTotal label="Tổng khấu trừ" value={deductionTotal} />
        <CompositionTotal label="Thực trả" value={netPayroll} strong />
      </dl>
      {earnings.length > 0 ? (
        <div className="mt-5 flex h-4 overflow-hidden rounded-sm bg-surface-sunken" aria-label="Tỷ trọng các khoản cộng">
          {earnings.map((item) => (
            <div
              key={`${item.direction}-${item.lineType}`}
              style={{ backgroundColor: earningColors.get(item.lineType), width: `${item.sharePercent}%` }}
              title={`${item.label}: ${formatVnd(item.amountVnd)} · ${formatPercent(item.sharePercent)} tổng khoản cộng`}
            />
          ))}
        </div>
      ) : null}
      <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {items.map((item) => (
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3" key={`${item.direction}-${item.lineType}`}>
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: item.direction === "deduction" ? "var(--status-danger)" : earningColors.get(item.lineType) }}
            />
            <span className="min-w-0 truncate text-secondary text-text-default" title={item.label}>{item.label}</span>
            <span className="tabular-nums text-secondary font-semibold text-text-strong">{item.direction === "deduction" ? "−" : ""}{formatCompactVnd(item.amountVnd)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompositionTotal({ label, strong = false, value }: { label: string; strong?: boolean; value: number }) {
  return (
    <div className="bg-surface-base px-3 py-3">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className={`mt-1 tabular-nums text-body ${strong ? "font-bold text-text-strong" : "font-semibold text-text-default"}`}>{formatVnd(value)}</dd>
    </div>
  );
}
