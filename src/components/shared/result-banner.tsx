import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** `error` and `danger` share the danger family; `conflict` is an alerting warning. */
export type ResultBannerTone =
  | "success"
  | "warning"
  | "error"
  | "danger"
  | "info"
  | "conflict";

export interface ResultBannerProps {
  title: string;
  description?: string;
  tone?: ResultBannerTone;
  className?: string;
  /** Inline follow-up: a text link or a `size="sm"` button, placed after the text. */
  action?: ReactNode;
  /** Extra inline content (names, counts) rendered after the description. */
  children?: ReactNode;
}

const presentation: Record<
  ResultBannerTone,
  { icon: typeof CircleCheck; className: string; role: "alert" | "status" }
> = {
  success: {
    icon: CircleCheck,
    className: "border-success-border bg-success-bg text-success-ink",
    role: "status",
  },
  warning: {
    icon: CircleAlert,
    className: "border-warning-border bg-warning-bg text-warning-ink",
    role: "status",
  },
  error: {
    icon: CircleX,
    className: "border-danger-border bg-danger-bg text-danger-ink",
    role: "alert",
  },
  danger: {
    icon: CircleX,
    className: "border-danger-border bg-danger-bg text-danger-ink",
    role: "alert",
  },
  info: {
    icon: Info,
    className: "border-info-border bg-info-bg text-info-ink",
    role: "status",
  },
  conflict: {
    icon: CircleAlert,
    className: "border-warning-border bg-warning-bg text-warning-ink",
    role: "alert",
  },
};

/**
 * Context-bound result: placed directly under the action that produced it
 * (icon 18 + strong title + text + optional link/button). Presentation only:
 * features own the copy, remediation, permission meaning, and action binding.
 * Toasts are reserved for background work.
 */
export function ResultBanner({
  title,
  description,
  tone = "info",
  className,
  action,
  children,
}: ResultBannerProps) {
  const { className: toneClassName, icon: Icon, role } = presentation[tone];

  return (
    <div
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={cn(
        "flex gap-2.5 rounded-md border p-3 text-body [&_a]:font-semibold [&_a]:underline-offset-2 [&_a:hover]:underline",
        toneClassName,
        className,
      )}
      role={role}
    >
      <Icon aria-hidden="true" className="mt-px shrink-0" size={18} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <strong className="font-semibold">{title}</strong>
        {description ? <> {description}</> : null}
        {children}
        {action ? (
          <span className="ml-2 inline-flex items-center align-middle">{action}</span>
        ) : null}
      </div>
    </div>
  );
}
