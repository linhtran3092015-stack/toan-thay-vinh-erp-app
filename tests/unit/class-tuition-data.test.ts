// Value: protects=the class tuition tab bills each student only for this class's part of a locked period (other classes' lines are left out but flagged), reads payment requests only with payments.view, and for a draft period groups the preview per student with the period page's blockers;
// fails_when=a line from another class or an opening-debt line is counted in the class amount, a student billed only for other classes gets a row, a reissued item shows the original's amount or payment, payment_request is selected without payments.view, a missing unit price is priced as free without its blocker, or a failed read yields an empty table instead of null;
// why_new=class-tuition-data is new and server-only; Supabase is mockable at its client boundary;
// seam=none; no_claim=does not prove PostgREST accepts the embedded select, that RLS returns these rows, or that the preview RPC filters on class_id
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: supabase.from, rpc: supabase.rpc })),
}));

import {
  CLASS_TUITION_PERIOD_LIMIT,
  getClassTuitionPeriod,
  getClassTuitionPeriods,
  getClassTuitionView,
} from "@/features/classes/detail/class-tuition-data";
import type { ClassTuitionPeriodOption } from "@/features/classes/detail/class-tuition-models";
import { resolveReissueChains } from "@/features/tuition/reissue-chains";

type Result = { data: unknown; error: unknown };
type Call = [string, unknown[]];
/** A fixed result, or one computed from this request's own calls (e.g. its filters). */
type TableResult = Result | ((calls: Call[]) => Result);

/** Chainable PostgREST stand-in; records filter calls so tests can assert them. */
function query(result: TableResult, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  const own: Call[] = [];
  for (const method of ["select", "eq", "neq", "in", "is", "or", "gte", "lte", "order", "limit", "range", "maybeSingle"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      own.push([method, args]);
      return builder;
    });
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(typeof result === "function" ? result(own) : result).then(resolve, reject);
  return builder;
}

function tables(results: Record<string, TableResult>) {
  const calls: Record<string, Call[]> = {};
  supabase.from.mockImplementation((table: string) => {
    const result = results[table];
    if (!result) throw new Error(`Unexpected table query: ${table}`);
    calls[table] ??= [];
    return query(result, calls[table]);
  });
  return calls;
}

function previewRpc(result: Result) {
  const calls: Call[] = [];
  supabase.rpc.mockImplementation(() => query(result, calls));
  return calls;
}

const lockedPeriod: ClassTuitionPeriodOption = { dueOn: "2026-10-10", endsOn: "2026-09-30", id: "period-sep", name: "Học phí tháng 9", startsOn: "2026-09-01", status: "locked" };
const draftPeriod: ClassTuitionPeriodOption = { ...lockedPeriod, id: "period-oct", name: "Học phí tháng 10", status: "draft" };

/** A roster row as loadClassEnrollments selects it (unknown statuses are dropped, so every field matters). */
const enrolled = (id: string, fullName: string, publicCode: string | null, overrides: Record<string, unknown> = {}) => ({
  effective_from: "2026-09-01",
  effective_to: null,
  end_reason: null,
  id: `e-${id}`,
  registered_mode: "offline",
  status: "active",
  student: { full_name: fullName, id, public_code: publicCode },
  student_id: id,
  ...overrides,
});
/** The roster read, or the reserved rows' successor read (filtered on supersedes_enrollment_id). */
const roster = (rows: unknown[], successors: unknown[] = []): TableResult => (own) =>
  own.some(([method, args]) => method === "in" && args[0] === "supersedes_enrollment_id") ? { data: successors, error: null } : { data: rows, error: null };
const item = (id: string, studentId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  lines: [],
  payable_amount_vnd: 0,
  payment_request: null,
  reissued_from_item_id: null,
  student_id: studentId,
  ...overrides,
});
const line = (classSessionId: string | null, amount: number | string, kind = "session", sessions = 1) => ({
  amount_vnd: amount,
  class_session_id: classSessionId,
  line_kind: kind,
  payable_session_count: sessions,
});

beforeEach(() => {
  supabase.from.mockReset();
  supabase.rpc.mockReset();
});

describe("getClassTuitionView locked period", () => {
  const arrange = () =>
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [{ id: "s1" }, { id: "s2" }], error: null },
      // Cúc reserved mid-period: still billed for the sessions before, so still read.
      student_enrollments: roster([enrolled("b", "Bảo", "HS2"), enrolled("a", "An", "HS1"), enrolled("c", "Cúc", null, { effective_to: "2026-09-15", status: "reserved" })]),
      tuition_collection_items: {
        data: [
          item("item-a", "a", {
            lines: [line("s1", "200000"), line("s2", 200000, "session", 1), line("other-class-session", 200000), line(null, 300000, "opening_debt", 0)],
            payable_amount_vnd: "900000",
            payment_request: { expected_amount_vnd: "900000", paid_amount_vnd: "300000", status: "partially_paid" },
          }),
          // Only this class: the payment request comes back as a one-element array.
          item("item-b", "b", {
            lines: [line("s1", 200000)],
            payable_amount_vnd: 200000,
            payment_request: [{ expected_amount_vnd: 200000, paid_amount_vnd: 200000, status: "paid" }],
          }),
          // Billed only for another class in this period: no row here.
          item("item-c", "c", { lines: [line("other-class-session", 200000)], payable_amount_vnd: 200000 }),
          // Not a student of this class at all.
          item("item-x", "stranger", { lines: [line("s1", 200000)], payable_amount_vnd: 200000 }),
        ],
        error: null,
      },
    });

  it("keeps only this class's session lines, flags other charges and skips students billed elsewhere", async () => {
    const calls = arrange();

    const view = await getClassTuitionView("class-1", lockedPeriod, { canViewPayments: true });

    expect(calls.tuition_collection_items).toContainEqual(["eq", ["period_id", "period-sep"]]);
    // Reissued items stay "issued" on a locked period: chains are resolved from reissued_from_item_id, not filtered on status.
    expect(calls.tuition_collection_items?.some(([method]) => method === "neq")).toBe(false);
    expect((calls.tuition_collection_items.find(([method]) => method === "select")?.[1] as string[])[0]).toMatch(/\bid, student_id, reissued_from_item_id\b/);
    // The roster is loadClassEnrollments': the reserved row's successor read runs, and the reserved student is still billed.
    expect(calls.student_enrollments).toContainEqual(["in", ["supersedes_enrollment_id", ["e-c"]]]);
    expect(calls.tuition_collection_items).toContainEqual(["in", ["student_id", ["a", "b", "c"]]]);
    // A line keeps billing a session rescheduled out of the period: class sessions are not bounded by their current date.
    expect(calls.class_sessions?.some(([method]) => method === "gte" || method === "lte")).toBe(false);
    expect(view?.paymentsVisible).toBe(true);
    expect(view?.rows).toEqual([
      {
        amountVnd: 400_000,
        blockers: [],
        fullName: "An",
        includesOtherCharges: true,
        itemAmountVnd: 900_000,
        openingBalanceSessions: null,
        payment: { expectedVnd: 900_000, paidVnd: 300_000, status: "partially_paid" },
        publicCode: "HS1",
        reissued: false,
        sessions: 2,
        studentId: "a",
      },
      {
        amountVnd: 200_000,
        blockers: [],
        fullName: "Bảo",
        includesOtherCharges: false,
        itemAmountVnd: 200_000,
        openingBalanceSessions: null,
        payment: { expectedVnd: 200_000, paidVnd: 200_000, status: "paid" },
        publicCode: "HS2",
        reissued: false,
        sessions: 1,
        studentId: "b",
      },
    ]);
  });

  it("does not select the payment request without payments.view", async () => {
    const calls = arrange();

    const view = await getClassTuitionView("class-1", lockedPeriod, { canViewPayments: false });

    const select = (calls.tuition_collection_items.find(([method]) => method === "select")?.[1] as string[])[0];
    expect(select).not.toContain("payment_request");
    expect(select).toContain("tuition_collection_item_lines");
    expect(view?.paymentsVisible).toBe(false);
  });

  it("returns null when the items read fails", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [{ id: "s1" }], error: null },
      student_enrollments: roster([enrolled("a", "An", "HS1")]),
      tuition_collection_items: { data: null, error: { message: "denied" } },
    });

    await expect(getClassTuitionView("class-1", lockedPeriod, { canViewPayments: true })).resolves.toBeNull();
  });

  // Value: protects=a reissued tuition item shows the replacement's amount and payment request but this class's split from the original's session lines (the replacement has none), and is flagged reissued;
  // fails_when=the original item's amount or old payment request is shown, the replacement (without lines) drops the student from the class, both items produce a row, or reissued stays false;
  // why_new=the review replaced the `.neq("status","reissued")` filter (reissued items keep status "issued" on a locked period) with resolveReissueChains;
  // seam=none; no_claim=does not prove reissue_tuition_collection_item leaves the original unchanged in the database
  it("takes amount and payment from the replacement and the class split from the original", async () => {
    tables({
      class_component_links: { data: [], error: null },
      class_sessions: { data: [{ id: "s1" }, { id: "s2" }], error: null },
      student_enrollments: roster([enrolled("a", "An", "HS1"), enrolled("b", "Bảo", "HS2")]),
      tuition_collection_items: {
        data: [
          // The replacement arrives first: order must not matter.
          item("item-a2", "a", {
            payable_amount_vnd: "350000",
            payment_request: { expected_amount_vnd: "350000", paid_amount_vnd: "0", status: "pending" },
            reissued_from_item_id: "item-a1",
          }),
          item("item-a1", "a", {
            lines: [line("s1", 200000), line("s2", 200000), line("other-class-session", 100000)],
            payable_amount_vnd: "500000",
            payment_request: { expected_amount_vnd: "500000", paid_amount_vnd: "0", status: "cancelled" },
          }),
          item("item-b", "b", { lines: [line("s1", 200000)], payable_amount_vnd: 200000 }),
        ],
        error: null,
      },
    });

    const view = await getClassTuitionView("class-1", lockedPeriod, { canViewPayments: true });

    expect(view?.rows.map((row) => [row.studentId, row.reissued])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(view?.rows[0]).toMatchObject({
      amountVnd: 400_000,
      includesOtherCharges: true,
      itemAmountVnd: 350_000,
      payment: { expectedVnd: 350_000, paidVnd: 0, status: "pending" },
      sessions: 2,
    });
  });
});

describe("resolveReissueChains", () => {
  // Value: protects=a chain of reissues resolves to its newest item (amount, payment) and its first item (lines), one pair per student, and a broken or cyclic chain never loops or drops the student;
  // fails_when=an intermediate item is treated as current, the walk stops one link short of the original, a replaced item yields its own pair, or a cycle hangs the loader;
  // why_new=resolveReissueChains is new and exported for this test;
  // seam=pure function; no_claim=does not prove the database allows a reissue of a reissue
  it("pairs the newest item with the first of its chain", () => {
    const pairs = resolveReissueChains([
      item("a3", "a", { reissued_from_item_id: "a2" }),
      item("a1", "a"),
      item("a2", "a", { reissued_from_item_id: "a1" }),
      item("b1", "b"),
      // The original was not returned (another student's chunk, or RLS): the replacement is its own original.
      item("c2", "c", { reissued_from_item_id: "c-missing" }),
    ]);

    expect(pairs.map(({ current, original }) => [current.id, original.id])).toEqual([
      ["a3", "a1"],
      ["b1", "b1"],
      ["c2", "c2"],
    ]);
  });

  it("stops on a cycle behind the current item instead of looping", () => {
    // z replaced x1; x1 and x2 point at each other (corrupt data): the walk ends at the last unseen item.
    const pairs = resolveReissueChains([item("z", "x", { reissued_from_item_id: "x1" }), item("x1", "x", { reissued_from_item_id: "x2" }), item("x2", "x", { reissued_from_item_id: "x1" })]);

    expect(pairs.map(({ current, original }) => [current.id, original.id])).toEqual([["z", "x2"]]);
  });
});

describe("getClassTuitionView draft period", () => {
  const preview = (studentId: string, unitPrice: number | string | null, overrides: Record<string, unknown> = {}) => ({
    acquisition_source_id: "source-1",
    blocker_code: null,
    opening_balance_sessions: 2,
    student_id: studentId,
    unit_price_vnd: unitPrice,
    ...overrides,
  });

  it("groups the class's preview rows per student, sums prices and collects blocker codes", async () => {
    tables({ student_enrollments: roster([enrolled("a", "An", "HS1"), enrolled("b", "Bảo", "HS2")]) });
    const calls = previewRpc({
      data: [
        preview("b", 200000),
        preview("a", "150000"),
        preview("a", "150000"),
        // No effective rate for one session, and no acquisition source: both block the lock.
        preview("b", null, { acquisition_source_id: null, blocker_code: "MISSING_PRIMARY_GUARDIAN", opening_balance_sessions: -1 }),
        preview("b", null, { acquisition_source_id: null }),
      ],
      error: null,
    });

    const view = await getClassTuitionView("class-1", draftPeriod, { canViewPayments: true });

    expect(supabase.rpc).toHaveBeenCalledWith("preview_tuition_collection_period", { p_period_id: "period-oct" });
    expect(calls).toContainEqual(["eq", ["class_id", "class-1"]]);
    expect(view?.paymentsVisible).toBe(false);
    expect(view?.rows).toEqual([
      {
        amountVnd: 300_000,
        blockers: [],
        fullName: "An",
        includesOtherCharges: false,
        itemAmountVnd: null,
        openingBalanceSessions: 2,
        payment: null,
        publicCode: "HS1",
        reissued: false,
        sessions: 2,
        studentId: "a",
      },
      {
        amountVnd: 200_000,
        blockers: ["MISSING_EFFECTIVE_TUITION_RATE", "MISSING_ACQUISITION_SOURCE", "MISSING_PRIMARY_GUARDIAN"],
        fullName: "Bảo",
        includesOtherCharges: false,
        itemAmountVnd: null,
        openingBalanceSessions: 2,
        payment: null,
        publicCode: "HS2",
        reissued: false,
        sessions: 3,
        studentId: "b",
      },
    ]);
  });

  it("returns null on a preview query error and does not read items", async () => {
    const calls = tables({ student_enrollments: roster([enrolled("a", "An", "HS1")]) });
    previewRpc({ data: null, error: { message: "denied" } });

    await expect(getClassTuitionView("class-1", draftPeriod, { canViewPayments: true })).resolves.toBeNull();
    expect(calls.tuition_collection_items).toBeUndefined();
  });

  it("returns null when the student read fails, even though the preview loaded", async () => {
    tables({ student_enrollments: { data: null, error: { message: "denied" } } });
    previewRpc({ data: [preview("a", 150000)], error: null });

    await expect(getClassTuitionView("class-1", draftPeriod, { canViewPayments: true })).resolves.toBeNull();
    // The student and preview reads run in parallel by design; the preview alone must not yield unnamed rows.
    expect(supabase.rpc).toHaveBeenCalledWith("preview_tuition_collection_period", { p_period_id: "period-oct" });
  });

  // Value: protects=a failed successor read of the class's reserved enrolments (it only decides a badge) still names every student in the tuition view;
  // fails_when=the successor read failure empties the view or falls back to unnamed "Học sinh" rows;
  // why_new=loadClassStudents reuses loadClassEnrollments, whose second read can fail on its own;
  // seam=none; no_claim=does not prove RLS lets the role read other classes' enrolments
  it("still names the students when the reserved rows' successor read fails", async () => {
    tables({
      student_enrollments: (own) =>
        own.some(([method, args]) => method === "in" && args[0] === "supersedes_enrollment_id")
          ? { data: null, error: { message: "denied" } }
          : { data: [enrolled("a", "An", "HS1", { status: "reserved" })], error: null },
    });
    previewRpc({ data: [preview("a", 150000)], error: null });

    const view = await getClassTuitionView("class-1", draftPeriod, { canViewPayments: true });
    expect(view?.rows.map((row) => [row.fullName, row.publicCode])).toEqual([["An", "HS1"]]);
  });
});

describe("tuition period reads", () => {
  const row = (id: string, status: string) => ({ due_on: null, ends_on: "2026-09-30", id, name: `Kỳ ${id}`, starts_on: "2026-09-01", status });
  const option = (id: string, status: "draft" | "locked") => ({ dueOn: null, endsOn: "2026-09-30", id, name: `Kỳ ${id}`, startsOn: "2026-09-01", status });

  // Value: protects=the tab's picker gets the newest periods mapped to its shape (any non-locked status is draft), and a failed read is null so the tab says it failed rather than "no period yet";
  // fails_when=a read error returns [] (empty-state copy instead of the failure banner), the newest-first order or the 24-period limit is dropped, or an unexpected status is shown as locked;
  // why_new=getClassTuitionPeriods/getClassTuitionPeriod were only mocked (route and action tests);
  // seam=none; no_claim=does not prove RLS on tuition_collection_periods or that "closed" is a real status (Supabase mocked; unit only)
  it("maps periods newest first, normalises status, and returns null on a failed read", async () => {
    let calls = tables({ tuition_collection_periods: { data: [row("oct", "draft"), row("sep", "locked"), row("aug", "closed")], error: null } });

    await expect(getClassTuitionPeriods()).resolves.toEqual([option("oct", "draft"), option("sep", "locked"), option("aug", "draft")]);
    expect(calls.tuition_collection_periods).toContainEqual(["order", ["starts_on", { ascending: false }]]);
    expect(calls.tuition_collection_periods).toContainEqual(["limit", [CLASS_TUITION_PERIOD_LIMIT]]);

    tables({ tuition_collection_periods: { data: null, error: { message: "denied" } } });
    await expect(getClassTuitionPeriods()).resolves.toBeNull();

    calls = tables({ tuition_collection_periods: { data: row("sep", "locked"), error: null } });
    await expect(getClassTuitionPeriod("sep")).resolves.toEqual(option("sep", "locked"));
    expect(calls.tuition_collection_periods).toContainEqual(["eq", ["id", "sep"]]);

    tables({ tuition_collection_periods: { data: null, error: null } });
    await expect(getClassTuitionPeriod("missing")).resolves.toBeNull();
    tables({ tuition_collection_periods: { data: null, error: { message: "denied" } } });
    await expect(getClassTuitionPeriod("sep")).resolves.toBeNull();
  });
});
