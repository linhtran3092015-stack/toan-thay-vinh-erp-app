import {
  getPayslipDocumentData,
  getPayslipPdfFilename,
} from "@/features/payroll/payslip/payslip-data";
import { generatePayslipPdf } from "@/features/payroll/payslip/pdf-generator";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      periodId: string;
      statementId: string;
    }>;
  },
) {
  const { periodId, statementId } = await context.params;

  const result = await getPayslipDocumentData(periodId, statementId);

  if (!result.ok) {
    const status =
      result.error === "PERMISSION_DENIED"
        ? 403
        : result.error === "NOT_AUTHENTICATED"
          ? 401
          : 404;

    return new NextResponse(result.message, { status });
  }

  const pdfBinary = generatePayslipPdf(result.data);
  const filename = getPayslipPdfFilename(result.data);

  return new Response(pdfBinary as unknown as BodyInit, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
    },
    status: 200,
  });
}
