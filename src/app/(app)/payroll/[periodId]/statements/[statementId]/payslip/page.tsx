import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { PayslipDocument } from "@/features/payroll/payslip/components/payslip-document";
import { PayslipToolbar } from "@/features/payroll/payslip/components/payslip-toolbar";
import { getPayslipDocumentData } from "@/features/payroll/payslip/payslip-data";
import {
  getPayrollReturnHref,
  getPayslipHref,
  parsePayrollPeriodCount,
} from "@/features/payroll/period-window";
import { redirect } from "next/navigation";

interface PayslipPageProps {
  params: Promise<{
    periodId: string;
    statementId: string;
  }>;
  /** `?periods=`: how many periods /payroll was showing when the payslip was opened. */
  searchParams: Promise<{ periods?: string | string[] }>;
}

export default async function PayslipPageRoute({ params, searchParams }: PayslipPageProps) {
  const { periodId, statementId } = await params;
  const periodCount = parsePayrollPeriodCount((await searchParams).periods);

  const result = await getPayslipDocumentData(periodId, statementId);

  if (!result.ok) {
    if (result.error === "STATEMENT_STALE" && result.suggestedCurrentStatementId) {
      redirect(getPayslipHref(periodId, result.suggestedCurrentStatementId, periodCount));
    }

    if (result.error === "PERMISSION_DENIED") {
      return (
        <div className="p-6">
          <PermissionDeniedState
            description={result.message}
            title="Không có quyền xem phiếu lương"
          />
        </div>
      );
    }

    return (
      <div className="p-6">
        <ErrorState
          description={result.message}
          title="Không tải được phiếu lương"
        />
      </div>
    );
  }

  const pdfDownloadUrl = `/payroll/${periodId}/statements/${statementId}/payslip/pdf`;

  return (
    <div className="min-h-screen bg-surface-canvas print:bg-white">
      <PayslipToolbar backHref={getPayrollReturnHref(periodId, periodCount)} pdfDownloadUrl={pdfDownloadUrl} />
      <main className="p-4 print:p-0 sm:p-6">
        <PayslipDocument data={result.data} />
      </main>
    </div>
  );
}
