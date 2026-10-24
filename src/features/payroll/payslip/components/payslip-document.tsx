import { PayslipBreakdowns } from "@/features/payroll/payslip/components/payslip-breakdowns";
import { PayslipEmployeeCard } from "@/features/payroll/payslip/components/payslip-employee-card";
import { PayslipHeader } from "@/features/payroll/payslip/components/payslip-header";
import { PayslipLineTables } from "@/features/payroll/payslip/components/payslip-line-tables";
import { PayslipNotesFooter } from "@/features/payroll/payslip/components/payslip-notes-footer";
import type { PayslipDocumentData } from "@/features/payroll/payslip/types";

/**
 * Payslip card (design 8b): header, employee/period/masked bank, earnings,
 * deductions, "Thực nhận" with the amount in words, calculation evidence, then
 * notes and the recipient signature. Dropped for lack of data: payslip code,
 * personal income tax line, paid-transfer line, reconciler/approver names and
 * the Zalo send action.
 */
export function PayslipDocument({ data }: { data: PayslipDocumentData }) {
  const isDraft = data.period.status === "draft";
  const hasBreakdowns =
    data.breakdowns.workHours.length > 0 || data.breakdowns.grading !== null || data.breakdowns.commissions.length > 0;

  return (
    <article
      aria-label={`Phiếu lương ${data.employee.displayName} - ${data.period.periodMonthFormatted}`}
      className="relative mx-auto max-w-[210mm] overflow-hidden rounded-lg border border-border-subtle bg-surface-base p-5 shadow-[var(--panel-shadow)] print:my-0 print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none sm:p-8"
    >
      {/* Draft Watermark */}
      {isDraft ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none"
        >
          <span className="rotate-[-30deg] text-6xl font-black tracking-widest text-text-strong/[0.05] uppercase sm:text-8xl">
            BẢN NHÁP
          </span>
        </div>
      ) : null}

      <div className="relative z-10 grid gap-5">
        <PayslipHeader period={data.period} />

        <PayslipEmployeeCard employee={data.employee} period={data.period} />

        <PayslipLineTables
          adjustments={data.adjustments}
          deductions={data.deductions}
          earnings={data.earnings}
          piecework={data.piecework}
          totals={data.totals}
        />

        {hasBreakdowns ? (
          <details className="rounded-lg border border-border-subtle px-4 py-3 print:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center text-secondary font-semibold text-text-strong">
              Xem căn cứ tính công, chấm bài & hoa hồng
            </summary>
            <div className="mt-3">
              <PayslipBreakdowns breakdowns={data.breakdowns} />
            </div>
          </details>
        ) : null}

        <PayslipNotesFooter
          employee={data.employee}
          period={data.period}
        />
      </div>
    </article>
  );
}
