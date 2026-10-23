import type { DailySpend } from "@/features/ai-grading/settings";

function usd(value: number): string {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USD`;
}

function dayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

/**
 * Chi phí 30 ngày (phase 3c): one bar per Vietnam day, scaled to the highest day and drawn against
 * the daily budget so the owner sees how close busy days come to the cap.
 */
export function SpendHistory({ budgetUsd, days }: { budgetUsd: number; days: DailySpend[] }) {
  const total = days.reduce((sum, day) => sum + day.costUsd, 0);
  const runs = days.reduce((sum, day) => sum + day.runs, 0);
  const top = Math.max(budgetUsd, ...days.map((day) => day.costUsd), 0.01);
  const busiest = days.reduce<DailySpend | null>((best, day) => (best === null || day.costUsd > best.costUsd ? day : best), null);
  return (
    <div className="grid gap-3">
      <p className="text-secondary text-text-default">
        30 ngày qua: <span className="font-semibold text-text-strong">{usd(total)}</span> cho {runs.toLocaleString("vi-VN")} lượt
        {busiest && busiest.costUsd > 0 ? ` · cao nhất ${usd(busiest.costUsd)} ngày ${dayLabel(busiest.date)}` : ""}.
      </p>
      <div aria-label="Chi phí từng ngày" className="flex h-28 items-end gap-0.5" role="img">
        {days.map((day) => (
          <div
            className="flex-1 rounded-t-sm bg-[var(--action-primary)] opacity-80"
            key={day.date}
            style={{ height: `${Math.max(day.costUsd > 0 ? 3 : 0, (day.costUsd / top) * 100)}%` }}
            title={`${dayLabel(day.date)}: ${usd(day.costUsd)} · ${day.runs} lượt`}
          />
        ))}
      </div>
      <div className="flex justify-between text-caption text-text-muted">
        <span>{days[0] ? dayLabel(days[0].date) : ""}</span>
        <span>Trần ngày {usd(budgetUsd)}</span>
        <span>{days.at(-1) ? dayLabel(days.at(-1)!.date) : ""}</span>
      </div>
    </div>
  );
}
