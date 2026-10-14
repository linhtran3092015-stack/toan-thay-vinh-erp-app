import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { PayslipDocument } from "@/features/payroll/payslip/components/payslip-document";
import { PayslipToolbar } from "@/features/payroll/payslip/components/payslip-toolbar";
import { getPayslipDocumentData } from "@/features/payroll/payslip/payslip-data";
import { redirect } from "next/navigation";

interface PayslipPageProps {
  params: Promise<{
    periodId: string;
    statementId: string;
  }>;
}

export default async function PayslipPageRoute({ params }: PayslipPageProps) {
  const { periodId, statementId } = await params;

  const result = await getPayslipDocumentData(periodId, statementId);

  if (!result.ok) {
    if (result.error === "STATEMENT_STALE" && result.suggestedCurrentStatementId) {
      redirect(
        `/payroll/${periodId}/statements/${result.suggestedCurrentStatementId}/payslip`,
      );
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
      <PayslipToolbar pdfDownloadUrl={pdfDownloadUrl} />
      <main className="p-4 print:p-0 sm:p-6">
        <PayslipDocument data={result.data} />
      </main>
    </div>
  );
}
