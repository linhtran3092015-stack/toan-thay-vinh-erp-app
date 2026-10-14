import { attendanceLineTypes, groupPayrollLines } from "@/features/payroll/payroll-line-groups";
import { formatCurrency } from "@/features/payroll/payroll-presentation";
import type { PayslipLineItem, PayslipTotals } from "@/features/payroll/payslip/types";

function SummarySection({ title, lines }: { title: string; lines: readonly PayslipLineItem[] }) {
  if (!lines.length) return null;
  return <section aria-label={title} className="break-inside-avoid">
    <div className="flex min-h-9 items-center justify-between gap-3 text-text-strong">
      <h4 className="font-medium">{title}</h4><span className="shrink-0 font-medium tabular-nums">{formatCurrency(lines.reduce((sum, line) => sum + line.amountVnd, 0))}</span>
    </div>
    <dl className="pl-3 text-secondary">
      {groupPayrollLines(lines).map((group) => <div key={group.key} className="flex min-h-8 items-center justify-between gap-4">
        <dt className="min-w-0 text-text-muted">{group.lines[0].label}</dt>
        <dd className="shrink-0 tabular-nums text-text-default">{formatCurrency(group.amountVnd)}</dd>
      </div>)}
    </dl>
  </section>;
}

const sectionTitleClassName = "text-caption font-semibold uppercase tracking-[0.02em] text-text-muted";

/**
 * Earnings, deductions and net pay as one statement (design 8b): grouped
 * earning lines with their section subtotals, total income, deductions in the
 * danger family with a minus sign, then "Thực nhận" and the amount in words.
 * Every amount comes from the loader; nothing is recalculated here.
 */
export function PayslipLineTables({ deductions, earnings, totals }: {
  deductions: readonly PayslipLineItem[]; earnings: readonly PayslipLineItem[]; totals: PayslipTotals;
}) {
  return <div className="grid gap-4 text-body">
    <section aria-label="Thu nhập" className="grid gap-1">
      <h3 className={sectionTitleClassName}>Thu nhập</h3>
      <SummarySection title="Lương theo công" lines={earnings.filter(line => attendanceLineTypes.has(line.lineType))} />
      <SummarySection title="Chấm bài" lines={earnings.filter(line => line.lineType === "grading_bonus")} />
      <SummarySection title="Thưởng & phụ cấp" lines={earnings.filter(line => !attendanceLineTypes.has(line.lineType) && line.lineType !== "grading_bonus")} />
      {!earnings.length ? <p className="py-2 text-secondary text-text-muted">Không có khoản thu nhập nào ghi nhận trong kỳ.</p> : null}
      <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border-row font-semibold text-text-strong"><span>Tổng thu nhập</span><span className="tabular-nums">{totals.grossFormatted}</span></div>
    </section>

    <section aria-label="Bù trừ & khấu trừ" className="grid gap-1">
      <h3 className={sectionTitleClassName}>Bù trừ & khấu trừ</h3>
      <dl>
        {groupPayrollLines(deductions).map(group => <div key={group.key} className="flex min-h-9 items-center justify-between gap-4 text-danger">
          <dt className="min-w-0">{group.lines[0].label}</dt><dd className="shrink-0 tabular-nums">−{formatCurrency(group.amountVnd)}</dd>
        </div>)}
      </dl>
      {!deductions.length ? <p className="py-2 text-secondary text-text-muted">Không phát sinh khoản tạm ứng hoặc khấu trừ trong kỳ.</p> : null}
      {deductions.some(line => line.lineType === "piecework_offset") ? <p className="text-caption text-text-muted">Bù trừ theo chính sách lương khoán của kỳ. Thưởng chỉ làm tăng thực nhận khi vượt ngưỡng bù trừ.</p> : null}
      <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border-row font-semibold"><span className="text-text-strong">Tổng bù trừ & khấu trừ</span><span className="tabular-nums text-danger">{totals.totalDeductionsVnd > 0 ? "−" : ""}{totals.totalDeductionsFormatted}</span></div>
    </section>

    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 border-t-2 border-text-strong pt-2 text-text-strong">
      <span className="text-[16px] font-bold">Thực nhận</span>
      <span className="text-[20px] font-bold leading-7 tabular-nums">{totals.netFormatted}</span>
    </div>
    <p className="text-secondary italic text-text-muted">
      <span className="font-semibold not-italic text-text-default">Bằng chữ:</span> {totals.amountInWords}
    </p>
  </div>;
}
