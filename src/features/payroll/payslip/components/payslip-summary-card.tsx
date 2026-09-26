import type { PayslipTotals } from "@/features/payroll/payslip/types";

export function PayslipSummaryCard({ totals }: { totals: PayslipTotals }) {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-border-subtle bg-surface-base shadow-xs">
      {/* Blue Header */}
      <div className="bg-action-primary/5 px-4 py-3 text-left text-xs font-bold tracking-wider text-success uppercase">
        Tổng Quan Thu Nhập
      </div>

      <div className="flex flex-col justify-between gap-3 p-4">
        {/* Gross and Deductions */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
            <span className="font-medium text-text-default">Tổng thu nhập</span>
            <span className="font-semibold text-text-strong tabular-nums">
              {totals.grossFormatted}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
            <span className="font-medium text-text-default">Tổng bù trừ & khấu trừ</span>
            <span className="font-semibold text-danger tabular-nums">
              {totals.totalDeductionsVnd > 0 ? "−" : ""}
              {totals.totalDeductionsFormatted}
            </span>
          </div>
        </div>

        {/* Big Prominent Net Pay */}
        <div className="rounded-lg bg-success/10 p-3 text-center sm:text-right">
          <p className="text-xs font-bold tracking-wide text-success uppercase">
            THỰC NHẬN
          </p>
          <p className="mt-0.5 text-xl font-extrabold text-success tabular-nums sm:text-2xl">
            {totals.netFormatted}
          </p>
        </div>

        {/* Amount in words */}
        <p className="text-[11px] italic text-text-muted">
          <span className="font-semibold text-text-default">Bằng chữ:</span>{" "}
          {totals.amountInWords}
        </p>
      </div>
    </div>
  );
}
