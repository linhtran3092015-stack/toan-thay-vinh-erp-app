// Value: protects=the per-staff ledger helpers (design 8b): the daily rate shown in the header and per day comes from the base pay lines and is null (never 0) when there are none, and the pending-verification banner takes its count from the statement and names only closed shifts awaiting verification;
// fails_when=getOfflineDailyRate invents a rate, a day's rate is taken from a non-base line, an open shift is named as pending, or the count stops matching the provisionally paid shifts;
// why_new=step 8 adds these helpers for the ledger header, rate column and warning banner;
// seam=pure functions over fixtures shaped like get_staff_payroll_estimate; no_claim=does not prove the ledger renders them (payroll-ledger covers that)
import { describe, expect, it } from "vitest";

import {
  buildDailyPayrollBreakdown,
  formatDayMonth,
  getOfflineDailyRate,
  getPendingVerificationSummary,
} from "@/features/payroll/estimate/daily-breakdown";
import type { StaffEstimateLine, StaffMonthShift } from "@/features/payroll/estimate/types";

const line = (overrides: Partial<StaffEstimateLine> & Pick<StaffEstimateLine, "lineType" | "amountVnd">): StaffEstimateLine => ({
  direction: "earning",
  note: null,
  policyCode: null,
  unitLabel: null,
  unitRateVnd: null,
  workedMinutes: null,
  ...overrides,
});

const shift = (overrides: Partial<StaffMonthShift> & Pick<StaffMonthShift, "id" | "workDate">): StaffMonthShift => ({
  checkInAt: `${overrides.workDate}T01:00:00Z`,
  checkOutAt: `${overrides.workDate}T03:00:00Z`,
  isPendingVerification: false,
  status: "checked_out",
  workedMinutes: 120,
  workMode: "offline",
  ...overrides,
});

describe("ledger helpers", () => {
  it("reads the offline daily rate from base pay lines only", () => {
    expect(getOfflineDailyRate([line({ amountVnd: 50_000, lineType: "teaching_allowance", unitRateVnd: 50_000 })])?.latestRateVnd).toBeUndefined();
    expect(getOfflineDailyRate([
      line({ amountVnd: 80_000, lineType: "base_online", unitRateVnd: 720_000 }),
      line({ amountVnd: 160_000, lineType: "base_offline", unitRateVnd: 720_000 }),
    ])?.latestRateVnd).toBe(720_000);
  });

  // Value: protects=the ledger header rate is the offline rate of the latest work date (projection lines are not date-ordered) and says when the month had more than one rate;
  // fails_when=the first line's (older) rate is shown after a mid-month rate change, or several rates in the month read as one without "(mới nhất)";
  // why_new=review pass 2 (fix 6): the rate helper took the first base_offline line;
  // seam=none; no_claim=does not prove the header renders the flag (payroll-ledger covers that)
  it("picks the offline rate of the latest work date and flags several rates", () => {
    const lines = [
      line({ amountVnd: 1, lineType: "base_offline", unitRateVnd: 800_000, workDate: "2026-10-20" }),
      line({ amountVnd: 1, lineType: "base_offline", unitRateVnd: 720_000, workDate: "2026-10-02" }),
      line({ amountVnd: 1, lineType: "base_online", unitRateVnd: 900_000, workDate: "2026-10-25" }),
    ];
    expect(getOfflineDailyRate(lines)).toEqual({ hasMultipleRates: true, latestRateVnd: 800_000 });
    expect(getOfflineDailyRate(lines)?.latestRateVnd).toBe(800_000);
    expect(getOfflineDailyRate([lines[1]])).toEqual({ hasMultipleRates: false, latestRateVnd: 720_000 });
    expect(getOfflineDailyRate([lines[2]])).toBeNull();
  });

  it("sets each day's rate from that day's base line", () => {
    const breakdown = buildDailyPayrollBreakdown({
      lines: [
        line({ amountVnd: 160_000, lineType: "base_offline", sourceKind: "time_entry", unitRateVnd: 720_000, workDate: "2026-10-02" }),
        line({ amountVnd: 50_000, lineType: "teaching_allowance", sourceKind: "payroll_source_fact", unitRateVnd: 50_000, workDate: "2026-10-03" }),
      ],
      month: "2026-10-01",
      shifts: [],
    }, { today: "2026-10-10" });

    expect(breakdown.days.find((day) => day.workDate === "2026-10-02")?.dailyRateVnd).toBe(720_000);
    expect(breakdown.days.find((day) => day.workDate === "2026-10-03")?.dailyRateVnd).toBeNull();
  });

  // Value: protects=the pending-verification count is the number of closed shifts paid provisionally (a base line for that time entry flagged pending) and those are the shifts named; the statement count is used only for an old payload with no shift list, because it also counts unverified shifts that get no pay (0 minutes, no rate);
  // fails_when=the count follows statement.pendingVerificationCount while the shift list is present (banner says "tính tạm" for unpaid shifts), an open, unflagged or unpaid unverified shift is named, or an old payload loses its count;
  // why_new=review pass 3 (fix 2): the count came from the statement, which counts every pending time entry; review pass 2 (fix 1): unpaid unverified shifts were named as "tính tạm";
  // seam=none; no_claim=does not prove the banner hides for approved months (payroll-ledger covers that)
  it("counts and names only provisionally paid shifts, falling back to the statement without shifts", () => {
    const shifts = [
      shift({ id: "a0000000-0000-4000-8000-000000000002", isPendingVerification: true, workDate: "2026-10-08" }),
      shift({ id: "a0000000-0000-4000-8000-000000000001", isPendingVerification: true, workDate: "2026-10-03" }),
      shift({ id: "a0000000-0000-4000-8000-000000000004", workDate: "2026-10-05" }),
      shift({ checkOutAt: null, id: "a0000000-0000-4000-8000-000000000003", isPendingVerification: true, status: "open", workDate: "2026-10-12" }),
      // Unverified but not paid (no pending exception): not "tính tạm".
      shift({ id: "a0000000-0000-4000-8000-000000000005", isPendingVerification: true, workDate: "2026-10-06" }),
    ];
    const lines = ["a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002", "a0000000-0000-4000-8000-000000000003"].map((sourceId) =>
      line({ amountVnd: 100_000, isPendingVerification: true, lineType: "base_offline", sourceId, sourceKind: "time_entry" }),
    );

    const withoutStatement = getPendingVerificationSummary({ lines, shifts, statement: null });
    expect(withoutStatement.count).toBe(2);
    expect(withoutStatement.shifts.map((item) => item.workDate)).toEqual(["2026-10-03", "2026-10-08"]);

    // The statement also counts the unpaid unverified shift (and any 0-minute one): not used when shifts exist.
    const higherStatement = getPendingVerificationSummary({ lines, shifts, statement: { pendingVerificationCount: 3 } as never });
    expect(higherStatement.count).toBe(2);

    const fromStatement = getPendingVerificationSummary({ lines: [], shifts: [], statement: { pendingVerificationCount: 3 } as never });
    expect(fromStatement).toEqual({ count: 3, shifts: [] });
    expect(formatDayMonth("2026-10-08")).toBe("08/10");
  });
});
