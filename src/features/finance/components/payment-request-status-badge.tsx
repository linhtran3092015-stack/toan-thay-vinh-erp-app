import { Badge } from "@/components/ui/badge";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

const statusConfig: Record<
  PaymentRequestReadModel["status"],
  { label: string; tone: "danger" | "info" | "neutral" | "success" | "warning" }
> = {
  cancelled: { label: "Đã hủy", tone: "neutral" },
  expired: { label: "Hết hạn", tone: "danger" },
  paid: { label: "Đã thanh toán", tone: "success" },
  partially_paid: { label: "Thanh toán một phần", tone: "info" },
  pending: { label: "Chờ thanh toán", tone: "warning" },
};

export function PaymentRequestStatusBadge({
  status,
}: {
  status: PaymentRequestReadModel["status"];
}) {
  const config = statusConfig[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

