import { describe, expect, it } from "vitest";

import {
  buildDailyPayrollBreakdown,
  formatClockTime,
  getShiftPayBadge,
  getWeekdayLabel,
  isDatedLine,
} from "@/features/payroll/estimate/daily-breakdown";
import type { StaffEstimateLine, StaffMonthShift } from "@/features/payroll/estimate/types";
import { buildEstimateEndpoint } from "@/features/payroll/estimate/use-payroll-live-estimate";
import { staffPayrollEstimateSchema } from "@/features/payroll/estimate/types";

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
  checkOutAt: `${overrides.workDate}T10:00:00Z`,
  isPendingVerification: false,
  status: "checked_out",
  workedMinutes: 540,
  workMode: "offline",
  ...overrides,
});

describe("buildDailyPayrollBreakdown", () => {
  const estimate = {
    lines: [
      // Base lines link to their time entry (sourceId = shift id), as get_staff_payroll_estimate returns them.
      line({ amountVnd: 300000, lineType: "base_offline", sourceId: "a0000000-0000-4000-8000-000000000001", sourceKind: "time_entry", workDate: "2026-10-02", workedMinutes: 540 }),
      line({ amountVnd: 75000, lineType: "base_online", sourceId: "a0000000-0000-4000-8000-000000000002", sourceKind: "time_entry", workDate: "2026-10-03", workedMinutes: 270 }),
      line({ amountVnd: 50000, lineType: "teaching_allowance", sourceId: "f1", sourceKind: "payroll_source_fact", workDate: "2026-10-03" }),
      line({ amountVnd: 120000, lineType: "grading_bonus", sourceId: "pool", sourceKind: "grading_pool", workDate: "2026-10-01" }),
      line({ amountVnd: 185741, direction: "deduction", lineType: "piecework_offset", sourceId: "floor", sourceKind: "piecework_floor", workDate: "2026-10-01" }),
      line({ amountVnd: 20000, lineType: "manual_reward", note: "Thưởng tháng", sourceId: "m1", sourceKind: "manual_adjustment", workDate: "2026-10-01" }),
    ],
    month: "2026-10-01",
    shifts: [
      shift({ id: "a0000000-0000-4000-8000-000000000001", workDate: "2026-10-02" }),
      shift({ id: "a0000000-0000-4000-8000-000000000002", workDate: "2026-10-03", workMode: "online", workedMinutes: 270 }),
      shift({ checkOutAt: null, id: "a0000000-0000-4000-8000-000000000003", status: "open", workDate: "2026-10-10", workedMinutes: 0 }),
      shift({ id: "a0000000-0000-4000-8000-000000000004", isPendingVerification: true, workDate: "2026-10-09", workedMinutes: 120 }),
    ],
  };

  it("lists every day of the month in order", () => {
    const breakdown = buildDailyPayrollBreakdown(estimate, { today: "2026-10-10" });

    expect(breakdown.days).toHaveLength(31);
    expect(breakdown.days[0].workDate).toBe("2026-10-01");
    expect(breakdown.days[30].workDate).toBe("2026-10-31");
    expect(breakdown.days[0].weekday).toBe(4); // 01/10/2026 là thứ Năm
    expect(breakdown.days.filter((day) => day.isToday).map((day) => day.workDate)).toEqual(["2026-10-10"]);
    expect(breakdown.days[10].isFuture).toBe(true);
    expect(breakdown.days[9].isFuture).toBe(false);
  });

  it("handles February of a leap year", () => {
    const breakdown = buildDailyPayrollBreakdown({ lines: [], month: "2028-02-01", shifts: [] }, { today: "2028-02-10" });
    expect(breakdown.days).toHaveLength(29);
  });

  it("attributes dated lines and shifts to their day", () => {
    const breakdown = buildDailyPayrollBreakdown(estimate, { today: "2026-10-10" });
    const second = breakdown.days.find((day) => day.workDate === "2026-10-02")!;
    const third = breakdown.days.find((day) => day.workDate === "2026-10-03")!;

    expect(second.baseSalaryVnd).toBe(300000);
    expect(second.workedMinutes).toBe(540);
    expect(second.totalVnd).toBe(300000);
    expect(second.shifts).toHaveLength(1);

    expect(third.baseSalaryVnd).toBe(75000);
    expect(third.allowanceVnd).toBe(50000);
    expect(third.totalVnd).toBe(125000);
    expect(third.workedMinutes).toBe(270);
  });

  it("marks open shifts without counting their minutes, and leaves an unpaid unverified shift out of pay", () => {
    const breakdown = buildDailyPayrollBreakdown(estimate, { today: "2026-10-10" });
    const today = breakdown.days.find((day) => day.workDate === "2026-10-10")!;
    const ninth = breakdown.days.find((day) => day.workDate === "2026-10-09")!;

    expect(today.hasOpenShift).toBe(true);
    expect(today.workedMinutes).toBe(0);
    expect(today.totalVnd).toBe(0);
    // The 09/10 shift is unverified and has no base pay line: not "tính tạm".
    expect(ninth.pendingVerificationCount).toBe(0);
    expect(ninth.unverifiedUnpaidCount).toBe(1);
    expect(ninth.workedMinutes).toBe(0);
    expect(ninth.shifts[0].payState).toBe("unverified_unpaid");
  });

  it("separates monthly items and reconciles to the payable total", () => {
    const breakdown = buildDailyPayrollBreakdown(estimate, { today: "2026-10-10" });

    expect(breakdown.monthlyItems.map((item) => item.lineType)).toEqual([
      "grading_bonus",
      "piecework_offset",
      "manual_reward",
    ]);
    expect(breakdown.monthlyEarningsVnd).toBe(140000);
    expect(breakdown.monthlyDeductionsVnd).toBe(185741);
    expect(breakdown.monthlyNetVnd).toBe(-45741);
    expect(breakdown.dailyTotalVnd).toBe(425000);
    expect(breakdown.grandTotalVnd).toBe(425000 - 45741);
    expect(breakdown.activeDayCount).toBe(4); // 02, 03, 09 và ngày có ca đang mở 10
    expect(breakdown.totalWorkedMinutes).toBe(540 + 270);
  });

  it("treats lines without a dated source as monthly even when they carry a date", () => {
    expect(isDatedLine({ sourceKind: "time_entry", workDate: "2026-10-02" })).toBe(true);
    expect(isDatedLine({ sourceKind: "payroll_source_fact", workDate: "2026-10-02" })).toBe(true);
    expect(isDatedLine({ sourceKind: "salary_advance", workDate: "2026-10-01" })).toBe(false);
    expect(isDatedLine({ sourceKind: null, workDate: "2026-10-01" })).toBe(false);
    expect(isDatedLine({ sourceKind: "time_entry", workDate: null })).toBe(false);
  });

  it("ignores shifts and lines outside the month", () => {
    const breakdown = buildDailyPayrollBreakdown(
      {
        lines: [line({ amountVnd: 1000, lineType: "base_offline", sourceKind: "time_entry", workDate: "2026-09-30" })],
        month: "2026-10-01",
        shifts: [shift({ id: "a0000000-0000-4000-8000-000000000009", workDate: "2026-11-01" })],
      },
      { today: "2026-10-10" },
    );

    expect(breakdown.dailyTotalVnd).toBe(0);
    expect(breakdown.monthlyItems).toHaveLength(1);
    expect(breakdown.days.every((day) => day.shifts.length === 0)).toBe(true);
  });
});

// Value: protects=a shift reads "pending, counted provisionally" only when a base pay line for that time entry is flagged pending (the RPC pays unverified work only with a pending attendance exception, and never in an approved period); its minutes then count, an unverified shift without a paid line does not, and an online-only day shows no daily rate;
// fails_when=every unverified shift is counted as "tính tạm" again, an approved month shows provisional shifts, a paid shift's minutes are dropped, or the online line's full offline rate is shown as the day's rate;
// why_new=review pass 2 (fixes 1 and 5): the ledger claimed every unverified shift was paid provisionally and took the day rate from base_online lines;
// seam=pure function over fixtures shaped like get_staff_payroll_estimate (line.sourceId = time entry id); no_claim=does not prove the RPC sets isPendingVerification on lines (migration 20260929154500 does)
describe("buildDailyPayrollBreakdown pay state per shift", () => {
  const provisionalId = "b0000000-0000-4000-8000-000000000001";
  const unpaidId = "b0000000-0000-4000-8000-000000000002";
  const onlineId = "b0000000-0000-4000-8000-000000000003";
  const input = {
    lines: [
      line({ amountVnd: 160000, isPendingVerification: true, lineType: "base_offline", sourceId: provisionalId, sourceKind: "time_entry", unitRateVnd: 720000, workDate: "2026-10-05", workedMinutes: 120 }),
      line({ amountVnd: 60000, isPendingVerification: false, lineType: "base_online", sourceId: onlineId, sourceKind: "time_entry", unitRateVnd: 720000, workDate: "2026-10-07", workedMinutes: 90 }),
    ],
    month: "2026-10-01",
    shifts: [
      shift({ id: provisionalId, isPendingVerification: true, workDate: "2026-10-05", workedMinutes: 120 }),
      shift({ id: unpaidId, isPendingVerification: true, workDate: "2026-10-05", workedMinutes: 60 }),
      shift({ id: onlineId, workDate: "2026-10-07", workMode: "online", workedMinutes: 90 }),
    ],
  };

  it("counts only the provisionally paid shift as pending and its minutes as paid", () => {
    const fifth = buildDailyPayrollBreakdown(input, { today: "2026-10-10" }).days.find((day) => day.workDate === "2026-10-05")!;
    expect(fifth.shifts.map((item) => item.payState)).toEqual(["provisional", "unverified_unpaid"]);
    expect(fifth.pendingVerificationCount).toBe(1);
    expect(fifth.unverifiedUnpaidCount).toBe(1);
    expect(fifth.workedMinutes).toBe(120);
  });

  it("never marks a shift provisional in an approved month", () => {
    const fifth = buildDailyPayrollBreakdown({ ...input, status: "approved" }, { today: "2026-10-10" }).days.find((day) => day.workDate === "2026-10-05")!;
    expect(fifth.pendingVerificationCount).toBe(0);
    expect(fifth.shifts[0].payState).toBe("counted");
  });

  it("takes the day rate from offline lines only", () => {
    const breakdown = buildDailyPayrollBreakdown(input, { today: "2026-10-10" });
    expect(breakdown.days.find((day) => day.workDate === "2026-10-07")?.dailyRateVnd).toBeNull();
    expect(breakdown.days.find((day) => day.workDate === "2026-10-05")?.dailyRateVnd).toBe(720000);
  });
});

// Value: protects=in an estimated month a closed, verified shift counts as paid only when a base pay line links to it, otherwise it reads "Chưa tính" with "thiếu đơn giá" when the day has a missing-rate issue (a missing position never withholds base pay) and adds no minutes to "đã tính tiền"; an approved month never infers "not in pay" (frozen lines may lack source keys), and a 0-minute verified shift is not flagged;
// fails_when=a verified shift with no base line is counted again in an estimated month, an approved month marks paid shifts as left out, the reason ignores the day's issue, or a 0-minute shift is flagged;
// why_new=review pass 3 (fix 1): getShiftPayState returned "verified" for every verified closed shift, whatever the lines said;
// seam=pure function over fixtures shaped like get_staff_payroll_estimate (line.sourceId = time entry id); no_claim=does not prove which shifts the RPC leaves without a base line (migration 20260929154500 owns that)
describe("buildDailyPayrollBreakdown verified shift without a base line", () => {
  const paidId = "c0000000-0000-4000-8000-000000000001";
  const missingId = "c0000000-0000-4000-8000-000000000002";
  const zeroId = "c0000000-0000-4000-8000-000000000003";
  const input = {
    lines: [
      line({ amountVnd: 160000, lineType: "base_offline", sourceId: paidId, sourceKind: "time_entry", unitRateVnd: 720000, workDate: "2026-10-05", workedMinutes: 120 }),
    ],
    month: "2026-10-01",
    shifts: [
      shift({ id: paidId, workDate: "2026-10-05", workedMinutes: 120 }),
      shift({ id: missingId, workDate: "2026-10-05", workedMinutes: 90 }),
      shift({ id: zeroId, workDate: "2026-10-06", workedMinutes: 0 }),
    ],
  };

  it("never infers a not-in-pay shift in an approved month", () => {
    // Frozen approved lines can lack source keys (older periods), so a verified
    // shift is not reported as left out of approved pay.
    const breakdown = buildDailyPayrollBreakdown({ ...input, status: "approved" }, { today: "2026-10-10" });
    const fifth = breakdown.days.find((day) => day.workDate === "2026-10-05")!;
    expect(fifth.shifts.map((item) => item.payState)).toEqual(["verified", "verified"]);
    expect(fifth.notInPayCount).toBe(0);
  });

  it("reads an estimated verified shift without a base line as not paid, with the day's reason", () => {
    const breakdown = buildDailyPayrollBreakdown(input, { today: "2026-10-10" });
    const fifth = breakdown.days.find((day) => day.workDate === "2026-10-05")!;
    expect(fifth.shifts[1].payState).toBe("not_in_pay");
    expect(fifth.shifts[1].notInPayReason).toBeNull();
    expect(fifth.workedMinutes).toBe(120);
    expect(getShiftPayBadge("not_in_pay", { isApproved: false })).toEqual({ label: "Chưa tính", tone: "neutral" });

    const withIssue = buildDailyPayrollBreakdown(
      { ...input, issues: [{ details: { work_date: "2026-10-05" }, issueCode: "missing_daily_rate" }] },
      { today: "2026-10-10" },
    );
    const shift5 = withIssue.days.find((day) => day.workDate === "2026-10-05")!.shifts[1];
    expect(shift5.notInPayReason).toBe("missing_daily_rate");
    expect(getShiftPayBadge("not_in_pay", { isApproved: false, notInPayReason: "missing_daily_rate" })).toEqual({ label: "Chưa tính · thiếu đơn giá", tone: "neutral" });
    // A missing payroll position does not withhold base pay (only the daily rate does): no reason from it.
    const positionOnly = buildDailyPayrollBreakdown(
      { ...input, issues: [{ details: { work_date: "2026-10-05" }, issueCode: "missing_payroll_position" }] },
      { today: "2026-10-10" },
    );
    expect(positionOnly.days.find((day) => day.workDate === "2026-10-05")!.shifts[1].notInPayReason).toBeNull();
  });

  it("does not flag a 0-minute verified shift", () => {
    const withLines = buildDailyPayrollBreakdown(input, { today: "2026-10-10" });
    const sixth = withLines.days.find((day) => day.workDate === "2026-10-06")!;
    expect(sixth.shifts[0].payState).toBe("verified");
    expect(sixth.notInPayCount).toBe(0);
  });

  // Value: protects=a staff member with no daily rate (the estimate returns no base lines, lines: []) has shifts marked not paid and no "đã tính tiền" minutes; fails_when=an empty lines array is treated as a legacy payload and every verified shift reads "Đã xác minh" with its minutes counted; why_new=adversarial review found the legacy guard hid exactly the missing-rate case; seam=none; no_claim=does not prove the RPC returns lines: [] for that staff (base_salary_lines requires offline_daily_rate_vnd, migration 20260929154500)
  it("treats an estimate with no lines as nothing paid (missing daily rate)", () => {
    const noRate = buildDailyPayrollBreakdown({ ...input, lines: [] }, { today: "2026-10-10" });
    const fifth = noRate.days.find((day) => day.workDate === "2026-10-05")!;
    expect(fifth.shifts.map((item) => item.payState)).toEqual(["not_in_pay", "not_in_pay"]);
    expect(fifth.notInPayCount).toBe(2);
    expect(fifth.workedMinutes).toBe(0);
  });
});

describe("daily breakdown helpers", () => {
  it("labels weekdays in Vietnamese", () => {
    expect(getWeekdayLabel(0)).toBe("CN");
    expect(getWeekdayLabel(1)).toBe("T2");
    expect(getWeekdayLabel(6)).toBe("T7");
  });

  it("formats clock time in Vietnam timezone", () => {
    expect(formatClockTime("2026-10-02T01:05:00Z")).toBe("08:05");
    expect(formatClockTime(null)).toBe("--:--");
  });
});

describe("staffPayrollEstimateSchema with daily fields", () => {
  const base = {
    asOf: "2026-10-10T10:00:00Z",
    calculatedAt: "2026-10-10T10:00:00Z",
    month: "2026-10-01",
  };

  it("keeps workDate / sourceKind on lines and parses shifts", () => {
    const parsed = staffPayrollEstimateSchema.parse({
      ...base,
      lines: [
        {
          amountVnd: 300000,
          direction: "earning",
          lineType: "base_offline",
          sourceId: "10000000-0000-4000-8000-000000000001",
          sourceKind: "time_entry",
          workDate: "2026-10-02",
          workedMinutes: 540,
        },
      ],
      shifts: [
        {
          checkInAt: "2026-10-02T01:00:00Z",
          checkOutAt: "2026-10-02T10:00:00Z",
          id: "10000000-0000-4000-8000-000000000001",
          isPendingVerification: false,
          status: "checked_out",
          workDate: "2026-10-02",
          workedMinutes: 540,
          workMode: "offline",
        },
      ],
      staffDisplayName: "Trợ lý hai",
      staffId: "00000000-0000-4000-8000-000000000002",
    });

    expect(parsed.lines[0].workDate).toBe("2026-10-02");
    expect(parsed.lines[0].sourceKind).toBe("time_entry");
    expect(parsed.shifts).toHaveLength(1);
    expect(parsed.staffDisplayName).toBe("Trợ lý hai");
  });

  it("still accepts legacy payloads without shifts", () => {
    const parsed = staffPayrollEstimateSchema.parse({
      ...base,
      lines: [{ amountVnd: 1, direction: "earning", lineType: "base_offline" }],
    });

    expect(parsed.shifts).toEqual([]);
    expect(parsed.lines[0].workDate).toBeUndefined();
  });
});

describe("buildEstimateEndpoint", () => {
  it("routes staff, staff-by-id and owner scopes", () => {
    expect(buildEstimateEndpoint({ month: "2026-10-01", scope: "staff" })).toBe("/api/payroll/estimate?month=2026-10-01");
    expect(
      buildEstimateEndpoint({ month: "2026-10-01", scope: "staff", staffId: "00000000-0000-4000-8000-000000000002" }),
    ).toBe("/api/payroll/staff-estimate?month=2026-10-01&staffId=00000000-0000-4000-8000-000000000002");
    expect(buildEstimateEndpoint({ month: "2026-10-01", positionCode: "teaching_assistant", scope: "owner" })).toBe(
      "/api/payroll/owner-estimate?month=2026-10-01&position=teaching_assistant",
    );
  });
});
