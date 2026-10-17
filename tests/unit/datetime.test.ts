import { describe, expect, it } from "vitest";

import { formatShortDate, formatShortDateTime, formatWeekdayDate, getVietnamTime, getVietnamToday } from "@/lib/datetime";
import { normalizeSearchText } from "@/lib/search";

// Value: protects=Vietnam wall-clock time used to drop today's ended sessions from "Buổi tới", and the short weekday date on the KPI tile; fails_when=the hour cycle emits 24:00:00 or the UTC offset is lost, or the year option changes the default format; why_new=no datetime unit test existed; seam=none; no_claim=PostgREST time comparison (covered by the query, not here)
describe("Vietnam date/time helpers", () => {
  it("returns HH:MM:SS in Asia/Ho_Chi_Minh with a 0-23 hour cycle", () => {
    expect(getVietnamTime(new Date("2026-10-12T17:00:00Z"))).toBe("00:00:00");
    expect(getVietnamTime(new Date("2026-10-12T16:59:59Z"))).toBe("23:59:59");
    expect(getVietnamTime(new Date("2026-10-12T12:30:05Z"))).toBe("19:30:05");
    expect(getVietnamToday(new Date("2026-10-12T17:00:00Z"))).toBe("2026-10-13");
  });

  it("formats a weekday date with or without the year", () => {
    expect(formatWeekdayDate("2026-10-14")).toBe("Thứ 4, 14/10/2026");
    expect(formatWeekdayDate("2026-10-14", { year: false })).toBe("Thứ 4 14/10");
  });

  it("formats compact Vietnam dates for list captions, with the year only outside today's year", () => {
    // 17:30Z is already the next day in Vietnam: the UTC date part would be a day early.
    expect(formatShortDate("2026-10-11T17:30:00Z", "2026-10-17")).toBe("12/10");
    expect(formatShortDateTime("2026-10-11T17:30:00Z", "2026-10-17")).toBe("12/10 00:30");
    expect(formatShortDateTime("2025-12-31T02:40:00Z", "2026-10-17")).toBe("31/12/2025 09:40");
    expect(formatShortDate(null, "2026-10-17")).toBe("—");
    expect(formatShortDate("not-a-date", "2026-10-17")).toBe("not-a-date");
  });
});

describe("normalizeSearchText", () => {
  it("folds accents, case and đ", () => {
    expect(normalizeSearchText("  Đặng Phương THẢO ")).toBe("dang phuong thao");
  });
});
