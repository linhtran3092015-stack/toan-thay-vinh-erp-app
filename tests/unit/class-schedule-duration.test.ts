// Value: protects=the overview schedule card's "N phút" comes from a positive start→end span, and a reversed, empty or malformed span shows no duration;
// fails_when=getDurationMinutes returns 0, a negative number or NaN for an end at/before the start or unparsable text, or stops accepting HH:MM without seconds;
// why_new=the helper was new in this branch and untested (ship pass-3 review);
// seam=none; no_claim=does not prove the database stores times as HH:MM:SS
import { describe, expect, it } from "vitest";

import { getDurationMinutes } from "@/features/classes/detail/components/class-schedule-section";

describe("getDurationMinutes", () => {
  it.each([
    ["19:30:00", "21:30:00", 120],
    ["08:00", "09:15", 75],
    ["19:30:00", "19:30:00", null],
    ["21:30:00", "19:30:00", null],
    ["xx:yy", "21:30:00", null],
  ])("%s to %s is %s minutes", (start, end, expected) => {
    expect(getDurationMinutes(start, end)).toBe(expected);
  });
});
