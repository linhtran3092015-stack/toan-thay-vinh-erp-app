import type { PayslipTotals } from "@/features/payroll/payslip/types";

export function PayslipSummaryCard({ totals }: { totals: PayslipTotals }) {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-blue-900 bg-white shadow-xs">
      {/* Blue Header */}
      <div className="bg-blue-900 px-4 py-2.5 text-center text-xs font-bold tracking-wider text-white uppercase">
        Tổng Quan Thu Nhập
      </div>

      <div className="flex flex-col justify-between gap-3 p-4">
        {/* Gross and Deductions */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="font-medium text-slate-600">Tổng thu nhập</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {totals.grossFormatted}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="font-medium text-slate-600">Tổng khấu trừ</span>
            <span className="font-semibold text-rose-700 tabular-nums">
              {totals.totalDeductionsVnd > 0 ? "−" : ""}
              {totals.totalDeductionsFormatted}
            </span>
          </div>
        </div>

        {/* Big Prominent Net Pay */}
        <div className="rounded-lg bg-blue-50/80 p-3 text-center sm:text-right">
          <p className="text-xs font-bold tracking-wide text-blue-900 uppercase">
            THỰC NHẬN
          </p>
          <p className="mt-0.5 text-xl font-extrabold text-blue-900 tabular-nums sm:text-2xl">
            {totals.netFormatted}
          </p>
        </div>

        {/* Amount in words */}
        <p className="text-[11px] italic text-slate-500">
          <span className="font-semibold text-slate-600">Bằng chữ:</span>{" "}
          {totals.amountInWords}
        </p>
      </div>
    </div>
  );
}
