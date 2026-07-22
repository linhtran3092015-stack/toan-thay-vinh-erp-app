import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";
import { formatCurrency } from "@/features/students/detail/helpers";
import type { StudentDetail } from "@/features/students/detail/types";

interface StudentSummaryCardsProps {
  detail: StudentDetail;
}

export function StudentSummaryCards({ detail }: StudentSummaryCardsProps) {
  const { student, summary } = detail;
  const communicationLabel =
    detail.communicationGroup.status === "created" ? "Đã tạo" : "Chưa có";

  return (
    <section className="grid min-w-0 max-w-full gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <SummaryCard label="Số dư buổi">
        <SessionBalanceBadge balance={student.sessionBalance} />
      </SummaryCard>
      <SummaryCard label="Đơn giá hiện tại">
        <span className="text-lg font-bold text-ink tabular-nums">
          {formatCurrency(summary.currentUnitPrice)}
        </span>
      </SummaryCard>
      <SummaryCard label="Lần đóng gần nhất">
        <span className="text-lg font-bold text-ink">
          {summary.latestPaymentDate}
        </span>
      </SummaryCard>
      <SummaryCard label="Điểm TB 4 buổi">
        <span className="text-lg font-bold text-primary tabular-nums">
          {summary.averageScoreLastFourSessions.toFixed(1)}
        </span>
      </SummaryCard>
      <SummaryCard label="Vắng liên tiếp">
        <span className="text-lg font-bold text-danger tabular-nums">
          {summary.consecutiveAbsences}
        </span>
      </SummaryCard>
      <SummaryCard label="Sổ liên lạc">
        <Badge tone={detail.communicationGroup.status === "created" ? "success" : "warning"}>
          {communicationLabel}
        </Badge>
      </SummaryCard>
    </section>
  );
}

interface SummaryCardProps {
  children: ReactNode;
  label: string;
}

function SummaryCard({ children, label }: SummaryCardProps) {
  return (
    <div className="min-w-0 rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <div className="min-h-8">{children}</div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>
    </div>
  );
}
