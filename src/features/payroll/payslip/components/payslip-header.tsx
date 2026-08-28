import { Badge } from "@/components/ui/badge";
import type { PayslipPeriodInfo } from "@/features/payroll/payslip/types";
import { Calendar } from "lucide-react";

export function PayslipHeader({ period }: { period: PayslipPeriodInfo }) {
  const getBadgeTone = (status: string): "info" | "neutral" | "success" | "warning" => {
    if (status === "approved") return "success";
    if (status === "review") return "warning";
    return "info";
  };

  return (
    <header className="border-b-2 border-blue-900 pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Brand Left */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-900 font-bold text-white shadow-sm">
            <span className="text-lg tracking-wider">TTV</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-blue-950 uppercase sm:text-base">
              Trung Tâm Toán Thầy Vinh
            </h1>
            <p className="text-xs italic text-blue-700">
              Học Toán tư duy - Làm chủ tương lai
            </p>
          </div>
        </div>

        {/* Center Title */}
        <div className="text-center sm:px-4">
          <h2 className="text-xl font-extrabold tracking-tight text-blue-900 uppercase sm:text-2xl">
            Phiếu Lương
          </h2>
          <p className="text-sm font-bold text-blue-800">
            {period.periodMonthFormatted}
          </p>
        </div>

        {/* Right Info Box */}
        <div className="flex flex-col items-start rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-xs text-blue-950 sm:items-end sm:text-right">
          <div className="flex items-center gap-1.5 font-semibold text-blue-900">
            <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>KỲ LƯƠNG</span>
          </div>
          <p className="mt-0.5 font-medium tabular-nums">
            {period.periodStartDate} – {period.periodEndDate}
          </p>
          <p className="mt-0.5 text-slate-600">
            Ngày trả lương: <span className="font-semibold text-blue-950 tabular-nums">{period.payDateFormatted}</span>
          </p>
          <div className="mt-1">
            <Badge tone={getBadgeTone(period.status)}>{period.statusLabel}</Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
