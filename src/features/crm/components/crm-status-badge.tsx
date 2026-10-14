import { Badge } from "@/components/ui/badge";
import { crmStatusLabels } from "@/features/crm/crm-presentation";
import type { CrmCaseStatus } from "@/features/crm/read-models";
import { cn } from "@/lib/utils";

export const crmStatusMeta: Record<
  CrmCaseStatus,
  { label: string; tone: "danger" | "info" | "neutral" | "success" | "warning" }
> = {
  converted: { label: crmStatusLabels.converted, tone: "success" },
  dropped: { label: crmStatusLabels.dropped, tone: "neutral" },
  interested: { label: crmStatusLabels.interested, tone: "info" },
  pending_enrollment_confirmation: { label: crmStatusLabels.pending_enrollment_confirmation, tone: "warning" },
  trial_booked: { label: crmStatusLabels.trial_booked, tone: "warning" },
  trial_completed: { label: crmStatusLabels.trial_completed, tone: "info" },
};

interface CrmStatusBadgeProps {
  className?: string;
  status: CrmCaseStatus;
  /** Short read-only context after the label, e.g. "14 ngày", "14/10" or a drop reason. */
  suffix?: string | null;
  /** Full text for a truncated suffix (native tooltip). */
  title?: string;
  /**
   * Ellipsis instead of growing past the badge's max width (set it through
   * `className`); pass the full text as `title`.
   */
  truncate?: boolean;
}

export function CrmStatusBadge({ className, status, suffix, title, truncate = false }: CrmStatusBadgeProps) {
  const meta = Object.hasOwn(crmStatusMeta, status)
    ? crmStatusMeta[status]
    : { label: `Trạng thái chưa hỗ trợ: ${status}`, tone: "neutral" as const };
  const text = suffix ? `${meta.label} · ${suffix}` : meta.label;

  return (
    <Badge className={cn(truncate && "min-w-0", className)} title={title} tone={meta.tone}>
      {truncate ? <span className="min-w-0 truncate">{text}</span> : text}
    </Badge>
  );
}
