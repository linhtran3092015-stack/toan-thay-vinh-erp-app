import type {
  PayslipLineItem,
  PayslipTotals,
} from "@/features/payroll/payslip/types";
import { MinusCircle, PlusCircle } from "lucide-react";

export function PayslipLineTables({
  deductions,
  earnings,
  totals,
}: {
  deductions: readonly PayslipLineItem[];
  earnings: readonly PayslipLineItem[];
  totals: PayslipTotals;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Section I: Thu nhập */}
      <section className="flex flex-col justify-between overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-xs">
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/70 px-4 py-2.5 text-xs font-bold text-emerald-900 uppercase">
            <PlusCircle aria-hidden="true" className="h-4 w-4 text-emerald-700" />
            <span>I. THU NHẬP</span>
          </div>

          {/* Table */}
          <div className="p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 text-left font-semibold">Khoản mục</th>
                  <th className="pb-2 text-right font-semibold">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {earnings.length === 0 ? (
                  <tr>
                    <td
                      className="py-3 text-center text-slate-400 italic"
                      colSpan={2}
                    >
                      Không có khoản thu nhập nào ghi nhận trong kỳ.
                    </td>
                  </tr>
                ) : (
                  earnings.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-2 text-slate-800">
                        <span className="font-medium">
                          {index + 1}. {item.label}
                        </span>
                        {item.note ? (
                          <p className="text-[11px] text-slate-500">
                            {item.note}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 pl-2 text-right font-semibold text-slate-900 tabular-nums">
                        {item.amountFormatted}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subtotal */}
        <div className="flex items-center justify-between border-t border-emerald-200 bg-emerald-50/50 px-4 py-2.5 text-xs font-bold text-emerald-950">
          <span>TỔNG CỘNG THU NHẬP</span>
          <span className="tabular-nums text-emerald-800">
            {totals.grossFormatted}
          </span>
        </div>
      </section>

      {/* Section II: Khấu trừ */}
      <section className="flex flex-col justify-between overflow-hidden rounded-xl border border-rose-200 bg-white shadow-xs">
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50/70 px-4 py-2.5 text-xs font-bold text-rose-900 uppercase">
            <MinusCircle aria-hidden="true" className="h-4 w-4 text-rose-700" />
            <span>II. TẠM ỨNG & KHẤU TRỪ</span>
          </div>

          {/* Table */}
          <div className="p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 text-left font-semibold">Khoản mục</th>
                  <th className="pb-2 text-right font-semibold">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deductions.length === 0 ? (
                  <tr>
                    <td
                      className="py-3 text-center text-slate-400 italic"
                      colSpan={2}
                    >
                      Không phát sinh khoản tạm ứng hoặc khấu trừ trong kỳ.
                    </td>
                  </tr>
                ) : (
                  deductions.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-2 text-slate-800">
                        <span className="font-medium">
                          {index + 1}. {item.label}
                        </span>
                        {item.note ? (
                          <p className="text-[11px] text-slate-500">
                            {item.note}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 pl-2 text-right font-semibold text-rose-700 tabular-nums">
                        {item.amountFormatted}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subtotal */}
        <div className="flex items-center justify-between border-t border-rose-200 bg-rose-50/50 px-4 py-2.5 text-xs font-bold text-rose-950">
          <span>TỔNG CỘNG KHẤU TRỪ</span>
          <span className="tabular-nums text-rose-800">
            {totals.totalDeductionsFormatted}
          </span>
        </div>
      </section>
    </div>
  );
}
