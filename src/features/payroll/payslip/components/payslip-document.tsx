import { PayslipBreakdowns } from "@/features/payroll/payslip/components/payslip-breakdowns";
import { PayslipEmployeeCard } from "@/features/payroll/payslip/components/payslip-employee-card";
import { PayslipHeader } from "@/features/payroll/payslip/components/payslip-header";
import { PayslipLineTables } from "@/features/payroll/payslip/components/payslip-line-tables";
import { PayslipNotesFooter } from "@/features/payroll/payslip/components/payslip-notes-footer";
import { PayslipSummaryCard } from "@/features/payroll/payslip/components/payslip-summary-card";
import { PayslipSummaryFormula } from "@/features/payroll/payslip/components/payslip-summary-formula";
import type { PayslipDocumentData } from "@/features/payroll/payslip/types";

export function PayslipDocument({ data }: { data: PayslipDocumentData }) {
  const isDraft = data.period.status === "draft";

  return (
    <article
      aria-label={`Phiếu lương ${data.employee.displayName} - ${data.period.periodMonthFormatted}`}
      className="relative mx-auto my-6 max-w-[210mm] overflow-hidden rounded-2xl border border-border-subtle bg-surface-base p-6 shadow-sm print:my-0 print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none sm:p-8"
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

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <PayslipHeader period={data.period} />

        {/* Top 2 Cards: Employee Info & Income Overview */}
        <div className="grid gap-5 md:grid-cols-2">
          <PayslipEmployeeCard employee={data.employee} />
          <PayslipSummaryCard totals={data.totals} />
        </div>

        {/* Tables: Earnings & Deductions */}
        <PayslipLineTables
          deductions={data.deductions}
          earnings={data.earnings}
          totals={data.totals}
        />

        {/* Extra Breakdowns (Only rendered if present) */}
        <details className="rounded-xl border border-border-subtle p-4 print:hidden"><summary className="cursor-pointer font-semibold text-action-primary">Xem căn cứ tính công, chấm bài & hoa hồng</summary><div className="mt-4"><PayslipBreakdowns breakdowns={data.breakdowns} /></div></details>

        {/* Highlight Equation Formula Bar */}
        <PayslipSummaryFormula totals={data.totals} />

        {/* Notes & Footer */}
        <PayslipNotesFooter
          employee={data.employee}
          period={data.period}
        />
      </div>
    </article>
  );
}
