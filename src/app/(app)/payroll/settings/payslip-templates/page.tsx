import { ErrorState } from "@/components/shared/error-state";
import { TemplateListPage } from "@/features/payroll/payslip-template/components/template-list-page";
import { getPayslipTemplatesListResult } from "@/features/payroll/payslip-template/data";

export default async function PayslipTemplatesPage() {
  const result = await getPayslipTemplatesListResult();

  if (!result.ok) {
    return (
      <ErrorState
        description={result.message}
        title="Không thể tải danh sách mẫu phiếu lương"
      />
    );
  }

  return <TemplateListPage templates={result.data} />;
}
