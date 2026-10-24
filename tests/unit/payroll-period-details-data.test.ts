import { describe, expect, it, vi } from "vitest";

import { getPayrollPeriodsWithDetailsResult } from "@/features/payroll/data";
import {
  normalizePayrollPeriodsWithDetailsRows,
  type PayrollPeriodsWithDetailsRow,
} from "@/features/payroll/read-models";

const supabase = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: supabase.from, rpc: supabase.rpc })),
}));

function row(
  overrides: Partial<PayrollPeriodsWithDetailsRow>,
): PayrollPeriodsWithDetailsRow {
  return {
    line_amount_vnd: 100,
    line_direction: "earning",
    line_type: "manual_reward",
    note: "Stored note",
    pay_date: "2026-05-28",
    payable_amount_vnd: 777,
    payroll_line_item_id: "line-1",
    payroll_period_id: "period-1",
    payroll_statement_id: "statement-1",
    period_month: "2026-04-01",
    period_status: "review",
    staff_display_name: "Mina Ordinary",
    staff_employee_code: "EMP-ORD",
    staff_id: "staff-1",
    total_deductions_vnd: 111,
    total_earnings_vnd: 888,
    unit_count: null,
    unit_rate_vnd: null,
    work_hours: 18,
    work_units: 2,
    ...overrides,
  };
}

describe("normalizePayrollPeriodsWithDetailsRows", () => {
  it("keeps an authoritative zero-statement period without a placeholder statement", () => {
    expect(
      normalizePayrollPeriodsWithDetailsRows([
        row({
          line_amount_vnd: null,
          line_direction: null,
          line_type: null,
          note: null,
          payable_amount_vnd: null,
          payroll_line_item_id: null,
          payroll_period_id: "empty-period",
          payroll_statement_id: null,
          period_month: "2026-05-01",
          period_status: "draft",
          staff_display_name: null,
          staff_employee_code: null,
          staff_id: null,
          total_deductions_vnd: null,
          total_earnings_vnd: null,
          work_hours: null,
          work_units: null,
        }),
      ]),
    ).toMatchObject([
      {
        id: "empty-period",
        payDate: "2026-05-28",
        periodMonth: "2026-05-01",
        status: "draft",
        statements: [],
      },
    ]);
  });

  it("groups flattened lines without recalculating stored statement totals", () => {
    const result = normalizePayrollPeriodsWithDetailsRows([
      row({
        line_amount_vnd: null,
        line_direction: null,
        line_type: null,
        note: null,
        payroll_line_item_id: null,
      }),
      row({
        line_amount_vnd: 100,
        payroll_line_item_id: "line-1",
      }),
      row({
        line_amount_vnd: 50,
        line_direction: "deduction",
        line_type: "manual_deduction",
        note: "Stored deduction",
        payroll_line_item_id: "line-2",
      }),
    ]);

    expect(result).toMatchObject([
      {
        id: "period-1",
        payDate: "2026-05-28",
        periodMonth: "2026-04-01",
        status: "review",
        statements: [
          {
            id: "statement-1",
            lines: [
              {
                amountVnd: 100,
                direction: "earning",
                id: "line-1",
                lineType: "manual_reward",
                note: "Stored note",
                payrollStatementId: "statement-1",
                unitCount: null,
                unitRateVnd: null,
              },
              {
                amountVnd: 50,
                direction: "deduction",
                id: "line-2",
                lineType: "manual_deduction",
                note: "Stored deduction",
                payrollStatementId: "statement-1",
                unitCount: null,
                unitRateVnd: null,
              },
            ],
            payableAmountVnd: 777,
            payrollPeriodId: "period-1",
            staffDisplayName: "Mina Ordinary",
            staffEmployeeCode: "EMP-ORD",
            staffId: "staff-1",
            totalDeductionsVnd: 111,
            totalEarningsVnd: 888,
            workHours: 18,
            workUnits: 2,
          },
        ],
      },
    ]);
  });

  it("preserves server ordering across periods while retaining zero-line statements", () => {
    const result = normalizePayrollPeriodsWithDetailsRows([
      row({
        line_amount_vnd: 600,
        payroll_line_item_id: "period-a-line-1",
        payroll_period_id: "period-a",
        payroll_statement_id: "period-a-statement",
        period_month: "2026-06-01",
        period_status: "approved",
        total_deductions_vnd: 200,
        total_earnings_vnd: 1_000,
        payable_amount_vnd: 800,
      }),
      row({
        line_amount_vnd: 400,
        line_type: "hourly_wage",
        payroll_line_item_id: "period-a-line-2",
        payroll_period_id: "period-a",
        payroll_statement_id: "period-a-statement",
        period_month: "2026-06-01",
        period_status: "approved",
        total_deductions_vnd: 200,
        total_earnings_vnd: 1_000,
        payable_amount_vnd: 800,
      }),
      row({
        line_amount_vnd: null,
        line_direction: null,
        line_type: null,
        note: null,
        payroll_line_item_id: null,
        payroll_period_id: "period-b",
        payroll_statement_id: "period-b-statement",
        period_month: "2026-05-01",
        period_status: "review",
        staff_display_name: "Bao Viewer",
        total_deductions_vnd: 17,
        total_earnings_vnd: 101,
        payable_amount_vnd: 84,
        work_hours: 9,
        work_units: 1,
      }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((period) => [period.id, period.status])).toEqual([
      ["period-a", "approved"],
      ["period-b", "review"],
    ]);

    const [periodA, periodB] = result;
    expect(periodA.statements).toHaveLength(1);
    expect(periodA.statements[0]).toMatchObject({
      id: "period-a-statement",
      totalDeductionsVnd: 200,
      totalEarningsVnd: 1_000,
      payableAmountVnd: 800,
    });
    expect(periodA.statements[0].lines.map((line) => line.id)).toEqual([
      "period-a-line-1",
      "period-a-line-2",
    ]);

    expect(periodB.statements).toEqual([
      expect.objectContaining({
        id: "period-b-statement",
        lines: [],
        totalDeductionsVnd: 17,
        totalEarningsVnd: 101,
        payableAmountVnd: 84,
      }),
    ]);
  });
});

describe("getPayrollPeriodsWithDetailsResult", () => {
  // Value: protects=the payroll page reads every line of the details RPC past PostgREST's max_rows, so payslip totals summed from lines (display income, Khấu trừ, Lương khoán) are not cut short;
  // fails_when=the loader goes back to one un-ranged rpc call (the mocked builder is not a result, so the read fails closed) or stops after the first full 500-row page (the statement keeps 500 of 502 lines), or asks overlapping ranges;
  // why_new=payslip totals are now summed from lines, and no test exercised this loader (payroll-route mocks it whole);
  // seam=createSupabaseServerClient mocked: the details RPC returns a range builder, the explanations RPC and the payroll_periods payment read return empty results; no_claim=does not prove max_rows on prod or that the RPC's ORDER BY keeps pages from overlapping
  it("reads every page of the details RPC", async () => {
    const pages = [
      Array.from({ length: 500 }, (_, index) => row({ line_amount_vnd: 1_000, payroll_line_item_id: `line-${index}` })),
      [row({ line_amount_vnd: 2_000, payroll_line_item_id: "line-500" }), row({ line_amount_vnd: 3_000, payroll_line_item_id: "line-501" })],
    ];
    supabase.range.mockImplementation(async (from: number) => ({ data: pages[from / 500] ?? [], error: null }));
    supabase.rpc.mockImplementation((name: string) => name === "get_payroll_periods_with_details"
      ? { range: supabase.range }
      : Promise.resolve({ data: { lines: [], periods: [], statements: [] }, error: null }));
    supabase.from.mockReturnValue({ select: () => Promise.resolve({ data: [], error: null }) });

    const result = await getPayrollPeriodsWithDetailsResult();

    expect(supabase.range.mock.calls).toEqual([[0, 499], [500, 999]]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.data[0].statements[0].lines;
    expect(lines).toHaveLength(502);
    expect(lines.slice(-2).map((line) => [line.id, line.amountVnd])).toEqual([["line-500", 2_000], ["line-501", 3_000]]);
  });

  // Value: protects=a line that a write between two page requests pushes onto the next page as well is kept once, so line-derived payslip totals are not doubled;
  // fails_when=the dedupe by payroll_line_item_id is removed (line-499 is listed twice and the statement has 502 lines);
  // why_new=paging splits one read into several, each its own snapshot;
  // seam=@/lib/supabase/server mocked; no_claim=does not recover a line skipped by such a write (a per-period read is the follow-up)
  it("keeps a line once when a page boundary repeats it", async () => {
    const first = Array.from({ length: 500 }, (_, index) => row({ line_amount_vnd: 1_000, payroll_line_item_id: `line-${index}` }));
    const second = [row({ line_amount_vnd: 1_000, payroll_line_item_id: "line-499" }), row({ line_amount_vnd: 2_000, payroll_line_item_id: "line-500" })];
    supabase.range.mockImplementation(async (from: number) => ({ data: from === 0 ? first : second, error: null }));
    supabase.rpc.mockImplementation((name: string) => name === "get_payroll_periods_with_details"
      ? { range: supabase.range }
      : Promise.resolve({ data: { lines: [], periods: [], statements: [] }, error: null }));
    supabase.from.mockReturnValue({ select: () => Promise.resolve({ data: [], error: null }) });

    const result = await getPayrollPeriodsWithDetailsResult();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.data[0].statements[0].lines.map((line) => line.id);
    expect(ids).toHaveLength(501);
    expect(new Set(ids).size).toBe(501);
  });
});
