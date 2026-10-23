// Value: protects=the class import reads a "Thứ" cell as one ISO weekday (1 = Thứ Hai … 7 = Chủ nhật) only when it names exactly one day, so the wizard holds every other cell back as an invalid row instead of sending a guessed day;
// fails_when=a fraction is floored onto a day (1.5 → Thứ Hai), decomposed Vietnamese ("Thứ 2" typed as u + combining marks) reads as English "THU" (Thứ Năm), a two-day cell takes its first day, or a known spelling stops reading;
// why_new=testing and red-team review of the unreadable-weekday fix: parseWeekdayValue decides which rows are held back and had no test;
// seam=none; no_claim=does not settle whether a bare digit means ISO (3 = Thứ Tư) or Vietnamese "Thứ 3" (owner decision in TODOS.md)
import { describe, expect, it } from "vitest";

import { parseWeekdayValue } from "@/features/imports/classes/workbook";

describe("parseWeekdayValue", () => {
  it.each([
    [1, 1],
    [7, 7],
    [3.0, 3],
    ["2", 2],
    [" 6 ", 6],
    ["T2", 1],
    ["t7", 6],
    ["CN", 7],
    ["Thứ 2", 1],
    ["thứ hai", 1],
    ["Thứ Tư", 3],
    ["Thứ Năm", 4],
    ["Thứ bảy", 6],
    ["Chủ nhật", 7],
    ["Thứ 2 (tối)", 1],
    ["Monday", 1],
    ["Thursday", 4],
    ["SAT", 6],
    ["Sunday", 7],
  ] as const)("reads %j as ISO %i", (value, iso) => {
    expect(parseWeekdayValue(value)).toBe(iso);
  });

  it.each([
    ["Thứ 2", 1],
    ["Thứ 3", 2],
    ["Thứ 4", 3],
    ["Thứ Sáu", 5],
    ["Thứ 7", 6],
    ["Thứ bảy", 6],
    ["Chủ nhật", 7],
  ] as const)("reads decomposed %j as ISO %i, never as English THU", (value, iso) => {
    const decomposed = value.normalize("NFD");
    expect(decomposed).not.toBe(value.normalize("NFC"));
    expect(parseWeekdayValue(decomposed)).toBe(iso);
  });

  it.each([0, 8, -1, 1.5, 7.9, Number.NaN, "0", "8", "1.5", "", "   ", "Thứ Tám", "x", "Thứ 2, Thứ 4", "T2 / Thứ 5", true, null, undefined])(
    "reads %j as no weekday",
    (value) => {
      expect(parseWeekdayValue(value)).toBeNull();
    },
  );
});
