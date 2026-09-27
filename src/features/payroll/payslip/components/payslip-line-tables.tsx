import { attendanceLineTypes, groupPayrollLines } from "@/features/payroll/payroll-line-groups";
import { formatCurrency } from "@/features/payroll/payroll-presentation";
import type { PayslipLineItem, PayslipTotals } from "@/features/payroll/payslip/types";

function SummarySection({ title, lines }: { title: string; lines: readonly PayslipLineItem[] }) {
  if (!lines.length) return null;
  return <section aria-label={title} className="break-inside-avoid">
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-3 font-semibold text-text-strong">
      <h4>{title}</h4><span className="shrink-0 tabular-nums">{formatCurrency(lines.reduce((sum, line) => sum + line.amountVnd, 0))}</span>
    </div>
    <dl className="divide-y divide-border-subtle">
      {groupPayrollLines(lines).map((group) => <div key={group.key} className="flex items-start justify-between gap-4 py-3">
        <dt className="min-w-0 text-text-default">{group.lines[0].label}</dt>
        <dd className="shrink-0 font-medium tabular-nums text-text-strong">{formatCurrency(group.amountVnd)}</dd>
      </div>)}
    </dl>
  </section>;
}

export function PayslipLineTables({ deductions, earnings, totals }: {
  deductions: readonly PayslipLineItem[]; earnings: readonly PayslipLineItem[]; totals: PayslipTotals;
}) {
  return <div className="grid items-start gap-5 md:grid-cols-[1.25fr_1fr] print:grid-cols-[1.25fr_1fr]">
    <section aria-label="Thu nhập" className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base text-sm print:text-xs">
      <h3 className="border-b border-border-subtle bg-surface-raised px-4 py-3 font-bold text-action-primary">Thu nhập</h3>
      <div className="px-4">
        <SummarySection title="Lương theo công" lines={earnings.filter(line => attendanceLineTypes.has(line.lineType))} />
        <SummarySection title="Chấm bài" lines={earnings.filter(line => line.lineType === "grading_bonus")} />
        <SummarySection title="Thưởng & phụ cấp" lines={earnings.filter(line => !attendanceLineTypes.has(line.lineType) && line.lineType !== "grading_bonus")} />
        {!earnings.length ? <p className="py-4 text-text-muted">Không có khoản thu nhập nào ghi nhận trong kỳ.</p> : null}
      </div>
      <div className="flex justify-between gap-3 border-t border-border-subtle bg-surface-raised px-4 py-3 font-bold text-text-strong"><span>Tổng cộng thu nhập</span><span className="tabular-nums">{totals.grossFormatted}</span></div>
    </section>
    <section aria-label="Bù trừ & khấu trừ" className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base text-sm print:text-xs">
      <h3 className="border-b border-border-subtle bg-surface-raised px-4 py-3 font-bold text-danger">Bù trừ & khấu trừ</h3>
      <dl className="divide-y divide-border-subtle px-4">
        {groupPayrollLines(deductions).map(group => <div key={group.key} className="flex items-start justify-between gap-4 py-3">
          <dt className="text-text-default">{group.lines[0].label}</dt><dd className="shrink-0 font-medium tabular-nums text-danger">{formatCurrency(group.amountVnd)}</dd>
        </div>)}
      </dl>
      {!deductions.length ? <p className="px-4 py-4 text-text-muted">Không phát sinh khoản tạm ứng hoặc khấu trừ trong kỳ.</p> : null}
      {deductions.some(line => line.lineType === "piecework_offset") ? <p className="px-4 pb-4 text-xs leading-relaxed text-text-muted">Bù trừ theo chính sách lương khoán của kỳ. Thưởng chỉ làm tăng thực nhận khi vượt ngưỡng bù trừ.</p> : null}
      <div className="flex justify-between gap-3 border-t border-border-subtle bg-surface-raised px-4 py-3 font-bold"><span className="text-text-strong">Tổng cộng khấu trừ</span><span className="tabular-nums text-danger">{totals.totalDeductionsFormatted}</span></div>
    </section>
  </div>;
}
