import { type NextRequest, NextResponse } from "next/server";

import { getOwnerPayrollEstimateResult } from "@/features/payroll/estimate/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawMonth = searchParams.get("month");
  const positionCode = searchParams.get("position");

  if (!rawMonth) {
    return NextResponse.json(
      { error: "Tham số month là bắt buộc (định dạng YYYY-MM-DD hoặc YYYY-MM)" },
      { status: 400 },
    );
  }

  const normalizedMonth = rawMonth.length === 7 ? `${rawMonth}-01` : rawMonth;
  const result = await getOwnerPayrollEstimateResult({
    month: normalizedMonth,
    positionCode: positionCode || null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Không thể tính toán tổng quan lương tạm tính" },
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
