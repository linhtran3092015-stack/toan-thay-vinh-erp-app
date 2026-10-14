import type { PayrollFigure } from "@/features/payroll/dashboard/overview-model";
import { cn } from "@/lib/utils";

/**
 * Thin inline figures strip (design 8a), not big KPI cards: label 13 muted,
 * value 20/600 tabular, one helper line. Cells wrap at any count; the negative
 * margin hides the outer edge of the internal dividers.
 */
export function PayrollFiguresStrip({ figures, label }: { figures: readonly PayrollFigure[]; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <dl
        aria-label={label}
        className="-ml-px -mt-px grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]"
      >
        {figures.map((figure) => (
          <div className="min-w-0 border-l border-t border-border-row px-4 py-3" key={figure.key}>
            <dt className="text-label text-text-muted">{figure.label}</dt>
            <dd
              className={cn(
                "mt-0.5 break-words text-numeric font-semibold tabular-nums",
                figure.tone === "danger" ? "text-danger" : figure.tone === "warning" ? "text-warning" : "text-text-strong",
              )}
            >
              {figure.value}
            </dd>
            {figure.helper ? <dd className="text-caption text-text-muted">{figure.helper}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
