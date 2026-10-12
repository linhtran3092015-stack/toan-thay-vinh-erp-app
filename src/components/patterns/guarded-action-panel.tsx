import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type GuardedConditionState = "met" | "unmet" | "unknown";

export interface GuardedCondition {
  /** Plain-language condition, e.g. "Điểm danh đủ 22/22 học sinh". */
  label: ReactNode;
  state: GuardedConditionState;
  /** Inline follow-up next to an unmet condition, e.g. a "Nhập ngay" link. */
  action?: ReactNode;
}

interface GuardedActionPanelProps {
  /** Right-hand action (usually one Button); the feature decides availability. */
  action?: ReactNode;
  /** Status badge next to the title. */
  badge?: ReactNode;
  /** Extra content under the consequence (notes, banners). */
  children?: ReactNode;
  className?: string;
  conditions?: readonly GuardedCondition[];
  /** Consequence written in words; wrap the key phrase in <strong>. */
  consequence?: ReactNode;
  /** Danger border while the confirmation dialog is open. */
  emphasized?: boolean;
  icon?: ReactNode;
  /** Plain-language reason shown under the action while it is disabled. */
  reason?: ReactNode;
  /** Inline outcome rendered right under the action area. */
  result?: ReactNode;
  title: string;
  titleId?: string;
}

const conditionIcon: Record<GuardedConditionState, { Icon: typeof CircleCheck; className: string }> = {
  met: { Icon: CircleCheck, className: "text-success" },
  unmet: { Icon: CircleAlert, className: "text-danger" },
  unknown: { Icon: CircleDashed, className: "text-text-subtle" },
};

/**
 * Guarded action (design 04/10): title + status, consequence in words,
 * checklist of conditions, the action on the right with its reason when
 * disabled, and the result inline. The panel never decides permissions or
 * whether the action is allowed; it presents what the feature supplies.
 */
export function GuardedActionPanel({
  action,
  badge,
  children,
  className,
  conditions,
  consequence,
  emphasized = false,
  icon,
  reason,
  result,
  title,
  titleId,
}: GuardedActionPanelProps) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-lg border bg-surface-base shadow-[var(--panel-shadow)]",
        emphasized ? "border-danger-border" : "border-border-strong",
        className,
      )}
    >
      <div className="grid gap-6 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {icon ? <span className="flex h-6 w-6 items-center justify-center text-text-muted [&>svg]:h-5 [&>svg]:w-5">{icon}</span> : null}
            <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
              {title}
            </h2>
            {badge}
          </div>
          {consequence ? (
            <p className="mt-2 max-w-[720px] text-body text-text-default [&_strong]:font-semibold">{consequence}</p>
          ) : null}
          {conditions && conditions.length > 0 ? (
            <>
              <p className="mt-4 text-secondary font-semibold text-text-muted">Điều kiện</p>
              <ul className="mt-2 flex flex-col gap-2 text-body">
                {conditions.map((condition, index) => {
                  const { Icon, className: iconClassName } = conditionIcon[condition.state];

                  return (
                    <li className="flex items-center gap-2" key={index}>
                      <Icon aria-hidden="true" className={cn("shrink-0", iconClassName)} size={18} strokeWidth={2} />
                      <span className="sr-only">
                        {condition.state === "met" ? "Đạt:" : condition.state === "unmet" ? "Chưa đạt:" : "Chưa rõ:"}
                      </span>
                      <span className="text-text-strong [&_strong]:font-semibold [&_strong]:text-danger">{condition.label}</span>
                      {condition.action ? <span className="ml-1 text-secondary font-semibold">{condition.action}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {children}
        </div>
        {action ? (
          <div className="flex min-w-[220px] flex-col items-stretch gap-2 md:items-end">
            {action}
            {reason ? <p className="max-w-[220px] text-secondary text-text-muted md:text-right">{reason}</p> : null}
          </div>
        ) : null}
      </div>
      {result ? <div className="border-t border-border-row px-5 py-4">{result}</div> : null}
    </section>
  );
}
