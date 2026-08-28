import type { PayslipTotals } from "@/features/payroll/payslip/types";
import { Calculator, DollarSign, Wallet } from "lucide-react";

export function PayslipSummaryFormula({ totals }: { totals: PayslipTotals }) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:flex-row">
      {/* Gross */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white shadow-xs">
          <DollarSign aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase">
            Tổng Thu Nhập
          </p>
          <p className="text-sm font-bold text-blue-950 tabular-nums sm:text-base">
            {totals.grossFormatted}
          </p>
        </div>
      </div>

      {/* Minus */}
      <span aria-hidden="true" className="text-2xl font-bold text-slate-400">
        −
      </span>

      {/* Deductions */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-700 text-white shadow-xs">
          <Calculator aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase">
            Tổng Khấu Trừ
          </p>
          <p className="text-sm font-bold text-rose-800 tabular-nums sm:text-base">
            {totals.totalDeductionsFormatted}
          </p>
        </div>
      </div>

      {/* Equals */}
      <span aria-hidden="true" className="text-2xl font-bold text-slate-400">
        =
      </span>

      {/* Net Pay */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xs">
          <Wallet aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-emerald-800 uppercase">
            THỰC NHẬN
          </p>
          <p className="text-base font-extrabold text-emerald-950 tabular-nums sm:text-lg">
            {totals.netFormatted}
          </p>
        </div>
      </div>
    </div>
  );
}
