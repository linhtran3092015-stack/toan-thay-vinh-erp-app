import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  danger: "bg-danger-bg text-danger border-danger-border",
  info: "bg-info-bg text-info border-info-border",
  purple: "bg-purple-bg text-accent-purple border-accent-purple/30",
  neutral: "bg-neutral-bg text-neutral border-hairline-strong",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-bold leading-none tracking-wide transition-colors",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
