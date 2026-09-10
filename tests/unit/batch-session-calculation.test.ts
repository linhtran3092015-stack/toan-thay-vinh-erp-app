import { describe, expect, it } from "vitest";
import {
  calculateBatchOccurrences,
  formatUtcDate,
  getIsoWeekday,
  parseDateUtc,
} from "@/features/sessions/batch-calculation";

describe("batch-session-calculation", () => {
  it("correctly identifies ISO weekday and formats UTC date", () => {
    // 2026-09-14 is Monday (Thứ Hai) -> ISO weekday 1
    const monday = parseDateUtc("2026-09-14");
    expect(getIsoWeekday(monday)).toBe(1);
    expect(formatUtcDate(monday)).toBe("2026-09-14");

    // 2026-09-20 is Sunday (Chủ Nhật) -> ISO weekday 7
    const sunday = parseDateUtc("2026-09-20");
    expect(getIsoWeekday(sunday)).toBe(7);
    expect(formatUtcDate(sunday)).toBe("2026-09-20");
  });

  it("calculates sessions by count mode", () => {
    // Slots: Monday (1) and Thursday (4) from 18:00 to 19:30
    const slots = [
      {
        scheduleTemplateId: "tmpl-mon",
        weekday: 1,
        startTime: "18:00:00",
        endTime: "19:30:00",
        learningMode: "offline" as const,
        roomName: "P.201",
      },
      {
        scheduleTemplateId: "tmpl-thu",
        weekday: 4,
        startTime: "18:00:00",
        endTime: "19:30:00",
        learningMode: "offline" as const,
        roomName: "P.201",
      },
    ];

    // Starting Monday 2026-09-14, request 4 sessions
    const results = calculateBatchOccurrences({
      startDate: "2026-09-14",
      rangeMode: "count",
      count: 4,
      slots,
      namingPattern: "Buổi {n}",
      startNumber: 1,
      today: "2026-09-10",
    });

    expect(results).toHaveLength(4);
    // Session 1: Mon 2026-09-14
    expect(results[0].sessionDate).toBe("2026-09-14");
    expect(results[0].weekday).toBe(1);
    expect(results[0].weekdayLabel).toBe("Thứ Hai");
    expect(results[0].notes).toBe("Buổi 1");
    expect(results[0].sessionKind).toBe("regular");
    expect(results[0].scheduleTemplateId).toBe("tmpl-mon");
    expect(results[0].selected).toBe(true);
    expect(results[0].statusConflict).toBe("none");

    // Session 2: Thu 2026-09-17
    expect(results[1].sessionDate).toBe("2026-09-17");
    expect(results[1].weekday).toBe(4);
    expect(results[1].weekdayLabel).toBe("Thứ Năm");
    expect(results[1].notes).toBe("Buổi 2");

    // Session 3: Mon 2026-09-21
    expect(results[2].sessionDate).toBe("2026-09-21");
    expect(results[2].notes).toBe("Buổi 3");

    // Session 4: Thu 2026-09-24
    expect(results[3].sessionDate).toBe("2026-09-24");
    expect(results[3].notes).toBe("Buổi 4");
  });

  it("calculates sessions by date_range mode", () => {
    // Slot: Wednesday (3)
    const slots = [
      {
        weekday: 3,
        startTime: "17:30",
        endTime: "19:00",
        learningMode: "online" as const,
        meetingUrl: "https://classin.com/room123",
      },
    ];

    // 2026-09-01 to 2026-09-30 (September 2026)
    // Wednesdays in Sep 2026: 2, 9, 16, 23, 30 -> 5 sessions
    const results = calculateBatchOccurrences({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      rangeMode: "date_range",
      slots,
      namingPattern: "Toán 10 - Tiết {n}",
      startNumber: 10,
      today: "2026-09-01",
    });

    expect(results).toHaveLength(5);
    expect(results.map((r) => r.sessionDate)).toEqual([
      "2026-09-02",
      "2026-09-09",
      "2026-09-16",
      "2026-09-23",
      "2026-09-30",
    ]);
    expect(results[0].notes).toBe("Toán 10 - Tiết 10");
    expect(results[4].notes).toBe("Toán 10 - Tiết 14");
    expect(results[0].sessionKind).toBe("additional"); // No template ID
  });

  it("detects duplicates against existing sessions and auto-unchecks them", () => {
    const slots = [
      {
        scheduleTemplateId: "tmpl-1",
        weekday: 2, // Tuesday
        startTime: "18:00",
        endTime: "20:00",
        learningMode: "offline" as const,
      },
    ];

    const existingSessions = [
      {
        sessionDate: "2026-09-15", // Tuesday
        startTime: "18:00:00",
        endTime: "20:00:00",
        scheduleTemplateId: "tmpl-1",
      },
    ];

    const results = calculateBatchOccurrences({
      startDate: "2026-09-15",
      rangeMode: "count",
      count: 2,
      slots,
      existingSessions,
      today: "2026-09-10",
    });

    expect(results).toHaveLength(2);
    // First session: 2026-09-15 matches existing session
    expect(results[0].sessionDate).toBe("2026-09-15");
    expect(results[0].statusConflict).toBe("duplicate");
    expect(results[0].selected).toBe(false); // Unchecked!

    // Second session: 2026-09-22 does not match
    expect(results[1].sessionDate).toBe("2026-09-22");
    expect(results[1].statusConflict).toBe("none");
    expect(results[1].selected).toBe(true);
  });

  it("flags past dates properly", () => {
    const slots = [
      {
        weekday: 5, // Friday
        startTime: "19:00",
        endTime: "21:00",
        learningMode: "offline" as const,
      },
    ];

    const results = calculateBatchOccurrences({
      startDate: "2026-09-04",
      rangeMode: "count",
      count: 2,
      slots,
      today: "2026-09-10", // 2026-09-04 is before today, 2026-09-11 is after
    });

    expect(results[0].sessionDate).toBe("2026-09-04");
    expect(results[0].statusConflict).toBe("past");
    expect(results[0].selected).toBe(true); // Kept selected unless duplicate

    expect(results[1].sessionDate).toBe("2026-09-11");
    expect(results[1].statusConflict).toBe("none");
  });
});
