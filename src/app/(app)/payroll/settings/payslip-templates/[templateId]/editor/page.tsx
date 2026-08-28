import { ErrorState } from "@/components/shared/error-state";
import { TemplateEditor } from "@/features/payroll/payslip-template/components/template-editor";
import { getPayslipTemplateDetailResult } from "@/features/payroll/payslip-template/data";

interface TemplateEditorPageProps {
  params: Promise<{
    templateId: string;
  }>;
  searchParams: Promise<{
    v?: string;
  }>;
}

export default async function TemplateEditorPage({
  params,
  searchParams,
}: TemplateEditorPageProps) {
  const { templateId } = await params;
  const { v } = await searchParams;

  const versionNumber = v ? Number.parseInt(v, 10) : undefined;
  const result = await getPayslipTemplateDetailResult(
    templateId,
    Number.isNaN(versionNumber) ? undefined : versionNumber,
  );

  if (!result.ok) {
    return (
      <ErrorState
        description={result.message}
        title="Không thể tải trình thiết kế mẫu phiếu lương"
      />
    );
  }

  return <TemplateEditor initialDetail={result.data} />;
}
