import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Five status families from the design file plus `primary`, the identity
 * tone reserved for selection/active/count chips (never for errors).
 * `purple` is a pre-handoff alias that renders as `info`.
 */
export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary"
  | "purple";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Optional 12px icon rendered before the label. The label stays required. */
  icon?: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  success: "border-success-border bg-success-bg text-success",
  warning: "border-warning-border bg-warning-bg text-warning",
  danger: "border-danger-border bg-danger-bg text-danger",
  info: "border-info-border bg-info-bg text-info",
  purple: "border-info-border bg-info-bg text-info",
  neutral: "border-neutral-border bg-neutral-bg text-neutral",
  primary:
    "border-action-primary-soft-border bg-action-primary-soft text-action-primary",
};

/**
 * Status badge: soft surface + family foreground + family border, 12/500,
 * padding 3/9, radius-sm. Features map their domain status to a tone; the
 * badge never decides meaning and always carries text.
 */
export function Badge({
  className,
  tone = "neutral",
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-[9px] py-[3px] text-caption font-medium leading-4",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:h-3 [&>svg]:w-3">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/**
 * Pending-work count chip (identity tone, 20px, radius-sm). Pair it with a
 * visible or screen-reader label such as "việc tồn"; the number alone is not
 * a status.
 */
export function CountChip({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-grid h-5 min-w-5 place-items-center rounded-sm bg-action-primary-soft px-1.5 text-caption font-semibold tabular-nums text-action-primary",
        className,
      )}
      {...props}
    />
  );
}
