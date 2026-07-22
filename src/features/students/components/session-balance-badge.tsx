import { Badge } from "@/components/ui/badge";

interface SessionBalanceBadgeProps {
  balance: number;
}

export function SessionBalanceBadge({ balance }: SessionBalanceBadgeProps) {
  if (balance > 0) {
    return <Badge tone="success">Còn {balance} buổi</Badge>;
  }

  if (balance === 0) {
    return <Badge tone="warning">Hết buổi</Badge>;
  }

  return <Badge tone="danger">Âm {Math.abs(balance)} buổi</Badge>;
}
