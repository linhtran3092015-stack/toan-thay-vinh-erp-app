// Value: protects=the draft period's per-student "Phải thu", "Không cần thanh toán" and "yêu cầu khi khóa" figures, which must equal what lock_tuition_collection_period (migration 20261012130100:148-178) bills from the same preview rows;
// fails_when=the opening credit offsets the cheapest or latest sessions instead of the earliest (session_date, then class_session_id), a same-date tie breaks differently from Postgres uuid order, a negative balance is shown as exact or not charged at the earliest row's rate, a missing rate that the lock needs is summed as 0, a missing rate inside the offset sessions blocks an otherwise exact amount, no-payment is not exactly B ≥ N, the per-code counts are added up as "Còn blocker", or the summarizeTuitionPreview fields drift;
// why_new=step 13 (design 15a) shows lock-time figures on the draft page; no client helper reproduced the lock formula before;
// seam=pure functions over TuitionPreviewRow fixtures; no_claim=does not prove the RPC itself (tests/database) or the debit already billed on other periods' pending notices, which the preview does not return (hence the upper bound)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { TuitionPreviewRow } from "@/features/tuition/data";
import { summarizeTuitionPreview } from "@/features/tuition/readiness";
import {
  buildReadinessStudents,
  compareLockOrder,
  computeLockFigures,
  summarizeReadinessStudents,
} from "@/features/tuition/readiness-students";

let sequence = 0;
function row(overrides: Partial<TuitionPreviewRow> = {}): TuitionPreviewRow {
  sequence += 1;
  return {
    acquisitionSourceId: "source",
    blockerCode: null,
    classId: "class-a",
    classSessionId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    enrollmentId: "enrollment",
    openingBalanceSessions: 0,
    sessionDate: "2026-11-02",
    sessionKind: "regular",
    studentId: "s1",
    unitPriceVnd: 200_000,
    ...overrides,
  };
}

describe("computeLockFigures (mirror of lock_tuition_collection_period)", () => {
  it("bills nothing and creates no request when the balance covers every session (B ≥ N), even with a missing rate", () => {
    const rows = [row({ openingBalanceSessions: 2 }), row({ openingBalanceSessions: 2, sessionDate: "2026-11-05", unitPriceVnd: null })];

    expect(computeLockFigures(rows)).toMatchObject({ noPayment: true, openingBalanceSessions: 2, payable: { amountVnd: 0, kind: "exact" } });
    expect(computeLockFigures(rows.map((item) => ({ ...item, openingBalanceSessions: 1 }))).noPayment).toBe(false);
  });

  it("offsets the earliest sessions first, not the cheapest, across two rates", () => {
    // Input in loader order (student_id, class_session_id), not date order.
    const rows = [
      row({ sessionDate: "2026-11-09", unitPriceVnd: 200_000 }),
      row({ sessionDate: "2026-11-02", unitPriceVnd: 250_000 }),
      row({ sessionDate: "2026-11-05", unitPriceVnd: 200_000 }),
    ].map((item) => ({ ...item, openingBalanceSessions: 1 }));

    const figures = computeLockFigures(rows);
    // The 02/11 session at 250.000 is free; 05/11 and 09/11 are billed.
    expect(figures.payable).toEqual({ amountVnd: 400_000, kind: "exact" });
    expect(figures.rates).toEqual([250_000, 200_000]);
    expect(figures.noPayment).toBe(false);
  });

  it("breaks a same-date tie by class_session_id like Postgres uuid order", () => {
    const late = row({ classSessionId: "b0000000-0000-4000-8000-000000000001", openingBalanceSessions: 1, unitPriceVnd: 200_000 });
    const early = row({ classSessionId: "A0000000-0000-4000-8000-000000000001", openingBalanceSessions: 1, unitPriceVnd: 250_000 });

    expect(compareLockOrder(early, late)).toBeLessThan(0);
    expect(computeLockFigures([late, early]).payable).toEqual({ amountVnd: 200_000, kind: "exact" });
    expect(computeLockFigures([early, late]).payable).toEqual({ amountVnd: 200_000, kind: "exact" });
  });

  it("charges a negative balance at the earliest row's rate and labels it an upper bound", () => {
    const rows = [
      row({ classId: "class-b", sessionDate: "2026-11-03", unitPriceVnd: 250_000 }),
      row({ sessionDate: "2026-11-02", unitPriceVnd: 200_000 }),
    ].map((item) => ({ ...item, openingBalanceSessions: -2 }));

    expect(computeLockFigures(rows)).toEqual({
      classIds: ["class-a", "class-b"],
      noPayment: false,
      openingBalanceSessions: -2,
      payable: { amountVnd: 200_000 + 250_000 + 2 * 200_000, kind: "upper_bound" },
      rates: [200_000, 250_000],
    });
  });

  it("is unknown when a billed session has no rate, exact when only an offset one lacks it", () => {
    expect(computeLockFigures([row(), row({ sessionDate: "2026-11-05", unitPriceVnd: null })]).payable).toEqual({ kind: "unknown" });
    expect(computeLockFigures([row({ openingBalanceSessions: -1, unitPriceVnd: null }), row({ openingBalanceSessions: -1, sessionDate: "2026-11-05" })]).payable).toEqual({ kind: "unknown" });

    const offsetMissing = [row({ unitPriceVnd: null }), row({ sessionDate: "2026-11-05" })].map((item) => ({ ...item, openingBalanceSessions: 1 }));
    expect(computeLockFigures(offsetMissing).payable).toEqual({ amountVnd: 200_000, kind: "exact" });
  });

  it("uses the smallest opening balance like the lock's min()", () => {
    const rows = [row({ openingBalanceSessions: 3 }), row({ openingBalanceSessions: 1, sessionDate: "2026-11-05" }), row({ openingBalanceSessions: 3, sessionDate: "2026-11-09" })];

    expect(computeLockFigures(rows)).toMatchObject({ openingBalanceSessions: 1, payable: { amountVnd: 400_000, kind: "exact" } });
  });
});

describe("buildReadinessStudents and summarizeReadinessStudents", () => {
  const rows: TuitionPreviewRow[] = [
    // s1: ready, exact 400.000
    row({ studentId: "s1" }),
    row({ sessionDate: "2026-11-05", studentId: "s1" }),
    // s2: covered by its balance
    row({ openingBalanceSessions: 4, studentId: "s2" }),
    // s3: owes one session, two classes
    row({ openingBalanceSessions: -1, studentId: "s3" }),
    row({ classId: "class-b", openingBalanceSessions: -1, sessionDate: "2026-11-04", studentId: "s3", unitPriceVnd: 250_000 }),
    // s4: missing rate and source (two codes, one blocked student)
    row({ acquisitionSourceId: null, studentId: "s4", unitPriceVnd: null }),
    // s5: missing guardian only
    row({ blockerCode: "MISSING_PRIMARY_GUARDIAN", studentId: "s5" }),
  ];

  it("keeps the summarizeTuitionPreview fields and adds the lock figures", () => {
    const students = buildReadinessStudents(rows);

    expect(students.map(({ issues, missingRateFrom, sessions, studentId }) => ({ issues, missingRateFrom, sessions, studentId }))).toEqual(summarizeTuitionPreview(rows));
    expect(students.find((student) => student.studentId === "s3")).toMatchObject({
      classIds: ["class-a", "class-b"],
      payable: { amountVnd: 650_000, kind: "upper_bound" },
      rates: [200_000, 250_000],
    });
    expect(students.find((student) => student.studentId === "s2")).toMatchObject({ noPayment: true, payable: { amountVnd: 0, kind: "exact" } });
  });

  it("counts distinct blocked students, no-payment, requests at lock and the payable split", () => {
    expect(summarizeReadinessStudents(buildReadinessStudents(rows))).toEqual({
      blocked: 2,
      hasFigures: true,
      noPayment: 1,
      // 400.000 + 650.000 (upper bound) + 200.000 (s5); s4 unknown, s2 nothing.
      payableVnd: 1_250_000,
      ready: 3,
      requestsAtLock: 4,
      total: 5,
      unknown: 1,
      upperBound: 1,
    });
  });

  it("reports missing figures for bare summarizeTuitionPreview output", () => {
    const totals = summarizeReadinessStudents(summarizeTuitionPreview(rows));

    expect(totals).toMatchObject({ blocked: 2, hasFigures: false, noPayment: 0, ready: 3, requestsAtLock: 0, total: 5, unknown: 0 });
  });
});

describe("lock formula mirror", () => {
  // When this fails, a newer migration redefines the lock: re-read its billing loop, update
  // computeLockFigures (and the migration cited in readiness-students.ts), then this file name.
  it("still mirrors the newest migration that defines lock_tuition_collection_period", () => {
    const directory = join(process.cwd(), "supabase", "migrations");
    const definitions = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .filter((file) => /create\s+or\s+replace\s+function\s+public\.lock_tuition_collection_period\b/i.test(readFileSync(join(directory, file), "utf8")));

    expect(definitions.at(-1)).toBe("20261012130100_tuition_period_cutoff_balance_and_overlap.sql");
  });
});
