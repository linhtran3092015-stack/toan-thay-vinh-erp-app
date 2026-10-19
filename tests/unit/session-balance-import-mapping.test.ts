// Value: protects=the session-balance import's client-side column mapping as it is today (pure, unchanged by step 15b): header normalisation (case, diacritics, đ, *, _ and punctuation), the automatic mapping by header aliases (one column per field, ambiguous fields left unmapped, unmatched columns listed), the validation issues (unknown target field, unknown source column, a column used twice, missing required fields; blank choices ignored) and the row mapping (row_number kept, unmapped optional fields absent, missing cells null, an invalid mapping throws with its issues);
// fails_when=a header alias stops matching (e.g. the template's "Mã học viên *" or "Số dư buổi *"), two candidates silently pick one, a duplicate column or a missing required field passes, a blank choice counts as a mapping, or mapped rows lose their row number or values;
// why_new=step 15b map: the import mapping modules had zero coverage; the wizard's mapping step now renders these results directly;
// seam=none (pure module, real fields definitions);
// no_claim=does not prove the workbook parser (read-excel-file needs a browser file), the server's dry run, or the page's Vietnamese wording of the issues (session-balance-import-page.test.tsx)
import { describe, expect, it } from "vitest";

import {
  SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS,
  SESSION_BALANCE_IMPORT_FIELD_KEYS,
  SESSION_BALANCE_IMPORT_REQUIRED_FIELD_KEYS,
} from "@/features/imports/session-balances/fields";
import {
  buildSessionBalanceImportAutomaticMapping,
  mapSessionBalanceImportWorkbookRows,
  normalizeSessionBalanceImportHeader,
  SessionBalanceImportMappingError,
  validateSessionBalanceImportColumnMapping,
} from "@/features/imports/session-balances/mapping";
import type { SessionBalanceImportParsedWorkbook, SessionBalanceImportWorkbookColumn } from "@/features/imports/session-balances/types";

function columns(...headers: Array<string | null>): SessionBalanceImportWorkbookColumn[] {
  return headers.map((sourceHeader, index) => ({
    columnIndex: index + 1,
    columnKey: String.fromCharCode(65 + index),
    sourceHeader,
  }));
}

describe("session-balance import fields", () => {
  it("lists three fields, two required, with the template headers", () => {
    expect(SESSION_BALANCE_IMPORT_FIELD_KEYS).toEqual(["student_public_code", "source_student_name", "source_balance"]);
    expect(SESSION_BALANCE_IMPORT_REQUIRED_FIELD_KEYS).toEqual(["student_public_code", "source_balance"]);
    expect(SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.map((definition) => definition.templateHeader)).toEqual([
      "Mã học viên *",
      "Họ và tên học viên",
      "Số dư buổi *",
    ]);
  });
});

describe("normalizeSessionBalanceImportHeader", () => {
  it.each([
    ["Mã học viên *", "ma hoc vien"],
    ["  SỐ DƯ BUỔI  ", "so du buoi"],
    ["Họ_và_tên học viên", "ho va ten hoc vien"],
    ["Đ đ", "d d"],
    ["student_public_code", "student public code"],
    ["Số buổi (còn lại)", "so buoi con lai"],
    ["***", ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeSessionBalanceImportHeader(input)).toBe(expected);
  });
});

describe("buildSessionBalanceImportAutomaticMapping", () => {
  it("maps the template's headers (with their asterisks) one column per field", () => {
    const result = buildSessionBalanceImportAutomaticMapping(columns("Mã học viên *", "Họ và tên học viên", "Số dư buổi *"));
    expect(result).toEqual({
      ambiguousFields: [],
      mapping: { source_balance: "C", source_student_name: "B", student_public_code: "A" },
      unmatchedColumns: [],
    });
  });

  it("accepts the aliases (Mã HV, Họ tên, Balance) and lists the columns it did not use", () => {
    const result = buildSessionBalanceImportAutomaticMapping(columns("Ghi chú", "Mã HV", "Balance", null, "Họ tên"));
    expect(result.mapping).toEqual({ source_balance: "C", source_student_name: "E", student_public_code: "B" });
    expect(result.unmatchedColumns).toEqual(["A", "D"]);
    expect(result.ambiguousFields).toEqual([]);
  });

  it("leaves a field unmapped and reports it when two columns match it", () => {
    const result = buildSessionBalanceImportAutomaticMapping(columns("Mã học viên", "Số dư buổi", "Số buổi"));
    expect(result.mapping).toEqual({ student_public_code: "A" });
    expect(result.ambiguousFields).toEqual(["source_balance"]);
    expect(result.unmatchedColumns).toEqual(["B", "C"]);
  });

  it("maps nothing from headerless or unknown columns", () => {
    expect(buildSessionBalanceImportAutomaticMapping(columns(null, "Lớp", "Ngày"))).toEqual({
      ambiguousFields: [],
      mapping: {},
      unmatchedColumns: ["A", "B", "C"],
    });
  });
});

describe("validateSessionBalanceImportColumnMapping", () => {
  const cols = columns("Mã học viên", "Họ tên", "Số dư buổi");

  it("accepts a complete mapping and ignores the optional field", () => {
    expect(validateSessionBalanceImportColumnMapping(cols, { source_balance: "C", student_public_code: "A" })).toEqual({
      isValid: true,
      issues: [],
      missingRequiredFields: [],
    });
  });

  it("treats blank, whitespace and null choices as not mapped", () => {
    const result = validateSessionBalanceImportColumnMapping(cols, {
      source_balance: "   ",
      source_student_name: null,
      student_public_code: "A",
    });
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toEqual(["source_balance"]);
    expect(result.issues).toEqual([
      { code: "missing_required_field", fieldKey: "source_balance", message: "Chưa ánh xạ trường bắt buộc source_balance." },
    ]);
  });

  it("reports an unknown column, a column used twice and an unknown target field", () => {
    const result = validateSessionBalanceImportColumnMapping(cols, {
      source_balance: "A",
      source_student_name: "Z",
      student_public_code: "A",
      // A key the UI never sends, as a cast payload could.
      ...({ teacher: "B" } as Record<string, string>),
    });
    expect(result.isValid).toBe(false);
    // Issues follow the mapping's key order (source_balance, source_student_name, student_public_code, teacher).
    expect(result.issues).toEqual([
      { code: "unknown_source_column", columnKey: "Z", fieldKey: "source_student_name", message: "Không tìm thấy cột nguồn Z." },
      { code: "duplicate_source_column", columnKey: "A", fieldKey: "student_public_code", message: "Cột A đang được dùng cho cả source_balance và student_public_code." },
      { code: "unknown_target_field", message: "Trường đích không hợp lệ: teacher." },
    ]);
    // A duplicate still counts as mapped for the required check.
    expect(result.missingRequiredFields).toEqual([]);
  });

  it("reports every required field when nothing is mapped", () => {
    const result = validateSessionBalanceImportColumnMapping(cols, {});
    expect(result.missingRequiredFields).toEqual(["student_public_code", "source_balance"]);
    expect(result.issues.map((issue) => issue.code)).toEqual(["missing_required_field", "missing_required_field"]);
  });
});

describe("mapSessionBalanceImportWorkbookRows", () => {
  const workbook: SessionBalanceImportParsedWorkbook = {
    columns: columns("Mã học viên", "Họ tên", "Số dư buổi", "Ghi chú"),
    rowCount: 2,
    rows: [
      { rowNumber: 2, values: { A: "TV-2026-00012", B: "Nguyễn Ngọc Hà Anh", C: 10, D: "x" } },
      { rowNumber: 5, values: { A: "TV-2026-00014", C: 7.5 } },
    ],
    sheetName: "So_du_buoi",
    sourceFilename: "so-du.xlsx",
    sourceSha256: "a".repeat(64),
  };

  it("keeps the row number, maps the chosen columns and leaves an unmapped optional field out", () => {
    expect(mapSessionBalanceImportWorkbookRows(workbook, { source_balance: "C", student_public_code: " A " })).toEqual([
      { row_number: 2, source_balance: 10, student_public_code: "TV-2026-00012" },
      { row_number: 5, source_balance: 7.5, student_public_code: "TV-2026-00014" },
    ]);
  });

  it("sends null for a mapped cell the row does not have (numbers are never rounded)", () => {
    expect(
      mapSessionBalanceImportWorkbookRows(workbook, { source_balance: "C", source_student_name: "B", student_public_code: "A" }),
    ).toEqual([
      { row_number: 2, source_balance: 10, source_student_name: "Nguyễn Ngọc Hà Anh", student_public_code: "TV-2026-00012" },
      { row_number: 5, source_balance: 7.5, source_student_name: null, student_public_code: "TV-2026-00014" },
    ]);
  });

  it("throws the mapping issues when the mapping is not valid", () => {
    let thrown: unknown;
    try {
      mapSessionBalanceImportWorkbookRows(workbook, { student_public_code: "A" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SessionBalanceImportMappingError);
    const error = thrown as SessionBalanceImportMappingError;
    expect(error.message).toBe("Ánh xạ cột import chưa hợp lệ.");
    expect(error.issues.map((issue) => [issue.code, issue.fieldKey])).toEqual([["missing_required_field", "source_balance"]]);
  });
});
