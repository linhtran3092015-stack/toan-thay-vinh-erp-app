// Value: protects=the class tuition tab's default period, outstanding amounts and totals;
// fails_when=the tab opens on a period that is not the current one, a cancelled or expired request still counts as owed, or totals mix up the class share with the whole ticket;
// why_new=step 5b part 2 introduced these pure helpers with no prior coverage;
// seam=pure functions only; no_claim=does not prove what the tuition loader reads
import { describe, expect, it } from "vitest";

import {
  getPaymentRemaining,
  pickDefaultTuitionPeriod,
  summarizeClassTuition,
  type ClassTuitionPeriodOption,
  type ClassTuitionRow,
  type ClassTuitionView,
} from "@/features/classes/detail/class-tuition-models";

const period = (id: string, startsOn: string, endsOn: string, status: "draft" | "locked" = "locked"): ClassTuitionPeriodOption => ({
  dueOn: null,
  endsOn,
  id,
  name: id,
  startsOn,
  status,
});

describe("pickDefaultTuitionPeriod", () => {
  // Newest first, as the loader returns them.
  const periods = [
    period("nov", "2026-11-01", "2026-11-30", "draft"),
    period("oct", "2026-10-01", "2026-10-31", "draft"),
    period("sep", "2026-09-01", "2026-09-30"),
  ];

  it("opens on the period covering today", () => {
    expect(pickDefaultTuitionPeriod(periods, "2026-10-14")?.id).toBe("oct");
    expect(pickDefaultTuitionPeriod(periods, "2026-10-31")?.id).toBe("oct");
  });

  it("falls back to the latest period that already started, then the earliest upcoming", () => {
    // A gap between periods: the latest started one wins.
    expect(pickDefaultTuitionPeriod([period("nov", "2026-11-01", "2026-11-30"), period("sep", "2026-09-01", "2026-09-30")], "2026-10-14")?.id).toBe("sep");
    // Nothing has started: the earliest upcoming (last in a newest-first list).
    expect(pickDefaultTuitionPeriod(periods, "2026-08-01")?.id).toBe("sep");
  });

  it("returns null without periods", () => {
    expect(pickDefaultTuitionPeriod([], "2026-10-14")).toBeNull();
  });
});

describe("getPaymentRemaining", () => {
  it("owes only for pending and partially paid requests", () => {
    expect(getPaymentRemaining(null)).toBe(0);
    expect(getPaymentRemaining({ expectedVnd: 1_000_000, paidVnd: 0, status: "pending" })).toBe(1_000_000);
    expect(getPaymentRemaining({ expectedVnd: 1_000_000, paidVnd: 400_000, status: "partially_paid" })).toBe(600_000);
    expect(getPaymentRemaining({ expectedVnd: 1_000_000, paidVnd: 0, status: "cancelled" })).toBe(0);
    expect(getPaymentRemaining({ expectedVnd: 1_000_000, paidVnd: 0, status: "expired" })).toBe(0);
    expect(getPaymentRemaining({ expectedVnd: 1_000_000, paidVnd: 1_000_000, status: "paid" })).toBe(0);
  });

  it("never goes negative on an overpaid request", () => {
    expect(getPaymentRemaining({ expectedVnd: 1_000_000, paidVnd: 1_200_000, status: "partially_paid" })).toBe(0);
  });
});

describe("summarizeClassTuition", () => {
  const row = (overrides: Partial<ClassTuitionRow> & Pick<ClassTuitionRow, "studentId">): ClassTuitionRow => ({
    amountVnd: 0,
    blockers: [],
    fullName: overrides.studentId,
    includesOtherCharges: false,
    itemAmountVnd: null,
    openingBalanceSessions: null,
    payment: null,
    publicCode: null,
    sessions: 0,
    ...overrides,
  });

  it("totals the class's sessions and amounts and the payment columns", () => {
    const view: ClassTuitionView = {
      paymentsVisible: true,
      period: period("sep", "2026-09-01", "2026-09-30"),
      rows: [
        row({ amountVnd: 800_000, payment: { expectedVnd: 1_200_000, paidVnd: 200_000, status: "partially_paid" }, sessions: 4, studentId: "a" }),
        row({ amountVnd: 600_000, payment: { expectedVnd: 600_000, paidVnd: 600_000, status: "paid" }, sessions: 3, studentId: "b" }),
        row({ amountVnd: 400_000, payment: { expectedVnd: 400_000, paidVnd: 0, status: "cancelled" }, sessions: 2, studentId: "c" }),
        row({ amountVnd: 200_000, sessions: 1, studentId: "d" }),
      ],
    };

    expect(summarizeClassTuition(view)).toEqual({ amountVnd: 2_000_000, remainingVnd: 1_000_000, sessions: 10, studentCount: 4 });
  });

  // Value: protects="Học sinh có buổi tính phí" counts only students actually charged sessions in this class: a row whose sessions were all covered by opening credit (0 sessions) is not counted;
  // fails_when=studentCount goes back to counting every row, so the metric includes students with nothing to pay for this class;
  // why_new=the review changed studentCount from rows.length to rows with sessions > 0;
  // seam=pure function; no_claim=does not prove the loader emits zero-session rows
  it("counts only students with chargeable sessions", () => {
    const view: ClassTuitionView = {
      paymentsVisible: false,
      period: period("sep", "2026-09-01", "2026-09-30"),
      rows: [row({ amountVnd: 400_000, sessions: 2, studentId: "a" }), row({ sessions: 0, studentId: "b" }), row({ amountVnd: 200_000, sessions: 1, studentId: "c" })],
    };

    expect(summarizeClassTuition(view)).toMatchObject({ amountVnd: 600_000, sessions: 3, studentCount: 2 });
  });

  it("is all zeros for an empty period", () => {
    expect(summarizeClassTuition({ paymentsVisible: false, period: period("sep", "2026-09-01", "2026-09-30"), rows: [] })).toEqual({
      amountVnd: 0,
      remainingVnd: 0,
      sessions: 0,
      studentCount: 0,
    });
  });
});
