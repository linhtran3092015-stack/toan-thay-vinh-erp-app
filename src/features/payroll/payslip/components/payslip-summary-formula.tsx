import type { PayslipTotals } from "@/features/payroll/payslip/types";
import { Calculator, DollarSign, Wallet } from "lucide-react";

export function PayslipSummaryFormula({ totals }: { totals: PayslipTotals }) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:flex-row">
      {/* Gross */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action-primary text-white shadow-xs">
          <DollarSign aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-text-muted uppercase">
            Tổng Thu Nhập
          </p>
          <p className="text-sm font-bold text-text-strong tabular-nums sm:text-base">
            {totals.grossFormatted}
          </p>
        </div>
      </div>

      {/* Minus */}
      <span aria-hidden="true" className="text-2xl font-bold text-text-muted">
        −
      </span>

      {/* Deductions */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger text-white shadow-xs">
          <Calculator aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-text-muted uppercase">
            Tổng Khấu Trừ
          </p>
          <p className="text-sm font-bold text-danger tabular-nums sm:text-base">
            {totals.totalDeductionsFormatted}
          </p>
        </div>
      </div>

      {/* Equals */}
      <span aria-hidden="true" className="text-2xl font-bold text-text-muted">
        =
      </span>

      {/* Net Pay */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-white shadow-xs">
          <Wallet aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-success uppercase">
            THỰC NHẬN
          </p>
          <p className="text-base font-extrabold text-success tabular-nums sm:text-lg">
            {totals.netFormatted}
          </p>
        </div>
      </div>
    </div>
  );
}
