import { Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type StepperStepState = "done" | "current" | "upcoming";

export interface StepperStep {
  title: string;
  /** 12px line under the title (muted; primary-hover on the current step). */
  description?: string;
  state: StepperStepState;
  /** Optional follow-up link under the description (e.g. the SePay review queue). */
  link?: { href: string; label: string };
}

const stateLabels: Record<StepperStepState, string> = {
  current: "Đang ở bước này",
  done: "Đã xong",
  upcoming: "Chưa tới",
};

/**
 * Workflow stepper (HANDOFF §2; designs 07 frame 7b, 17c, 18): a grid `<ol>`
 * (one column on phones, two from sm, four from xl). A finished step shows a
 * success check, the current one the primary number on a soft surface with
 * `aria-current="step"`, an upcoming one an outlined number. Every state is
 * also written as text (screen-reader prefix), never colour alone. Steps are
 * plain list items, never click-to-navigate; features own which step is
 * current. Server-safe (no client hooks).
 */
export function Stepper({ className, label, steps }: { className?: string; label: string; steps: readonly StepperStep[] }) {
  return (
    <ol
      aria-label={label}
      className={cn(
        "m-0 grid list-none grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-border-subtle bg-surface-base p-0 shadow-[var(--panel-shadow)] sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {steps.map((step, index) => {
        const isCurrent = step.state === "current";
        const isDone = step.state === "done";

        return (
          <li
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-start gap-3 border-border-row px-4 py-3 [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(odd)]:border-r xl:[&:not(:first-child)]:border-t-0 xl:[&:not(:last-child)]:border-r",
              isCurrent && "bg-action-primary-soft",
            )}
            data-state={step.state}
            key={step.title}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-caption font-bold",
                isDone && "bg-success text-text-on-primary",
                isCurrent && "bg-action-primary text-text-on-primary",
                step.state === "upcoming" && "border border-border-strong bg-surface-base text-text-muted",
              )}
            >
              {isDone ? <Check size={14} strokeWidth={2.5} /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-body font-semibold", isCurrent ? "text-action-primary" : "text-text-strong")}>
                <span className="sr-only">{stateLabels[step.state]}: </span>
                {index + 1}. {step.title}
              </span>
              {step.description ? (
                <span className={cn("block text-caption", isCurrent ? "text-action-primary-hover" : "text-text-muted")}>{step.description}</span>
              ) : null}
              {step.link ? (
                <Link
                  className="mt-1 inline-flex min-h-11 items-center text-secondary font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
                  href={step.link.href}
                >
                  {step.link.label}
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
