import { describe, expect, it } from "vitest";

import {
  buildDailyPayrollBreakdown,
  formatClockTime,
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
      line({ amountVnd: 300000, lineType: "base_offline", sourceId: "s1", sourceKind: "time_entry", workDate: "2026-10-02", workedMinutes: 540 }),
      line({ amountVnd: 75000, lineType: "base_online", sourceId: "s2", sourceKind: "time_entry", workDate: "2026-10-03", workedMinutes: 270 }),
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

  it("marks open shifts without counting their minutes, and counts pending verification", () => {
    const breakdown = buildDailyPayrollBreakdown(estimate, { today: "2026-10-10" });
    const today = breakdown.days.find((day) => day.workDate === "2026-10-10")!;
    const ninth = breakdown.days.find((day) => day.workDate === "2026-10-09")!;

    expect(today.hasOpenShift).toBe(true);
    expect(today.workedMinutes).toBe(0);
    expect(today.totalVnd).toBe(0);
    expect(ninth.pendingVerificationCount).toBe(1);
    expect(ninth.workedMinutes).toBe(120);
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
    expect(breakdown.totalWorkedMinutes).toBe(540 + 270 + 120);
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
