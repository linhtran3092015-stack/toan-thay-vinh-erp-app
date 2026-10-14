// Value: protects=the tuition period list/page totals (phải thu, đã thu, còn lại, quá hạn), the derived status beside the real draft|locked badge, the chip counts, draft lock readiness and the stepper's current step;
// fails_when=a reissued student is counted twice or with the original's request, a cancelled or expired request still counts as payable or owed, the due date itself counts as overdue, hidden payments leak into totals, a fully collected period is not "Hoàn tất" or a period with nothing collected (all cancelled/expired) or unreadable requests is, a payable row without a readable request counts as "nothing to pay" or the collecting/overdue label hides unknown requests, the payment-read permission rule drifts from the RLS policy, chip counts disagree with the rows, an empty or failed draft preview looks lockable, or the stepper marks a step current that is not (draft → 1, locked and owed or voided → 4, nothing owed and something collected → none);
// why_new=step 7a added period-summary.ts, getTuitionLockReadiness and buildTuitionPeriodSteps with no prior coverage;
// seam=pure functions only; no_claim=does not prove what the loaders read from Supabase (tuition-period-summary-data.test.ts) or how the components render it
import { describe, expect, it } from "vitest";

import { buildTuitionPeriodSteps } from "@/features/finance/components/period-stepper";
import type { TuitionPreviewRow } from "@/features/tuition/data";
import {
  canReadTuitionPayments,
  countTuitionItemFilters,
  getTuitionItemPaymentState,
  getTuitionPeriodProgress,
  isTuitionRequestInForce,
  matchesTuitionItemFilter,
  summarizeTuitionPeriodRows,
  toCurrentTuitionItemRows,
  type TuitionPeriodItemQueryRow,
} from "@/features/tuition/period-summary";
import { getTuitionLockReadiness } from "@/features/tuition/readiness";

function item(id: string, studentId: string, overrides: Partial<TuitionPeriodItemQueryRow> = {}): TuitionPeriodItemQueryRow {
  return {
    id,
    payable_amount_vnd: "1000000",
    payable_sessions: 5,
    payment_request: { expected_amount_vnd: "1000000", paid_amount_vnd: "0", status: "pending" },
    period_id: "period",
    reissued_from_item_id: null,
    student_id: studentId,
    student_snapshot: { class_name: "Toán 9A", current_grade: 9, full_name: `HS ${studentId}`, public_code: `TTV-${studentId}` },
    ...overrides,
  };
}

const request = (status: string, expected: number, paid: number) => ({ expected_amount_vnd: expected, paid_amount_vnd: paid, status });

describe("toCurrentTuitionItemRows", () => {
  it("keeps one row per student: the replacement's amount and request, the original's snapshot when the replacement has none", () => {
    const rows = toCurrentTuitionItemRows([
      item("a1", "a", { payment_request: request("cancelled", 1_000_000, 0) }),
      item("a2", "a", { payable_amount_vnd: 800_000, payment_request: [request("partially_paid", 800_000, 300_000)], reissued_from_item_id: "a1", student_snapshot: null }),
      item("b1", "b", { payment_request: request("mystery", 1_000_000, 0) }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      className: "Toán 9A",
      grade: 9,
      itemId: "a2",
      originalItemId: "a1",
      payableAmountVnd: 800_000,
      payment: { expectedVnd: 800_000, paidVnd: 300_000, status: "partially_paid" },
      publicCode: "TTV-a",
      reissued: true,
      studentName: "HS a",
    });
    // An unknown status is kept and marked unknown (never "nothing to pay", never a chip bucket).
    expect(rows[1].payment?.status).toBeNull();
    expect(getTuitionItemPaymentState(rows[1])).toBe("unknown");
  });
});

describe("summarizeTuitionPeriodRows", () => {
  const rows = toCurrentTuitionItemRows([
    item("p", "p", { payment_request: request("paid", 1_000_000, 1_200_000) }),
    item("q", "q", { payment_request: request("partially_paid", 1_000_000, 400_000) }),
    item("r", "r", { payment_request: request("pending", 2_000_000, 0) }),
    item("s", "s", { payment_request: request("cancelled", 5_000_000, 0) }),
    item("t", "t", { payment_request: request("expired", 7_000_000, 0) }),
    item("u", "u", { payable_amount_vnd: 0, payment_request: null }),
    // Reissued: only the replacement counts.
    item("v1", "v", { payment_request: request("cancelled", 3_000_000, 0) }),
    item("v2", "v", { payment_request: request("pending", 1_500_000, 0), reissued_from_item_id: "v1" }),
  ]);

  it("excludes cancelled and expired requests, caps an overpayment at what was asked and counts each student once", () => {
    const summary = summarizeTuitionPeriodRows(rows, { dueOn: "2026-10-15", paymentsVisible: true, today: "2026-10-14" });

    expect(summary).toMatchObject({
      collectedVnd: 1_400_000,
      counts: { closed: 2, none: 1, paid: 1, partial: 1, unpaid: 2 },
      isPastDue: false,
      overdueStudents: 0,
      overdueVnd: 0,
      payableVnd: 5_500_000,
      remainingVnd: 4_100_000,
      studentCount: 7,
    });
    expect(summary.collectedPercent).toBe(25);
    expect(getTuitionPeriodProgress(summary)).toEqual({ kind: "collecting", label: "thu 25%", percent: 25 });
  });

  it("is not overdue on the due date itself, and is the day after", () => {
    const onDueDate = summarizeTuitionPeriodRows(rows, { dueOn: "2026-10-15", paymentsVisible: true, today: "2026-10-15" });
    const dayAfter = summarizeTuitionPeriodRows(rows, { dueOn: "2026-10-15", paymentsVisible: true, today: "2026-10-16" });
    const noDueDate = summarizeTuitionPeriodRows(rows, { dueOn: null, paymentsVisible: true, today: "2027-01-01" });

    expect(onDueDate.isPastDue).toBe(false);
    expect(dayAfter).toMatchObject({ isPastDue: true, overdueStudents: 3, overdueVnd: 4_100_000 });
    expect(getTuitionPeriodProgress(dayAfter)).toMatchObject({ kind: "overdue", label: "Quá hạn · 3 HS" });
    expect(noDueDate.isPastDue).toBe(false);
  });

  it("reports Hoàn tất when nothing remains, and nothing derived when payments are hidden", () => {
    const settled = toCurrentTuitionItemRows([item("p", "p", { payment_request: request("paid", 1_000_000, 1_000_000) }), item("x", "x", { payment_request: request("cancelled", 1, 0) })]);
    const done = summarizeTuitionPeriodRows(settled, { dueOn: "2026-09-15", paymentsVisible: true, today: "2026-10-14" });
    expect(getTuitionPeriodProgress(done)).toEqual({ kind: "complete", label: "Hoàn tất" });

    // Nothing owed because nothing is in force: not a completed collection.
    const voided = summarizeTuitionPeriodRows(
      toCurrentTuitionItemRows([item("x", "x", { payment_request: request("cancelled", 1, 0) }), item("y", "y", { payment_request: request("expired", 1, 0) })]),
      { dueOn: "2026-09-15", paymentsVisible: true, today: "2026-10-14" },
    );
    expect(voided).toMatchObject({ collectedVnd: 0, remainingVnd: 0 });
    expect(getTuitionPeriodProgress(voided)).toEqual({ kind: "inactive", label: "Không còn yêu cầu hiệu lực" });

    // A payable row whose request could not be read (or has an unknown status) is unknown, not "nothing to pay":
    // it is counted, left out of the amounts, and blocks "Hoàn tất".
    const unreadable = toCurrentTuitionItemRows([
      item("p", "p", { payment_request: request("paid", 1_000_000, 1_000_000) }),
      item("q", "q", { payable_amount_vnd: 900_000, payment_request: null }),
      item("r", "r", { payment_request: request("mystery", 500_000, 0) }),
      item("n", "n", { payable_amount_vnd: 0, payment_request: null }),
    ]);
    expect(unreadable.map(getTuitionItemPaymentState)).toEqual(["none", "paid", "unknown", "unknown"]); // rows are sorted by name: n, p, q, r
    const partlyKnown = summarizeTuitionPeriodRows(unreadable, { dueOn: "2026-09-15", paymentsVisible: true, today: "2026-10-14" });
    expect(partlyKnown).toMatchObject({ collectedVnd: 1_000_000, counts: { none: 1, paid: 1, unknown: 2 }, payableVnd: 1_000_000, remainingVnd: 0, studentCount: 4 });
    expect(getTuitionPeriodProgress(partlyKnown)).toEqual({ kind: "unknown", label: "Chưa rõ 2 yêu cầu" });
    expect(countTuitionItemFilters(unreadable)).toEqual({ all: 4, closed: 0, paid: 1, partial: 0, unpaid: 0 });

    // While money is owed, the percentage covers readable requests only: the label says how many are unknown.
    const owedAndUnknown = toCurrentTuitionItemRows([...[
      item("p", "p", { payment_request: request("paid", 1_000_000, 1_000_000) }),
      item("u", "u", { payment_request: request("pending", 1_000_000, 0) }),
      item("q", "q", { payable_amount_vnd: 900_000, payment_request: null }),
    ]]);
    const collecting = summarizeTuitionPeriodRows(owedAndUnknown, { dueOn: "2026-10-15", paymentsVisible: true, today: "2026-10-14" });
    expect(getTuitionPeriodProgress(collecting)).toEqual({ kind: "collecting", label: "thu 50% · chưa rõ 1", percent: 50 });
    const overdue = summarizeTuitionPeriodRows(owedAndUnknown, { dueOn: "2026-10-15", paymentsVisible: true, today: "2026-10-16" });
    expect(getTuitionPeriodProgress(overdue)).toMatchObject({ kind: "overdue", label: "Quá hạn · 1 HS · chưa rõ 1" });

    const hidden = summarizeTuitionPeriodRows(
      toCurrentTuitionItemRows([item("h", "h", { payable_amount_vnd: 900_000, payment_request: undefined }), item("k", "k", { payable_amount_vnd: 100_000, payment_request: undefined })]),
      { dueOn: "2026-09-15", paymentsVisible: false, today: "2026-10-14" },
    );
    expect(hidden).toMatchObject({ collectedPercent: null, collectedVnd: 0, payableVnd: 1_000_000, remainingVnd: 0, studentCount: 2 });
    expect(getTuitionPeriodProgress(hidden)).toEqual({ kind: "hidden" });
  });

  // Generated by /ship test coverage audit (Claude) — 2026-10-14
  // Value: protects=the collected % floors, so a period with money still owed never reads "thu 100%" and a sliver collected never reads more than collected;
  // fails_when=Math.floor becomes Math.round/ceil or the ratio uses the uncapped paid amount; why_new=the 25% case above is 25.45%, identical under floor and round;
  // seam=none; no_claim=does not prove how the list draws the progress bar
  it("floors the collected percent: 99.95% owed is still thu 99%, and an overpayment never lifts it", () => {
    const almost = summarizeTuitionPeriodRows(
      toCurrentTuitionItemRows([item("a", "a", { payment_request: request("partially_paid", 2_000_000, 1_999_000) })]),
      { dueOn: null, paymentsVisible: true, today: "2026-10-14" },
    );
    expect(almost).toMatchObject({ collectedPercent: 99, remainingVnd: 1_000 });
    expect(getTuitionPeriodProgress(almost)).toEqual({ kind: "collecting", label: "thu 99%", percent: 99 });

    const overpaidOne = summarizeTuitionPeriodRows(
      toCurrentTuitionItemRows([
        item("p", "p", { payment_request: request("paid", 1_000_000, 3_000_000) }),
        item("q", "q", { payment_request: request("pending", 1_000_000, 0) }),
      ]),
      { dueOn: null, paymentsVisible: true, today: "2026-10-14" },
    );
    expect(overpaidOne).toMatchObject({ collectedPercent: 50, collectedVnd: 1_000_000, payableVnd: 2_000_000 });
  });

  it("counts chips from the same buckets the filter uses", () => {
    const counts = countTuitionItemFilters(rows);
    expect(counts).toEqual({ all: 7, closed: 2, paid: 1, partial: 1, unpaid: 2 });
    for (const filter of ["paid", "partial", "unpaid", "closed"] as const) {
      expect(rows.filter((row) => matchesTuitionItemFilter(row, filter))).toHaveLength(counts[filter]);
    }
    expect(rows.filter((row) => matchesTuitionItemFilter(row, "all"))).toHaveLength(7);
  });
});

describe("getTuitionLockReadiness (draft periods)", () => {
  const row = (studentId: string, overrides: Partial<TuitionPreviewRow> = {}): TuitionPreviewRow => ({
    acquisitionSourceId: "source",
    blockerCode: null,
    classId: "class",
    classSessionId: `${studentId}-${Math.random()}`,
    enrollmentId: "enrollment",
    openingBalanceSessions: 0,
    sessionDate: "2026-11-02",
    sessionKind: "regular",
    studentId,
    unitPriceVnd: 200_000,
    ...overrides,
  });

  it("counts students per missing field and only prices a period without missing rates", () => {
    const blocked = getTuitionLockReadiness(
      [row("a", { unitPriceVnd: null }), row("a"), row("b", { acquisitionSourceId: null }), row("c", { blockerCode: "MISSING_PRIMARY_GUARDIAN" }), row("d", { blockerCode: "SOMETHING_ELSE" })],
      [],
    );
    expect(blocked).toMatchObject({ estimatedTotalVnd: null, hasBlockers: true, missingGuardians: 1, missingRates: 1, missingSources: 1, otherIssues: 1, sessionCount: 5, studentCount: 4, unmetCount: 4 });

    const ready = getTuitionLockReadiness([row("a"), row("a"), row("b")], []);
    expect(ready).toMatchObject({ estimatedTotalVnd: 600_000, hasBlockers: false, unmetCount: 0 });
  });

  it("never treats an empty or failed preview as lockable", () => {
    expect(getTuitionLockReadiness([], [])).toMatchObject({ hasBlockers: true, isEmpty: true, unmetCount: 1 });
    const failed = getTuitionLockReadiness([], [{ code: "PREVIEW_UNAVAILABLE", message: "x" }]);
    expect(failed).toMatchObject({ estimatedTotalVnd: null, hasBlockers: true, isEmpty: false, previewUnavailable: true });
  });
});

describe("buildTuitionPeriodSteps", () => {
  const current = (steps: ReturnType<typeof buildTuitionPeriodSteps>) => steps.findIndex((step) => step.state === "current") + 1;

  it("draft → step 1, the rest upcoming", () => {
    const steps = buildTuitionPeriodSteps({ counts: null, itemCount: 0, requestCount: 0, status: "draft" });
    expect(steps.map((step) => step.state)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(steps[1].title).toBe("Khóa kỳ · tạo yêu cầu thanh toán");
  });

  it("locked with money owed (or unreadable) → step 4 with the review link; nothing owed → every step done", () => {
    const owed = buildTuitionPeriodSteps({ counts: { paid: 3, partial: 1, unpaid: 2 }, itemCount: 7, requestCount: 6, reviewHref: "/finance/sepay?queue=review", status: "locked" });
    expect(current(owed)).toBe(4);
    expect(owed[3]).toMatchObject({ description: "3 đã thanh toán · 1 thanh toán một phần · 2 chờ thanh toán", link: { href: "/finance/sepay?queue=review" } });

    expect(current(buildTuitionPeriodSteps({ counts: null, itemCount: 7, requestCount: 6, status: "locked" }))).toBe(4);

    const settled = buildTuitionPeriodSteps({ counts: { paid: 6, partial: 0, unpaid: 0 }, itemCount: 7, requestCount: 6, reviewHref: "/finance/sepay?queue=review", status: "locked" });
    expect(settled.every((step) => step.state === "done")).toBe(true);
    expect(settled[3].link).toBeUndefined();
  });

  it("uses the Hoàn tất rule: nothing owed but nothing collected (all cancelled/expired) stays on step 4", () => {
    const voided = buildTuitionPeriodSteps({ collectedVnd: 0, counts: { paid: 0, partial: 0, unpaid: 0 }, itemCount: 2, requestCount: 2, status: "locked" });
    expect(current(voided)).toBe(4);
    expect(voided[3].description).toBe("Không còn yêu cầu hiệu lực");

    // Unreadable requests keep step 4 open (they may be owed) and are named.
    const unknown = buildTuitionPeriodSteps({ collectedVnd: 1_000_000, counts: { paid: 1, partial: 0, unknown: 2, unpaid: 0 }, itemCount: 3, requestCount: 3, status: "locked" });
    expect(current(unknown)).toBe(4);
    expect(unknown[3].description).toBe("1 đã thanh toán · 0 thanh toán một phần · 0 chờ thanh toán · 2 chưa rõ");

    // Either signal completes it, as in getTuitionPeriodProgress: a paid request or a collected amount.
    const collected = buildTuitionPeriodSteps({ collectedVnd: 500_000, counts: { paid: 0, partial: 0, unpaid: 0 }, itemCount: 1, requestCount: 1, status: "locked" });
    expect(collected.every((step) => step.state === "done")).toBe(true);
  });
});

describe("payment rules shared with the routes and the dashboard", () => {
  it("reads payment requests with the RLS permissions only, and counts only requests in force", () => {
    expect(canReadTuitionPayments(["tuition_periods.view", "sepay.view"])).toBe(false);
    for (const code of ["finance.view", "payments.view", "payments.manage"]) expect(canReadTuitionPayments([code])).toBe(true);

    expect(["pending", "partially_paid", "paid"].every(isTuitionRequestInForce)).toBe(true);
    expect(["cancelled", "expired", "mystery", null, undefined].some(isTuitionRequestInForce)).toBe(false);
  });
});
