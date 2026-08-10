import { Badge } from "@/components/ui/badge";
import type { CrmCaseStatus } from "@/features/crm/read-models";

export const crmStatusMeta: Record<
  CrmCaseStatus,
  { label: string; tone: "danger" | "info" | "neutral" | "success" | "warning" }
> = {
  converted: { label: "Đã nhập học", tone: "success" },
  dropped: { label: "Đã dừng", tone: "neutral" },
  interested: { label: "Đang quan tâm", tone: "info" },
  pending_enrollment_confirmation: { label: "Chờ xác nhận nhập học", tone: "warning" },
  trial_booked: { label: "Đã đặt học thử", tone: "warning" },
  trial_completed: { label: "Đã học thử", tone: "info" },
};

interface CrmStatusBadgeProps {
  status: CrmCaseStatus;
}

export function CrmStatusBadge({ status }: CrmStatusBadgeProps) {
  const meta = crmStatusMeta[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
