import { attendanceLineTypes, groupPayrollLines, PIECEWORK_OFFSET } from "@/features/payroll/payroll-line-groups";
import { formatCurrency, formatSignedCurrency, getLineTypeLabel } from "@/features/payroll/payroll-presentation";
import { getPayslipSection, getPieceworkExplanation, type PieceworkSummary, signedAmount } from "@/features/payroll/payslip-sections";
import type { PayslipLineItem, PayslipTotals } from "@/features/payroll/payslip/types";

const rowClassName = "flex min-h-8 items-center justify-between gap-4";

/**
 * One income section: its lines (grouped by type, or one row each with the
 * manager's note), optional rows such as the lương khoán offset, a subtotal
 * (the signed sum unless given) and an optional explanation.
 */
function SummarySection({ extraRows = [], footer, lines, perLine = false, subtotal, title }: {
  extraRows?: readonly { label: string; value: string }[];
  footer?: string;
  lines: readonly PayslipLineItem[];
  perLine?: boolean;
  subtotal?: number;
  title: string;
}) {
  if (!lines.length && !extraRows.length) return null;
  return <section aria-label={title} className="break-inside-avoid">
    <div className="flex min-h-9 items-center justify-between gap-3 text-text-strong">
      <h4 className="font-medium">{title}</h4><span className="shrink-0 font-medium tabular-nums">{formatSignedCurrency(subtotal ?? lines.reduce((sum, line) => sum + signedAmount(line), 0))}</span>
    </div>
    <dl className="pl-3 text-secondary">
      {perLine
        ? lines.map((line) => <div key={line.id} className={`${rowClassName} items-start py-1`}>
          <dt className="min-w-0 text-text-muted">{line.label}{line.note ? <span className="block text-caption [overflow-wrap:anywhere]">{line.note}</span> : null}</dt>
          <dd className="shrink-0 tabular-nums text-text-default">{formatSignedCurrency(signedAmount(line))}</dd>
        </div>)
        : groupPayrollLines(lines).map((group) => <div key={group.key} className={rowClassName}>
          <dt className="min-w-0 text-text-muted">{group.lines[0].label}</dt>
          <dd className="shrink-0 tabular-nums text-text-default">{formatCurrency(group.amountVnd)}</dd>
        </div>)}
      {extraRows.map((row) => <div key={row.label} className={rowClassName}>
        <dt className="min-w-0 text-text-muted">{row.label}</dt>
        <dd className="shrink-0 tabular-nums text-text-muted">{row.value}</dd>
      </div>)}
    </dl>
    {footer ? <p className="pl-3 text-caption text-text-muted">{footer}</p> : null}
  </section>;
}

const sectionTitleClassName = "text-caption font-semibold uppercase tracking-[0.02em] text-text-muted";

/**
 * Earnings, deductions and net pay as one statement (design 8b): grouped
 * earning lines with their section subtotals, total income, real deductions in
 * the danger family with a minus sign, then "Thực nhận" and the amount in
 * words. Lương khoán and manual adjustments sit under income (see
 * payslip-sections.ts). Every amount comes from the loader; nothing is
 * recalculated here.
 */
export function PayslipLineTables({ adjustments, deductions, earnings, piecework, totals }: {
  adjustments: readonly PayslipLineItem[]; deductions: readonly PayslipLineItem[]; earnings: readonly PayslipLineItem[];
  piecework: PieceworkSummary | null; totals: PayslipTotals;
}) {
  const sectionOf = (line: PayslipLineItem) => getPayslipSection(line, piecework !== null);
  return <div className="grid gap-4 text-body">
    <section aria-label="Thu nhập" className="grid gap-1">
      <h3 className={sectionTitleClassName}>Thu nhập</h3>
      <SummarySection title="Lương theo công" lines={earnings.filter(line => attendanceLineTypes.has(line.lineType))} />
      <SummarySection title="Chấm bài" lines={earnings.filter(line => sectionOf(line) === "grading")} />
      {piecework ? <SummarySection
        extraRows={[{ label: getLineTypeLabel(PIECEWORK_OFFSET), value: formatSignedCurrency(-piecework.absorbedVnd) }]}
        footer={getPieceworkExplanation(piecework)}
        lines={earnings.filter(line => sectionOf(line) === "piecework")}
        subtotal={piecework.addedVnd}
        title="Lương khoán"
      /> : null}
      <SummarySection title="Thưởng & phụ cấp" lines={earnings.filter(line => sectionOf(line) === "earnings")} />
      <SummarySection lines={adjustments} perLine title="Điều chỉnh" />
      {!earnings.length && !adjustments.length ? <p className="py-2 text-secondary text-text-muted">Không có khoản thu nhập nào ghi nhận trong kỳ.</p> : null}
      <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border-row font-semibold text-text-strong"><span>Tổng thu nhập</span><span className="tabular-nums">{totals.grossFormatted}</span></div>
    </section>

    <section aria-label="Khấu trừ" className="grid gap-1">
      <h3 className={sectionTitleClassName}>Khấu trừ</h3>
      <dl>
        {groupPayrollLines(deductions).map(group => <div key={group.key} className="flex min-h-9 items-center justify-between gap-4 text-danger">
          <dt className="min-w-0">{group.lines[0].label}</dt><dd className="shrink-0 tabular-nums">−{formatCurrency(group.amountVnd)}</dd>
        </div>)}
      </dl>
      {!deductions.length ? <p className="py-2 text-secondary text-text-muted">Không phát sinh khoản tạm ứng hoặc khấu trừ trong kỳ.</p> : null}
      <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border-row font-semibold"><span className="text-text-strong">Tổng khấu trừ</span><span className={`tabular-nums ${totals.totalDeductionsVnd > 0 ? "text-danger" : "text-text-muted"}`}>{totals.totalDeductionsVnd > 0 ? "−" : ""}{totals.totalDeductionsFormatted}</span></div>
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
