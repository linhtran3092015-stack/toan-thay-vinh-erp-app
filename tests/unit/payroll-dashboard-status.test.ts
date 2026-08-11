import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPayrollDashboardResult } from "@/features/payroll/data";

const dependencies = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc: dependencies.rpc })),
}));

function entry(periodStatus: string) {
  return {
    pay_date: "2026-08-31",
    payable_amount_vnd: 100,
    payroll_period_id: "period-1",
    payroll_statement_id: "statement-1",
    period_month: "2026-08-01",
    period_status: periodStatus,
    staff_display_name: "Nguyễn An",
    staff_employee_code: "NV-001",
    staff_id: "staff-1",
    total_deductions_vnd: 0,
    total_earnings_vnd: 100,
    work_hours: 1,
    work_units: 1,
  };
}

describe("Payroll dashboard status transport", () => {
  beforeEach(() => {
    dependencies.rpc.mockReset();
  });

  it("preserves known and unsupported stored statuses without fabricating draft", async () => {
    dependencies.rpc.mockResolvedValue({
      data: [entry("draft"), entry("review"), entry("approved"), entry("constructor")],
      error: null,
    });

    const result = await getPayrollDashboardResult();

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      throw new Error("Expected Payroll dashboard data");
    }

    expect(result.data.map((item) => item.periodStatus)).toEqual([
      "draft",
      "review",
      "approved",
      "constructor",
    ]);
  });
});
