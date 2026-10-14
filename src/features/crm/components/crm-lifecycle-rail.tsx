import { formatCrmDayMonth, type CrmLifecycleStep } from "@/features/crm/crm-presentation";
import { cn } from "@/lib/utils";

const dotClassName: Record<CrmLifecycleStep["state"], string> = {
  current: "bg-action-primary shadow-[0_0_0_3px_var(--action-primary-soft)]",
  done: "bg-success",
  // Neutral like the "Đã dừng" status badge: stopping a lead is not an error.
  dropped: "bg-neutral shadow-[0_0_0_3px_var(--status-neutral-soft)]",
  skipped: "border border-dashed border-border-strong-hover",
  upcoming: "border border-border-strong",
};

const stateText: Record<CrmLifecycleStep["state"], string> = {
  current: "bước hiện tại",
  done: "đã qua",
  dropped: "bước hiện tại",
  skipped: "không qua bước này",
  upcoming: "chưa tới",
};

/**
 * Vertical lifecycle (design 12b): 8px dots, done = success, current = primary
 * with a soft ring, upcoming = hollow (skipped = dashed); the hollow dot, not a
 * fainter text colour, de-emphasises later steps. Each step also says its state in words
 * (visible for a skipped step, screen-reader text otherwise).
 */
export function CrmLifecycleRail({ steps }: { steps: CrmLifecycleStep[] }) {
  return (
    <ol aria-label="Các bước vòng đời lead" className="grid text-secondary">
      {steps.map((step) => {
        const isCurrent = step.state === "current" || step.state === "dropped";
        return (
          <li
            aria-current={isCurrent ? "step" : undefined}
            className={cn("flex gap-2.5 py-1.5", (step.state === "upcoming" || step.state === "skipped") && "text-text-muted")}
            key={step.key}
          >
            <span aria-hidden="true" className={cn("mt-[5px] h-2 w-2 shrink-0 rounded-full", dotClassName[step.state])} />
            <span className="min-w-0">
              <span className={cn(isCurrent ? "font-semibold" : undefined, step.state === "dropped" ? "text-neutral" : isCurrent ? "text-text-strong" : undefined)}>
                {step.label}
              </span>
              {step.date ? <span className="font-normal tabular-nums text-text-muted"> · {formatCrmDayMonth(step.date)}</span> : null}
              {step.state === "skipped" ? <span> · {stateText.skipped}</span> : <span className="sr-only"> ({stateText[step.state]})</span>}
              {step.note ? <span className="mt-0.5 block text-caption text-text-muted">Lý do: {step.note}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
