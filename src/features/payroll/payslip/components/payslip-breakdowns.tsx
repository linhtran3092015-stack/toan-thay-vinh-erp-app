import type { PayslipDocumentData } from "@/features/payroll/payslip/types";
import { Award, Clock, TrendingUp } from "lucide-react";

export function PayslipBreakdowns({
  breakdowns,
}: {
  breakdowns: PayslipDocumentData["breakdowns"];
}) {
  const hasWorkHours = breakdowns.workHours.length > 0;
  const hasGrading = breakdowns.grading !== null;
  const hasCommissions = breakdowns.commissions.length > 0;

  if (!hasWorkHours && !hasGrading && !hasCommissions) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Work Hours Breakdown */}
      {hasWorkHours ? (
        <div className="rounded-xl border border-border-subtle bg-surface-base p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 border-b border-border-subtle pb-2 text-xs font-bold text-action-primary">
            <Clock aria-hidden="true" className="h-4 w-4 text-action-primary" />
            <span>CHI TIẾT CÔNG & GIỜ LÀM</span>
          </div>
          <ul className="mt-2.5 space-y-2 text-xs">
            {breakdowns.workHours.map((wh) => (
              <li
                className="flex items-center justify-between rounded-lg bg-surface-raised p-2 text-text-default"
                key={wh.modeLabel}
              >
                <div>
                  <p className="font-semibold text-text-strong">{wh.modeLabel}</p>
                  <p className="text-[11px] text-text-muted">
                    {wh.workHoursFormatted} × {wh.dailyRateFormatted}
                    {wh.factorText ? ` (${wh.factorText})` : ""}
                  </p>
                </div>
                <span className="font-bold text-text-strong tabular-nums">
                  {wh.subtotalFormatted}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Grading Breakdown */}
      {hasGrading && breakdowns.grading ? (
        <div className="rounded-xl border border-border-subtle bg-surface-base p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 border-b border-border-subtle pb-2 text-xs font-bold text-action-primary">
            <Award aria-hidden="true" className="h-4 w-4 text-action-primary" />
            <span>CHI TIẾT CHẤM BÀI</span>
          </div>
          <div className="mt-2.5 rounded-lg bg-surface-raised p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-strong">
                {new Intl.NumberFormat("vi-VN").format(breakdowns.grading.creditsCount)} phiếu chấm
              </span>
              <span className="font-bold text-text-strong tabular-nums">
                {breakdowns.grading.subtotalFormatted}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              Công thức: {breakdowns.grading.explanation}
            </p>
            {breakdowns.grading.poolAmountFormatted ? (
              <p className="mt-0.5 text-[11px] text-text-muted">
                Quỹ chấm bài tháng: {breakdowns.grading.poolAmountFormatted}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Commission Breakdown */}
      {hasCommissions ? (
        <div className="rounded-xl border border-border-subtle bg-surface-base p-3.5 shadow-xs md:col-span-2">
          <div className="flex items-center gap-1.5 border-b border-border-subtle pb-2 text-xs font-bold text-action-primary">
            <TrendingUp aria-hidden="true" className="h-4 w-4 text-action-primary" />
            <span>CHI TIẾT THƯỞNG DOANH THU & HOA HỒNG</span>
          </div>
          <div className="mt-2.5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted">
                  <th className="pb-1.5 text-left font-semibold">Khối / Hạng mục</th>
                  <th className="pb-1.5 text-right font-semibold">Doanh thu căn cứ</th>
                  <th className="pb-1.5 text-right font-semibold">Tỷ lệ</th>
                  <th className="pb-1.5 text-right font-semibold">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {breakdowns.commissions.map((c, idx) => (
                  <tr key={`${c.gradeLabel}-${idx}`}>
                    <td className="py-2 text-text-strong font-medium">
                      {c.gradeLabel ?? "Doanh thu ghi nhận"}
                    </td>
                    <td className="py-2 text-right text-text-default tabular-nums">
                      {c.basisRevenueFormatted}
                    </td>
                    <td className="py-2 text-right text-text-default tabular-nums">
                      {c.ratePercentage}
                    </td>
                    <td className="py-2 text-right font-bold text-text-strong tabular-nums">
                      {c.subtotalFormatted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
