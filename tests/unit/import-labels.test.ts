// Value: protects=the import wizards' shared wording helpers: ISO weekday 1..7 reads "Thứ Hai" … "Chủ nhật" (never "Thứ 1" for Monday) with visible fallbacks for blank and out-of-range values; batch timestamps read "dd/MM/yyyy HH:mm" in Vietnam time whatever the process time zone, including across midnight UTC and the new year; code → label lookups only match a map's own keys;
// fails_when=Monday renders "Thứ 1" or "Thứ 2", 0/8/1.5/"abc" render a weekday, a blank weekday renders "Không rõ thứ ()", a timestamp is printed in UTC or the host zone (e.g. 19/10 instead of 20/10 after 17:00Z), the time-first vi-VN order of formatDateTime leaks in, or "constructor"/"toString"/"__proto__" resolve to an inherited member instead of the fallback;
// why_new=step 15b adds src/features/imports/components/import-labels.ts for the class batch weekday bug ("Thứ {n}" with ISO n) and the import pages' local Intl/toLocaleString copies;
// seam=none (pure functions; the time-zone case swaps process.env.TZ and restores it);
// no_claim=does not prove which import page uses the helpers or the feature-owned label maps
import { afterEach, describe, expect, it } from "vitest";

import { formatImportTimestamp, formatIsoWeekday, labelFrom } from "@/features/imports/components/import-labels";

const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe("formatIsoWeekday", () => {
  it.each([
    [1, "Thứ Hai"],
    [2, "Thứ Ba"],
    [3, "Thứ Tư"],
    [4, "Thứ Năm"],
    [5, "Thứ Sáu"],
    [6, "Thứ Bảy"],
    [7, "Chủ nhật"],
  ])("reads ISO %i as %s (number or numeric string)", (value, label) => {
    expect(formatIsoWeekday(value)).toBe(label);
    expect(formatIsoWeekday(String(value))).toBe(label);
    expect(formatIsoWeekday(` ${value} `)).toBe(label);
  });

  it("never prints a numbered weekday for Monday", () => {
    expect(formatIsoWeekday(1)).not.toMatch(/Thứ \d/);
  });

  it.each([
    [0, "Không rõ thứ (0)"],
    [8, "Không rõ thứ (8)"],
    [-1, "Không rõ thứ (-1)"],
    [1.5, "Không rõ thứ (1.5)"],
    ["01", "Không rõ thứ (01)"],
    ["abc", "Không rõ thứ (abc)"],
    ["constructor", "Không rõ thứ (constructor)"],
    ["toString", "Không rõ thứ (toString)"],
  ])("keeps an out-of-range value %j visible", (value, label) => {
    expect(formatIsoWeekday(value)).toBe(label);
  });

  it.each([null, undefined, "", "   "])("reads a blank weekday %j as 'Không rõ thứ'", (value) => {
    expect(formatIsoWeekday(value)).toBe("Không rõ thứ");
  });
});

describe("formatImportTimestamp", () => {
  it.each([
    ["2026-10-19T02:30:00Z", "19/10/2026 09:30"],
    ["2026-10-19T16:59:00Z", "19/10/2026 23:59"],
    ["2026-10-19T17:05:00Z", "20/10/2026 00:05"],
    ["2026-12-31T17:30:00.000Z", "01/01/2027 00:30"],
    ["2026-10-20T00:05:00+07:00", "20/10/2026 00:05"],
    ["2026-10-19T23:45:00-05:00", "20/10/2026 11:45"],
  ])("prints %s as %s in Vietnam time", (value, expected) => {
    expect(formatImportTimestamp(value)).toBe(expected);
  });

  it("does not depend on the process time zone", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(formatImportTimestamp("2026-10-19T17:05:00Z")).toBe("20/10/2026 00:05");
    process.env.TZ = "UTC";
    expect(formatImportTimestamp("2026-10-19T17:05:00Z")).toBe("20/10/2026 00:05");
  });

  it("shows a dash when empty and the raw value when unparseable", () => {
    expect(formatImportTimestamp(null)).toBe("—");
    expect(formatImportTimestamp(undefined)).toBe("—");
    expect(formatImportTimestamp("")).toBe("—");
    expect(formatImportTimestamp("không phải ngày")).toBe("không phải ngày");
  });
});

describe("labelFrom", () => {
  const statusLabels: Readonly<Record<string, string>> = {
    awaiting_approval: "Đang chờ phê duyệt",
    posted: "Đã ghi sổ",
  };

  it("returns the map's own label for a known code", () => {
    expect(labelFrom(statusLabels, "posted", "Không rõ")).toBe("Đã ghi sổ");
    expect(labelFrom(statusLabels, "awaiting_approval", (code) => `Trạng thái chưa hỗ trợ: ${code}`)).toBe("Đang chờ phê duyệt");
  });

  it("falls back for unknown codes, with the raw code when the fallback is a function", () => {
    expect(labelFrom(statusLabels, "draft", "Không rõ")).toBe("Không rõ");
    expect(labelFrom(statusLabels, "draft", (code) => `Trạng thái chưa hỗ trợ: ${code}`)).toBe("Trạng thái chưa hỗ trợ: draft");
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"])(
    "never resolves the inherited member %s",
    (code) => {
      expect(labelFrom(statusLabels, code, (raw) => `Trạng thái chưa hỗ trợ: ${raw}`)).toBe(`Trạng thái chưa hỗ trợ: ${code}`);
    },
  );

  it("treats a missing code as blank and works with a null-prototype map", () => {
    expect(labelFrom(statusLabels, null, "Không rõ")).toBe("Không rõ");
    expect(labelFrom(statusLabels, undefined, (code) => `[${code}]`)).toBe("[]");

    const bare: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, { valid: "Hợp lệ" });
    expect(labelFrom(bare, "valid", "Không rõ")).toBe("Hợp lệ");
    expect(labelFrom(bare, "invalid", "Không rõ")).toBe("Không rõ");
  });
});
