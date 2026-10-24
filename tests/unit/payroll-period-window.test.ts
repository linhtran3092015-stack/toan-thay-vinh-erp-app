import { describe, expect, it } from "vitest";

import {
  getOlderPayrollPeriodsLink,
  getPayrollReturnHref,
  getPayslipHref,
  MAX_PAYROLL_PERIOD_COUNT,
  parsePayrollPeriodCount,
  parsePayrollPeriodId,
  RECENT_PAYROLL_PERIOD_COUNT,
} from "@/features/payroll/period-window";

describe("payroll period window", () => {
  // Value: protects=a hand-edited ?periods= never asks the RPC for fewer than the default or more than it accepts (it raises outside 1–60);
  // fails_when=the parser passes 0, a negative, a huge or a non-numeric value through, treats a 4-digit count differently from a 3-digit one, or reads the second of repeated params;
  // why_new=/payroll now reads a bounded window of periods;
  // seam=none (pure function); no_claim=does not prove the RPC's own range check (pgTAP does)
  it("clamps ?periods= to the readable range", () => {
    expect(parsePayrollPeriodCount(undefined)).toBe(RECENT_PAYROLL_PERIOD_COUNT);
    expect(parsePayrollPeriodCount("6")).toBe(6);
    expect(parsePayrollPeriodCount(["9", "60"])).toBe(9);
    expect(parsePayrollPeriodCount("1")).toBe(RECENT_PAYROLL_PERIOD_COUNT);
    expect(parsePayrollPeriodCount("999")).toBe(MAX_PAYROLL_PERIOD_COUNT);
    expect(parsePayrollPeriodCount("1000")).toBe(MAX_PAYROLL_PERIOD_COUNT);
    expect(parsePayrollPeriodCount("-3")).toBe(RECENT_PAYROLL_PERIOD_COUNT);
    expect(parsePayrollPeriodCount("6abc")).toBe(RECENT_PAYROLL_PERIOD_COUNT);
  });

  it("links to the next batch of older periods, never past what exists or the cap", () => {
    expect(getOlderPayrollPeriodsLink(3, 5)).toEqual({ addedCount: 3, href: "/payroll?periods=6" });
    expect(getOlderPayrollPeriodsLink(6, 2)).toEqual({ addedCount: 2, href: "/payroll?periods=8" });
    expect(getOlderPayrollPeriodsLink(3, 0)).toBeNull();
    expect(getOlderPayrollPeriodsLink(MAX_PAYROLL_PERIOD_COUNT, 4)).toBeNull();
    // A linked period stays on screen while older ones load.
    expect(getOlderPayrollPeriodsLink(3, 5, "b2000000-0000-4000-8000-000000202609")).toEqual({
      addedCount: 3,
      href: "/payroll?periods=6&period=b2000000-0000-4000-8000-000000202609",
    });
  });

  it("accepts only a uuid in ?period=", () => {
    expect(parsePayrollPeriodId("b2000000-0000-4000-8000-000000202609")).toBe("b2000000-0000-4000-8000-000000202609");
    expect(parsePayrollPeriodId(["b2000000-0000-4000-8000-000000202609", "x"])).toBe("b2000000-0000-4000-8000-000000202609");
    expect(parsePayrollPeriodId("period-9")).toBeNull();
    expect(parsePayrollPeriodId(undefined)).toBeNull();
  });

  // Value: protects=a payslip opened from an expanded /payroll window links back to that window with its own period loaded and anchored;
  // fails_when=the payslip link drops ?periods=, the back link omits ?period= (an older period disappears) or the anchor, or the default window gains a redundant ?periods=3;
  // why_new=the payslip back link went to bare /payroll, which shows only recent and open periods;
  // seam=none (pure function); no_claim=does not prove /payroll reads these params (payroll-route.test does)
  it("carries the /payroll window to the payslip and back", () => {
    expect(getPayslipHref("p1", "s1")).toBe("/payroll/p1/statements/s1/payslip");
    expect(getPayslipHref("p1", "s1", 9)).toBe("/payroll/p1/statements/s1/payslip?periods=9");
    expect(getPayrollReturnHref("p1")).toBe("/payroll?period=p1#payroll-period-p1");
    expect(getPayrollReturnHref("p1", 9)).toBe("/payroll?periods=9&period=p1#payroll-period-p1");
  });
});
