import { type NextRequest, NextResponse } from "next/server";

import { getStaffPayrollEstimateResult } from "@/features/payroll/estimate/data";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const noStoreHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
};

/**
 * Lương tạm tính theo ngày của một nhân sự (chủ trung tâm xem từ dashboard).
 * Quyền được kiểm tra trong RPC get_staff_payroll_estimate.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawMonth = searchParams.get("month");
  const staffId = searchParams.get("staffId");

  if (!rawMonth) {
    return NextResponse.json(
      { error: "Tham số month là bắt buộc (định dạng YYYY-MM-DD hoặc YYYY-MM)" },
      { status: 400 },
    );
  }

  if (!staffId || !UUID_PATTERN.test(staffId)) {
    return NextResponse.json(
      { error: "Tham số staffId không hợp lệ" },
      { status: 400 },
    );
  }

  const normalizedMonth = rawMonth.length === 7 ? `${rawMonth}-01` : rawMonth;
  const result = await getStaffPayrollEstimateResult({ month: normalizedMonth, staffId });

  if (!result.ok) {
    const isPermissionError = result.error?.includes("PERMISSION_REQUIRED") ?? false;
    const isNotFound = result.error === "STAFF_PROFILE_NOT_FOUND";

    return NextResponse.json(
      { error: result.error ?? "Không thể tính toán lương tạm tính của nhân sự" },
      {
        headers: noStoreHeaders,
        status: isPermissionError ? 403 : isNotFound ? 404 : 500,
      },
    );
  }

  return NextResponse.json(result.data, { headers: noStoreHeaders, status: 200 });
}
