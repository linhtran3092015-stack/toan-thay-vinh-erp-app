// Value: protects=the session CSV the export route sends: UTF-8 BOM + CRLF lines for Excel, RFC-4180 quoting, the formula guard (a cell starting with = + - @ tab or CR gets a leading apostrophe so Excel never evaluates it), the row-length check, the inclusive date filter, and the column set/labels (locked → "Đã khóa", dd/mm/yyyy dates, HH:MM times, attendance/result columns only when asked);
// fails_when=the BOM or CRLF goes, a quote/comma/newline cell is left unquoted, a formula-looking class name reaches Excel raw, a short row is written instead of throwing, a boundary date is dropped, or a count column appears without its permission flag;
// why_new=step 14d (R8): csv.ts and session-export.ts had no test; the redesign leaves them untouched and this pins them; seam=none (pure functions; server-only is aliased to an empty module in vitest); no_claim=what the route reads or which permissions it checks (reports-export-route.test.ts)
import { describe, expect, it } from "vitest";

import { createCsvDocument, escapeCsvCell, protectCsvFormula } from "@/features/reports/csv";
import { createSessionsCsv, filterSessionsForExport } from "@/features/reports/session-export";
import type { SessionDirectoryItem } from "@/features/sessions/read-models";

const BOM = "﻿";

function session(overrides: Partial<SessionDirectoryItem> = {}): SessionDirectoryItem {
  return {
    attendanceCount: 18,
    classCode: "L-9A26",
    classId: "class-1",
    className: "Toán 9A tối 2-4-6",
    componentCode: null,
    endTime: "19:30:00",
    grade: 9,
    id: "session-1",
    learningMode: "offline",
    level: "A",
    lockedAt: null,
    resultCount: 15,
    roomName: "P.201",
    sessionDate: "2026-10-12",
    sessionKind: "regular",
    startTime: "18:00:00",
    status: "completed",
    ...overrides,
  };
}

describe("createCsvDocument", () => {
  it("starts with a BOM, joins lines with CRLF and ends with CRLF", () => {
    expect(createCsvDocument(["A", "B"], [["1", "2"], ["3", "4"]])).toBe(`${BOM}A,B\r\n1,2\r\n3,4\r\n`);
    expect(createCsvDocument(["Ngày"], [])).toBe(`${BOM}Ngày\r\n`);
  });

  it("throws when a row does not match the header length", () => {
    expect(() => createCsvDocument(["A", "B"], [["only one"]])).toThrow("CSV row length does not match header length.");
  });
});

describe("escapeCsvCell", () => {
  it("quotes commas, quotes and line breaks, doubling inner quotes", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('Lớp "chọn"')).toBe('"Lớp ""chọn"""');
    expect(escapeCsvCell("dòng 1\ndòng 2")).toBe('"dòng 1\ndòng 2"');
    expect(escapeCsvCell("plain")).toBe("plain");
  });

  it("writes null and undefined as empty, booleans and numbers as text", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(false)).toBe("false");
    expect(escapeCsvCell(0)).toBe("0");
  });

  it("guards formula prefixes before quoting", () => {
    expect(escapeCsvCell("=1+1,2")).toBe(`"'=1+1,2"`);
    expect(escapeCsvCell("\rabc")).toBe(`"'\rabc"`);
  });
});

describe("protectCsvFormula", () => {
  it.each(["=SUM(A1)", "+84 912", "-1", "@cmd", "\tx", "\rx"])("prefixes %j with an apostrophe", (value) => {
    expect(protectCsvFormula(value)).toBe(`'${value}`);
  });

  it("leaves other text and numbers alone (a negative number is text-guarded too)", () => {
    expect(protectCsvFormula("Toán 9A")).toBe("Toán 9A");
    expect(protectCsvFormula(12)).toBe("12");
    expect(protectCsvFormula(-3)).toBe("'-3");
    expect(protectCsvFormula(" =x")).toBe(" =x");
  });
});

describe("filterSessionsForExport", () => {
  const sessions = [
    session({ id: "a", sessionDate: "2026-10-01" }),
    session({ id: "b", sessionDate: "2026-10-05" }),
    session({ id: "c", sessionDate: "2026-10-10" }),
  ];

  it("keeps both bounds inclusive", () => {
    expect(filterSessionsForExport(sessions, { dateFrom: "2026-10-01", dateTo: "2026-10-05" }).map((row) => row.id)).toEqual(["a", "b"]);
    expect(filterSessionsForExport(sessions, { dateFrom: "2026-10-05", dateTo: "2026-10-05" }).map((row) => row.id)).toEqual(["b"]);
  });

  it("treats a null bound as open", () => {
    expect(filterSessionsForExport(sessions, { dateFrom: null, dateTo: null })).toHaveLength(3);
    expect(filterSessionsForExport(sessions, { dateFrom: "2026-10-06", dateTo: null }).map((row) => row.id)).toEqual(["c"]);
    expect(filterSessionsForExport(sessions, { dateFrom: null, dateTo: "2026-10-04" }).map((row) => row.id)).toEqual(["a"]);
  });
});

describe("createSessionsCsv", () => {
  const baseHeader = "Ngày,Giờ bắt đầu,Giờ kết thúc,Mã lớp,Tên lớp,Khối,Trình độ,Hình thức,Loại buổi,Phòng,Trạng thái";

  it("writes the base columns with Vietnamese labels, dd/mm/yyyy dates and HH:MM times", () => {
    const csv = createSessionsCsv([session()], { includeAttendanceCounts: false, includeResultCounts: false });
    expect(csv).toBe(`${BOM}${baseHeader}\r\n12/10/2026,18:00,19:30,L-9A26,Toán 9A tối 2-4-6,9,A,Offline,Buổi chính,P.201,Đã hoàn thành\r\n`);
  });

  it("says Đã khóa for a locked session and leaves a missing room empty", () => {
    const csv = createSessionsCsv(
      [session({ learningMode: "online", lockedAt: "2026-10-12T15:00:00Z", roomName: null, sessionKind: "makeup" })],
      { includeAttendanceCounts: false, includeResultCounts: false },
    );
    expect(csv.split("\r\n")[1]).toBe("12/10/2026,18:00,19:30,L-9A26,Toán 9A tối 2-4-6,9,A,Online,Buổi bù,,Đã khóa");
  });

  it("adds the attendance and result columns only when asked, writing a missing count as 0", () => {
    const both = createSessionsCsv([session({ attendanceCount: null, resultCount: 7 })], { includeAttendanceCounts: true, includeResultCounts: true });
    expect(both.split("\r\n")[0]).toBe(`${BOM}${baseHeader},Số học viên điểm danh,Số học viên có kết quả`);
    expect(both.split("\r\n")[1].endsWith(",Đã hoàn thành,0,7")).toBe(true);

    const attendanceOnly = createSessionsCsv([session()], { includeAttendanceCounts: true, includeResultCounts: false });
    expect(attendanceOnly.split("\r\n")[0]).toBe(`${BOM}${baseHeader},Số học viên điểm danh`);

    const resultsOnly = createSessionsCsv([session()], { includeAttendanceCounts: false, includeResultCounts: true });
    expect(resultsOnly.split("\r\n")[0]).toBe(`${BOM}${baseHeader},Số học viên có kết quả`);
  });

  it("guards a formula-looking class name", () => {
    const csv = createSessionsCsv([session({ className: "=HYPERLINK(\"x\")" })], { includeAttendanceCounts: false, includeResultCounts: false });
    expect(csv.split("\r\n")[1]).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
