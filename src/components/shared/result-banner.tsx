import { CheckCircle2, CircleAlert, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type ResultBannerTone = "success" | "warning" | "error" | "info" | "conflict";

interface ResultBannerProps {
  title: string;
  description?: string;
  tone?: ResultBannerTone;
  className?: string;
}

const presentation: Record<
  ResultBannerTone,
  { icon: typeof CheckCircle2; className: string; role: "alert" | "status" }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-success-border bg-success-bg text-success",
    role: "status",
  },
  warning: {
    icon: CircleAlert,
    className: "border-warning-border bg-warning-bg text-warning",
    role: "status",
  },
  error: {
    icon: CircleAlert,
    className: "border-danger-border bg-danger-bg text-danger",
    role: "alert",
  },
  info: {
    icon: Info,
    className: "border-info-border bg-info-bg text-info",
    role: "status",
  },
  conflict: {
    icon: CircleAlert,
    className: "border-warning-border bg-warning-bg text-warning",
    role: "alert",
  },
};

/**
 * Presentation-only feedback. Features own the result copy, remediation,
 * permission meaning, and any server/action binding.
 */
export function ResultBanner({
  title,
  description,
  tone = "info",
  className,
}: ResultBannerProps) {
  const { className: toneClassName, icon: Icon, role } = presentation[tone];

  return (
    <div
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={cn("flex gap-3 rounded-lg border p-4", toneClassName, className)}
      role={role}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={20} strokeWidth={1.8} />
      <div>
        <p className="text-body font-semibold">{title}</p>
        {description ? <p className="mt-1 text-body text-text-strong">{description}</p> : null}
      </div>
    </div>
  );
}
