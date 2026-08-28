import type {
  PayslipBrandingConfig,
  SummaryBlockSettings,
} from "@/features/payroll/payslip-template/types";
import type { PayslipTotals } from "@/features/payroll/payslip/types";
import { CheckCircle2, TrendingUp } from "lucide-react";

interface PayslipSummaryCardProps {
  blockSettings?: SummaryBlockSettings;
  branding?: Partial<PayslipBrandingConfig>;
  totals: PayslipTotals;
}

export function PayslipSummaryCard({
  blockSettings = {},
  branding = {},
  totals,
}: PayslipSummaryCardProps) {
  const showGross = blockSettings.showGross !== false;
  const showDeductions = blockSettings.showDeductions !== false;
  const showNet = blockSettings.showNet !== false;
  const showAmountInWords = blockSettings.showAmountInWords !== false;

  return (
    <div
      className="flex flex-col justify-between rounded-xl border border-blue-900/20 bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 p-4 text-white shadow-xs"
      style={{
        background: `linear-gradient(135deg, ${branding.primaryColor || "#1e3a8a"}, #0f172a)`,
      }}
    >
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-blue-200/90">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <TrendingUp aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
            Tổng quan lương
          </span>
          <span className="text-[11px] text-blue-300">
            {totals.workHours > 0 ? `${totals.workHours}h làm việc` : ""}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 border-b border-white/10 pb-3 text-xs">
          {showGross ? (
            <div>
              <p className="text-blue-200/70">Tổng thu nhập (Gross)</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-white">
                {totals.grossFormatted}
              </p>
            </div>
          ) : null}

          {showDeductions ? (
            <div>
              <p className="text-rose-300/80">Tạm ứng & Khấu trừ</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-rose-300">
                - {totals.totalDeductionsFormatted}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {showNet ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              THỰC NHẬN (NET PAY)
            </span>
            <span className="text-xl font-extrabold tracking-tight tabular-nums text-emerald-400 sm:text-2xl">
              {totals.netFormatted}
            </span>
          </div>
          {showAmountInWords && totals.amountInWords ? (
            <p className="mt-1 text-[11px] italic text-blue-200/80 line-clamp-1">
              Bằng chữ: {totals.amountInWords}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
