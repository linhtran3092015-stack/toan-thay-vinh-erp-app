// Value: protects=the tuition period read model reads items per locked period through the payment-request FK hint, asks for payment requests only with a payment permission, resolves reissue chains before totalling, and reports a failed read as null instead of zero;
// fails_when=draft periods are queried, payment_request is selected without finance.view/payments.view/payments.manage, the FK hint changes, a reissued student is totalled twice, one period's failure blanks the others, or a failed read yields an empty list;
// why_new=period-summary-data.ts is new and server-only; Supabase is mockable at its client boundary;
// seam=none; no_claim=does not prove PostgREST accepts the embedded select or that RLS returns these rows
// Server-side module: run without a DOM so next/navigation's unstable_rethrow takes its server branch (it also re-throws DYNAMIC_SERVER_USAGE).
// @vitest-environment node
import { DynamicServerError } from "next/dist/client/components/hooks-server-context";
import { notFound } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: supabase.from })),
}));

import type { TuitionPeriodListItem } from "@/features/tuition/data";
import { canReadTuitionPayments } from "@/features/tuition/period-summary";
import { getTuitionPeriodItemRows, getTuitionPeriodSummaries } from "@/features/tuition/period-summary-data";

type Result = { data: unknown; error: unknown };
type Call = [string, unknown[]];

/** Chainable PostgREST stand-in: the result is chosen from this request's own filter calls. */
function mockItems(resultFor: (periodId: string) => Result) {
  const calls: Call[][] = [];
  supabase.from.mockImplementation((table: string) => {
    if (table !== "tuition_collection_items") throw new Error(`Unexpected table query: ${table}`);
    const own: Call[] = [];
    calls.push(own);
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "range"]) {
      builder[method] = vi.fn((...args: unknown[]) => {
        own.push([method, args]);
        return builder;
      });
    }
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const periodId = own.find(([method]) => method === "eq")?.[1][1] as string;
      return Promise.resolve(resultFor(periodId)).then(resolve, reject);
    };
    return builder;
  });
  return calls;
}

const period = (id: string, status: "draft" | "locked", dueOn: string | null = "2026-10-15"): TuitionPeriodListItem => ({
  dueOn,
  endsOn: "2026-10-31",
  id,
  name: id,
  startsOn: "2026-10-01",
  status,
});

const itemRow = (id: string, studentId: string, periodId: string, request: Record<string, unknown> | null, from: string | null = null) => ({
  id,
  payable_amount_vnd: request ? request.expected_amount_vnd : 0,
  payment_request: request,
  period_id: periodId,
  reissued_from_item_id: from,
  student_id: studentId,
});

beforeEach(() => {
  supabase.from.mockReset();
});

describe("canReadTuitionPayments", () => {
  it("follows the student_payment_requests read policy", () => {
    expect(canReadTuitionPayments(["tuition_periods.view"])).toBe(false);
    expect(canReadTuitionPayments(["tuition_periods.view", "payments.view"])).toBe(true);
    expect(canReadTuitionPayments(["finance.view"])).toBe(true);
    expect(canReadTuitionPayments(["payments.manage"])).toBe(true);
  });
});

describe("getTuitionPeriodSummaries", () => {
  it("reads each locked period with the FK hint, skips drafts and counts a reissued student once", async () => {
    const calls = mockItems((periodId) => ({
      data:
        periodId === "oct"
          ? [
              itemRow("a1", "a", "oct", { expected_amount_vnd: 1_000_000, paid_amount_vnd: 0, status: "cancelled" }),
              itemRow("a2", "a", "oct", { expected_amount_vnd: 800_000, paid_amount_vnd: 200_000, status: "partially_paid" }, "a1"),
              itemRow("b1", "b", "oct", { expected_amount_vnd: 500_000, paid_amount_vnd: 500_000, status: "paid" }),
            ]
          : [],
      error: null,
    }));

    const summaries = await getTuitionPeriodSummaries([period("nov", "draft"), period("oct", "locked")], { canViewPayments: true, today: "2026-10-16" });

    expect(Object.keys(summaries)).toEqual(["oct"]);
    expect(summaries.oct).toMatchObject({ collectedVnd: 700_000, isPastDue: true, overdueStudents: 1, payableVnd: 1_300_000, remainingVnd: 600_000, studentCount: 2 });
    expect(calls).toHaveLength(1);
    const select = String(calls[0].find(([method]) => method === "select")?.[1][0]);
    expect(select).toContain("payment_request:student_payment_requests!tuition_collection_items_payment_request_id_fkey");
    expect(select).not.toContain("student_snapshot");
    expect(calls[0]).toContainEqual(["eq", ["period_id", "oct"]]);
  });

  it("does not select payment requests without a payment permission", async () => {
    const calls = mockItems(() => ({ data: [itemRow("a1", "a", "oct", null)], error: null }));

    const summaries = await getTuitionPeriodSummaries([period("oct", "locked")], { canViewPayments: false, today: "2026-10-16" });

    expect(String(calls[0].find(([method]) => method === "select")?.[1][0])).not.toContain("payment_request");
    expect(summaries.oct).toMatchObject({ paymentsVisible: false, studentCount: 1 });
  });

  it("marks only the period whose read failed as null", async () => {
    mockItems((periodId) => (periodId === "sep" ? { data: null, error: { message: "boom" } } : { data: [], error: null }));

    const summaries = await getTuitionPeriodSummaries([period("oct", "locked"), period("sep", "locked")], { canViewPayments: true, today: "2026-10-16" });

    expect(summaries.sep).toBeNull();
    expect(summaries.oct).toMatchObject({ studentCount: 0 });
  });

  // Generated by /ship test coverage audit (Claude) — 2026-10-14
  // Value: protects=a period whose read throws (not just returns an error) and a failed client creation still leave the list rendering, with null only where numbers are unknown;
  // fails_when=the per-period try/catch or the client catch is removed, so Promise.all rejects and the whole /finance/tuition-periods page errors;
  // why_new=the case above only covers a returned PostgREST error; seam=none; no_claim=does not prove which errors supabase-js throws versus returns
  it("isolates a thrown read and a failed client creation instead of rejecting the whole list", async () => {
    mockItems((periodId) => {
      if (periodId === "sep") throw new Error("socket hang up");
      return { data: [itemRow("a1", "a", "oct", { expected_amount_vnd: 500_000, paid_amount_vnd: 0, status: "pending" })], error: null };
    });

    const summaries = await getTuitionPeriodSummaries([period("oct", "locked"), period("sep", "locked"), period("nov", "draft")], { canViewPayments: true, today: "2026-10-14" });
    expect(summaries).toEqual({ oct: expect.objectContaining({ remainingVnd: 500_000, studentCount: 1 }), sep: null });

    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockRejectedValueOnce(new Error("cookies unavailable"));
    await expect(
      getTuitionPeriodSummaries([period("oct", "locked"), period("nov", "draft")], { canViewPayments: true, today: "2026-10-14" }),
    ).resolves.toEqual({ oct: null });
  });
});

describe("getTuitionPeriodItemRows", () => {
  it("returns current items with the student snapshot, or null when the read fails", async () => {
    const calls = mockItems(() => ({
      data: [
        { ...itemRow("a1", "a", "oct", { expected_amount_vnd: 900_000, paid_amount_vnd: 0, status: "pending" }), payable_sessions: 4, student_snapshot: { class_name: "Toán 9A", current_grade: 9, full_name: "An", public_code: "TTV-1" } },
      ],
      error: null,
    }));

    const rows = await getTuitionPeriodItemRows("oct", { canViewPayments: true });

    expect(rows).toEqual([
      expect.objectContaining({ className: "Toán 9A", grade: 9, itemId: "a1", payableSessions: 4, publicCode: "TTV-1", studentName: "An" }),
    ]);
    expect(String(calls[0].find(([method]) => method === "select")?.[1][0])).toContain("student_snapshot");

    mockItems(() => ({ data: null, error: { message: "boom" } }));
    await expect(getTuitionPeriodItemRows("oct", { canViewPayments: true })).resolves.toBeNull();
  });
});

describe("read failure handling", () => {
  // Value: protects=a failed tuition item read is logged with the period id and the error message only (no rows), and Next's own control errors (notFound/redirect, dynamic rendering) are re-thrown instead of becoming "Chưa tải được";
  // fails_when=a failure is swallowed without a log, a log carries row data, or a notFound/DYNAMIC_SERVER_USAGE error is caught and turned into null (breaking not-found pages or static/dynamic detection);
  // why_new=adversarial review: the loaders swallowed every error silently; seam=console.error spied, Supabase mocked at its client boundary; no_claim=does not prove where the logs are shipped
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    log.mockRestore();
  });

  it("logs TUITION_SUMMARY_FAILED with the period id and message only", async () => {
    mockItems((periodId) => (periodId === "sep" ? { data: null, error: { message: "permission denied", details: "row secrets" } } : { data: [], error: null }));
    await getTuitionPeriodSummaries([period("oct", "locked"), period("sep", "locked")], { canViewPayments: true, today: "2026-10-16" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("TUITION_SUMMARY_FAILED", "sep", "permission denied");

    log.mockClear();
    mockItems(() => {
      throw new Error("socket hang up");
    });
    await expect(getTuitionPeriodItemRows("oct", { canViewPayments: true })).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith("TUITION_SUMMARY_FAILED", "oct", "socket hang up");
    for (const call of log.mock.calls) expect(call.every((arg: unknown) => typeof arg === "string")).toBe(true);
  });

  it("re-throws Next control errors instead of reporting a failed read", async () => {
    mockItems(() => notFound());
    await expect(getTuitionPeriodItemRows("oct", { canViewPayments: true })).rejects.toThrow();
    await expect(getTuitionPeriodSummaries([period("oct", "locked")], { canViewPayments: true, today: "2026-10-16" })).rejects.toThrow();

    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockRejectedValueOnce(new DynamicServerError("cookies"));
    await expect(getTuitionPeriodSummaries([period("oct", "locked")], { canViewPayments: true, today: "2026-10-16" })).rejects.toBeInstanceOf(DynamicServerError);
    expect(log).not.toHaveBeenCalled();
  });
});
