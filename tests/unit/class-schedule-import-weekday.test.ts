// Value: protects=the class import reads a "Thứ" cell as one ISO weekday (1 = Thứ Hai … 7 = Chủ nhật) only when it names exactly one day, so the wizard holds every other cell back as an invalid row instead of sending a guessed day;
// fails_when=an English name outranks a Vietnamese spelling ("Thứ 2 (cô Thu)" read as two days), a code silently beats an English name for another day ("Sat - tầng T2" read as Monday), an English name is read after two Vietnamese days, whitespace variants or "Thứ Bẩy" stop reading, a fraction is floored onto a day (1.5 → Thứ Hai), an English day name is matched inside a Vietnamese word ("THU" in "Lý thuyết", "SUN" in "bổ sung") so a one-day cell reads as two, a number typed as text ("03") stops reading, decomposed Vietnamese ("Thứ 2" typed as u + combining marks) reads as English "THU" (Thứ Năm), a two-day cell takes its first day (also when the codes are only separated by a comma or a dash), a code inside a longer word ("T2B") reads as a day, or a known spelling stops reading, including a mistyped row of the spelling table (T3–T6, "Thứ Ba", "Thứ 5", "Thứ 6", Tue, Wed, Fri);
// why_new=testing and red-team review of the unreadable-weekday fix: parseWeekdayValue decides which rows are held back and had no test; a later testing review found the table's T3–T6 / Thứ Ba / Thứ 5 / Thứ 6 / Tue / Wed / Fri spellings and the "code after a separator" and "code inside a word" boundaries of the whole-word match unpinned; the third review found a teacher named Thu ("Thứ 2 (cô Thu)") read as a second day and whitespace or spelling variants ("Thứ2", a non-breaking space, "Thứ Bẩy") rejected;
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
    ["MON", 1],
    ["TUE", 2],
    ["WEDNESDAY", 3],
    ["THU", 4],
    ["THUR", 4],
    ["FRI", 5],
    ["SATURDAY", 6],
    ["SUN", 7],
    ["SAT", 6],
    ["Sunday", 7],
    ["T3", 2],
    ["T4", 3],
    ["T5", 4],
    ["T6", 5],
    ["Thứ Ba", 2],
    ["Thứ 5", 4],
    ["Thứ 6", 5],
    ["Tuesday", 2],
    ["Wed", 3],
    ["Friday", 5],
    ["03", 3],
    ["3.0", 3],
    ["+3", 3],
    ["Thứ 2 - Lý thuyết", 1],
    ["Thứ 4 (GV Thuận)", 3],
    ["Thứ 7 - bổ sung", 6],
    ["Thứ 2 - Monica", 1],
    ["THURS", 4],
    ["Tues", 2],
    ["Thứ 2 (cô Thu)", 1],
    ["Thứ 6 (GV Thu Trang)", 5],
    ["Thứ 2 - lớp SAT", 1],
    ["Thứ 5 (Thursday)", 4],
    ["Thứ2", 1],
    ["thứ7", 6],
    ["Thứ\u00A02", 1],
    ["Thứ\u00A0Hai", 1],
    ["Thứ  3", 2],
    ["Thứ\t4", 3],
    ["Chủ\u00A0nhật", 7],
    ["Thứ Bẩy", 6],
    ["Weds", 3],
    ["Mondays", 1],
    ["Saturdays", 6],
    ["T2 - Monday", 1],
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

  it.each([0, 8, -1, 1.5, 7.9, Number.NaN, "0", "8", "1.5", "", "   ", "Thứ Tám", "x", "Thứ 2, Thứ 4", "T2 / Thứ 5", "T2,T4", "T4 - T6", "T2B", "XT3", "CNT", "Monica", "lý thuyết", "08", "2.5", "Thứ 23", "T 2", "Monday, Thursday", "Thứ 2, Thứ 4 (cô Thu)", "T2, T4 - Sun", "Thứ 3, Thứ 5 - GV Thu Hà", "Sat - tầng T2", "Mon (T5)", "Tuesday - CN Cầu Giấy", "T2 (cô Thu)", true, null, undefined])(
    "reads %j as no weekday",
    (value) => {
      expect(parseWeekdayValue(value)).toBeNull();
    },
  );
});
