import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPayrollStatementDetailsResult,
  getRecentPayrollPeriodsResult,
} from "@/features/payroll/data";
import {
  findUnreconciledStatementIds,
  parsePayrollPeriodDetails,
} from "@/features/payroll/read-models";

const supabase = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc: supabase.rpc })),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

type Payload = ReturnType<typeof payload>;

function line(overrides: Record<string, unknown> = {}) {
  return {
    amountVnd: 1_000_000,
    direction: "earning",
    evidenceSnapshot: {},
    formulaSnapshot: {},
    id: "line-1",
    lineType: "manual_reward",
    note: "Stored note",
    policyCode: null,
    quantity: null,
    sourceKind: null,
    unitCount: null,
    unitLabel: null,
    unitRateVnd: null,
    workMinutes: null,
    ...overrides,
  };
}

/** One period, one statement: 1.000.000 earning − 100.000 deduction = 900.000 (fictional). */
function payload() {
  return {
    olderPeriodCount: 0,
    periods: [{
      blockingIssueCount: 0,
      currentRevision: 2 as number | null,
      feedbackClosedAt: null,
      feedbackOpenedAt: "2026-05-28T00:00:00+00:00",
      id: "period-1",
      lastCalculatedAt: "2026-05-28T00:00:00+00:00",
      paidAt: null,
      paidOn: null,
      payDate: "2026-05-28",
      paymentReference: null,
      pendingCorrectionCount: 0,
      periodMonth: "2026-04-01",
      statements: [{
        id: "statement-1",
        lines: [
          line(),
          line({ amountVnd: 100_000, direction: "deduction", id: "line-2", lineType: "manual_deduction" }),
        ],
        payableAmountVnd: 900_000,
        payrollPeriodId: "period-1",
        staffDisplayName: "Mina Ordinary",
        staffEmployeeCode: "EMP-ORD",
        staffId: "staff-1",
        totalDeductionsVnd: 100_000,
        totalEarningsVnd: 1_000_000,
        workHours: 18,
        workMinutes: 1_080,
        workUnits: 2,
      }],
      status: "review",
    }],
    staleStatement: null as { currentStatementId: string | null } | null,
  };
}

/** The same payload with the deduction line missing, as a cut read would return it. */
function payloadMissingALine(): Payload {
  const value = payload();
  value.periods[0].statements[0].lines = value.periods[0].statements[0].lines.slice(0, 1);
  return value;
}

describe("parsePayrollPeriodDetails", () => {
  it("maps the RPC payload to period reads and tags each line with its statement", () => {
    const details = parsePayrollPeriodDetails(payload());

    expect(details.olderPeriodCount).toBe(0);
    expect(details.staleStatement).toBeNull();
    expect(details.periods[0]).toMatchObject({
      currentRevision: 2,
      id: "period-1",
      paidAt: null,
      periodMonth: "2026-04-01",
      status: "review",
    });
    expect(details.periods[0].statements[0].lines.map((entry) => [entry.id, entry.payrollStatementId])).toEqual([
      ["line-1", "statement-1"],
      ["line-2", "statement-1"],
    ]);
  });

  it("shows a period without a calculation run as the first revision", () => {
    const value = payload();
    value.periods[0].currentRevision = null;
    value.periods[0].statements = [];

    expect(parsePayrollPeriodDetails(value).periods[0].currentRevision).toBe(1);
  });

  it("rejects a payload that breaks the contract", () => {
    expect(() => parsePayrollPeriodDetails({ periods: [] })).toThrow("PAYROLL_PERIOD_DETAILS_INVALID");
  });
});

describe("findUnreconciledStatementIds", () => {
  it("accepts a statement whose lines add up to its totals", () => {
    expect(findUnreconciledStatementIds(parsePayrollPeriodDetails(payload()).periods)).toEqual([]);
  });

  it("flags a missing deduction line, a missing earning line and a payable that does not follow", () => {
    const missingEarning = payload();
    missingEarning.periods[0].statements[0].lines = missingEarning.periods[0].statements[0].lines.slice(1);
    const wrongPayable = payload();
    wrongPayable.periods[0].statements[0].payableAmountVnd = 1_000_000;

    expect(findUnreconciledStatementIds(parsePayrollPeriodDetails(payloadMissingALine()).periods)).toEqual(["statement-1"]);
    expect(findUnreconciledStatementIds(parsePayrollPeriodDetails(missingEarning).periods)).toEqual(["statement-1"]);
    expect(findUnreconciledStatementIds(parsePayrollPeriodDetails(wrongPayable).periods)).toEqual(["statement-1"]);
  });
});

describe("getPayrollStatementDetailsResult", () => {
  // Value: protects=the payslip page and PDF read one statement in one call, not every period's lines page by page;
  // fails_when=the loader drops the period/statement arguments, pages the read, or calls the RPC more than once for a reconciled read;
  // why_new=v0.39 paged the whole history through get_payroll_periods_with_details;
  // seam=createSupabaseServerClient mocked; no_claim=does not prove the RPC filters by these arguments (pgTAP payroll-period-details does)
  it("reads the one statement in a single call", async () => {
    supabase.rpc.mockResolvedValue({ data: payload(), error: null });

    const result = await getPayrollStatementDetailsResult("period-1", "statement-1");

    expect(supabase.rpc.mock.calls).toEqual([[
      "get_payroll_period_details",
      { p_payroll_period_id: "period-1", p_payroll_statement_id: "statement-1" },
    ]]);
    expect(result.ok).toBe(true);
  });

  // Value: protects=a read whose lines do not add up to the statement totals is retried once, and the second, reconciled read is used;
  // fails_when=the loader returns the first, unreconciled read (a payslip with a missing line) or fails without retrying;
  // why_new=reconciliation after the read is new in this change;
  // seam=createSupabaseServerClient mocked; no_claim=does not prove why a real read would disagree (one RPC call is one snapshot)
  it("reads again once when the lines do not reconcile", async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: payloadMissingALine(), error: null })
      .mockResolvedValueOnce({ data: payload(), error: null });

    const result = await getPayrollStatementDetailsResult("period-1", "statement-1");

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.periods[0].statements[0].lines).toHaveLength(2);
  });

  // Value: protects=a statement that still does not reconcile on the second read fails closed instead of rendering totals its lines do not explain;
  // fails_when=the loader returns data after two mismatches, retries more than once, or reports the failure as a plain read error;
  // why_new=reconciliation after the read is new in this change;
  // seam=createSupabaseServerClient mocked, console.error silenced; no_claim=does not check the server log format beyond the statement id
  it("fails closed after two reads that do not reconcile", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.rpc.mockResolvedValue({ data: payloadMissingALine(), error: null });

    const result = await getPayrollStatementDetailsResult("period-1", "statement-1");

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: false, reason: "unreconciled" });
    expect(log).toHaveBeenCalledWith("PAYROLL_DETAILS_UNRECONCILED", "statement-1");
  });

  it("reports an RPC error or an invalid payload as unavailable", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "PAYROLL_VIEW_PERMISSION_REQUIRED" } });
    expect(await getPayrollStatementDetailsResult("period-1", "statement-1")).toEqual({ ok: false, reason: "unavailable" });

    supabase.rpc.mockResolvedValueOnce({ data: { periods: "nope" }, error: null });
    expect(await getPayrollStatementDetailsResult("period-1", "statement-1")).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("getRecentPayrollPeriodsResult", () => {
  // Value: protects=/payroll asks for a bounded number of recent periods instead of the whole history;
  // fails_when=the limit is not passed, or a value outside 1–60 reaches the RPC (which would raise);
  // why_new=/payroll loaded every period before this change;
  // seam=createSupabaseServerClient mocked; no_claim=does not prove the RPC returns the newest periods (pgTAP does)
  it("passes a limit within the RPC's range", async () => {
    supabase.rpc.mockResolvedValue({ data: { ...payload(), olderPeriodCount: 4 }, error: null });

    const recent = await getRecentPayrollPeriodsResult(3);
    await getRecentPayrollPeriodsResult(500);
    await getRecentPayrollPeriodsResult(0);

    await getRecentPayrollPeriodsResult(6, "period-9");

    expect(supabase.rpc.mock.calls.map(([, args]) => args)).toEqual([
      { p_period_limit: 3 },
      { p_period_limit: 60 },
      { p_period_limit: 3 },
      { p_include_payroll_period_id: "period-9", p_period_limit: 6 },
    ]);
    expect(recent.ok && recent.data.olderPeriodCount).toBe(4);
  });
});
