import { describe, expect, it, vi, afterEach } from "vitest";
import { addScheduleDays, getScheduleWeek, resolveScheduleWeek, weeklyAssignmentSchema } from "@/features/timekeeping/weekly-schedule";

afterEach(() => vi.useRealTimers());
describe("weekly schedule dates", () => {
  it("uses Monday through Sunday across months and years", () => {
    expect(getScheduleWeek("2027-01-03")).toBe("2026-12-28");
    expect(getScheduleWeek("2027-01-04")).toBe("2027-01-04");
    expect(addScheduleDays("2026-12-28", 6)).toBe("2027-01-03");
    expect(getScheduleWeek("2024-02-29")).toBe("2024-02-26");
  });
  it("falls back to Vietnam's current week on malformed or repeated query parameters", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-13T18:00:00Z"));
    for (const input of [undefined, "2026-02-30", "garbage", ["2026-09-07"], "0000-01-01"]) {
      expect(resolveScheduleWeek(input)).toBe("2026-09-14");
    }
  });
  it("rejects invalid dates without throwing from safeParse and enforces Monday", () => {
    const input = { weekStart: "2026-09-14", weekday: 2, staffId: "11111111-1111-4111-8111-111111111111", workShiftId: null, expectedAssignmentId: null, expectedUpdatedAt: null, reason: "Đổi lịch" };
    expect(weeklyAssignmentSchema.safeParse(input).success).toBe(true);
    for (const date of ["invalid", "2026-02-30", "2026-09-15", "0000-01-01"]) {
      expect(weeklyAssignmentSchema.safeParse({ ...input, weekStart: date }).success).toBe(false);
    }
    expect(weeklyAssignmentSchema.safeParse({ ...input, reason: " " }).success).toBe(false);
  });
});
