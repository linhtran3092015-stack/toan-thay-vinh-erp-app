import { type NextRequest, NextResponse } from "next/server";

import { getMyPayrollEstimateResult } from "@/features/payroll/estimate/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawMonth = searchParams.get("month");

  if (!rawMonth) {
    return NextResponse.json(
      { error: "Tham số month là bắt buộc (định dạng YYYY-MM-DD hoặc YYYY-MM)" },
      { status: 400 },
    );
  }

  const normalizedMonth = rawMonth.length === 7 ? `${rawMonth}-01` : rawMonth;
  const result = await getMyPayrollEstimateResult(normalizedMonth);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Không thể tính toán lương tạm tính" },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
        status: 500,
      },
    );
  }

  return NextResponse.json(result.data, {
    headers: {
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
    status: 200,
  });
}
