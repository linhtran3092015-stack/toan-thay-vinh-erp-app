import { describe, expect, it, vi } from "vitest";

import { parsePayrollDashboardMonth, parsePayrollDashboardPosition } from "@/features/payroll/dashboard/url-state";

describe("owner payroll dashboard URL state", () => {
  it("normalizes a valid selected month to the database month-start date", () => {
    expect(parsePayrollDashboardMonth("2026-08")).toBe("2026-08-01");
    expect(parsePayrollDashboardMonth(["2026-07", "2026-06"])).toBe("2026-07-01");
  });

  it("falls back to the current Ho Chi Minh City month for invalid input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T18:30:00.000Z"));
    expect(parsePayrollDashboardMonth("2026-13")).toBe("2026-09-01");
    expect(parsePayrollDashboardMonth(undefined)).toBe("2026-09-01");
    vi.useRealTimers();
  });

  it("accepts dynamic position codes and rejects empty or oversized values", () => {
    expect(parsePayrollDashboardPosition("teaching_assistant")).toBe("teaching_assistant");
    expect(parsePayrollDashboardPosition("  custom_position  ")).toBe("custom_position");
    expect(parsePayrollDashboardPosition(" ")).toBeNull();
    expect(parsePayrollDashboardPosition("x".repeat(81))).toBeNull();
  });
});
