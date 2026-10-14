import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/features/payroll/payroll-presentation";
import type { PayslipPeriodInfo } from "@/features/payroll/payslip/types";

function getBadgeTone(status: string): "info" | "neutral" | "success" | "warning" {
  if (status === "approved") return "success";
  if (status === "review") return "warning";
  return "info";
}

/**
 * Payslip card header (design 8b): "Phiếu lương" eyebrow, period title, status
 * and calculation revision on the left; centre identity on the right. The
 * payslip code and approver are not loaded, so they are not shown.
 */
export function PayslipHeader({ period }: { period: PayslipPeriodInfo }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row-reverse sm:items-start sm:justify-between">
      {/* Centre identity first in reading order, shown on the right from sm. */}
      <div className="sm:text-right">
        <h1 className="text-body font-bold text-text-strong">Trung Tâm Toán Thầy Vinh</h1>
        <p className="text-caption text-text-muted">Học Toán tư duy - Làm chủ tương lai</p>
      </div>

      <div className="min-w-0">
        <h2 className="text-caption font-semibold uppercase tracking-[0.02em] text-text-muted">Phiếu Lương</h2>
        <p className="mt-1 text-[20px] font-semibold leading-7 tracking-[-0.01em] text-text-strong">
          {period.periodMonthFormatted}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-secondary text-text-muted">
          <Badge tone={getBadgeTone(period.status)}>{period.statusLabel}</Badge>
          <span>Lần tính #{period.currentRevision}</span>
          {period.lastCalculatedAt ? <span>· tính lúc {formatDateTime(period.lastCalculatedAt)}</span> : null}
        </div>
      </div>
    </header>
  );
}
