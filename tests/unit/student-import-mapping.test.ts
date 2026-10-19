// Value: protects=the student import's client-side column mapping as it is today (src/features/imports/students/mapping.ts, unchanged by step 15b): header normalisation (case, Vietnamese marks, "đ", "*", "_" and punctuation), automatic matching by alias with ambiguous fields left for the user, validation issues (unknown target, unknown or duplicate source column, missing required field) with their codes, keys and messages, and row mapping (row_number, mapped fields only, blank cells as null, invalid mapping throws with the issues);
// fails_when=a template header stops matching its field, an ambiguous header gets auto-picked, a required field can be left unmapped, two fields can share a column, an unknown column passes, mapped rows lose their row number or gain unmapped fields, or an invalid mapping maps rows anyway;
// why_new=the pure mapping module had no test; step 15b's wizard renders its results (the mapping step names its issues by field label);
// seam=none (pure functions); no_claim=the wizard's wording of the issues (student-import-page.test.tsx), workbook parsing or the server's row validation
import { describe, expect, it } from "vitest";

import { STUDENT_IMPORT_FIELD_DEFINITIONS, STUDENT_IMPORT_REQUIRED_FIELD_KEYS } from "@/features/imports/students/fields";
import {
  buildStudentImportAutomaticMapping,
  mapStudentImportWorkbookRows,
  normalizeStudentImportHeader,
  StudentImportMappingError,
  validateStudentImportColumnMapping,
} from "@/features/imports/students/mapping";
import type { StudentImportColumnMapping, StudentImportParsedWorkbook, StudentImportWorkbookColumn } from "@/features/imports/students/types";

function columns(headers: readonly (string | null)[]): StudentImportWorkbookColumn[] {
  return headers.map((header, index) => ({ columnIndex: index + 1, columnKey: String.fromCharCode(65 + index), sourceHeader: header }));
}

const REQUIRED_MAPPING: StudentImportColumnMapping = {
  birth_year: "B",
  current_grade: "C",
  guardian_full_name: "D",
  guardian_phone: "E",
  guardian_relationship: "F",
  student_full_name: "A",
};

describe("normalizeStudentImportHeader", () => {
  it.each([
    ["Họ và tên học viên *", "ho va ten hoc vien"],
    ["  ĐIỆN THOẠI  ", "dien thoai"],
    ["student_full_name", "student full name"],
    ["Số   ĐT / phụ-huynh", "so dt phu huynh"],
    ["Khối (hiện tại)", "khoi hien tai"],
    ["***", ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeStudentImportHeader(input)).toBe(expected);
  });
});

describe("buildStudentImportAutomaticMapping", () => {
  it("maps every template header to its field and leaves nothing unmatched", () => {
    const templateColumns = columns(STUDENT_IMPORT_FIELD_DEFINITIONS.map((definition) => definition.templateHeader));
    const result = buildStudentImportAutomaticMapping(templateColumns);

    expect(result.ambiguousFields).toEqual([]);
    expect(result.unmatchedColumns).toEqual([]);
    STUDENT_IMPORT_FIELD_DEFINITIONS.forEach((definition, index) => {
      expect(result.mapping[definition.key]).toBe(String.fromCharCode(65 + index));
    });
  });

  it("matches aliases in any case and with marks, and leaves unknown or blank headers unmatched", () => {
    const result = buildStudentImportAutomaticMapping(columns(["HỌ TÊN HỌC VIÊN", "nam sinh", "SĐT phụ huynh", "Ghi chú khác", null]));

    expect(result.mapping).toEqual({ birth_year: "B", guardian_phone: "C", student_full_name: "A" });
    expect(result.ambiguousFields).toEqual([]);
    expect(result.unmatchedColumns).toEqual(["D", "E"]);
  });

  it("leaves a field with two matching columns for the user to pick", () => {
    const result = buildStudentImportAutomaticMapping(columns(["Khối", "Khối hiện tại", "Năm sinh"]));

    expect(result.ambiguousFields).toEqual(["current_grade"]);
    expect(result.mapping).toEqual({ birth_year: "C" });
    expect(result.unmatchedColumns).toEqual(["A", "B"]);
  });
});

describe("validateStudentImportColumnMapping", () => {
  const sixColumns = columns(["a", "b", "c", "d", "e", "f"]);

  it("accepts a mapping of every required field to distinct known columns (blank optional fields are skipped)", () => {
    const result = validateStudentImportColumnMapping(sixColumns, { ...REQUIRED_MAPPING, guardian_email: "  ", nickname: null });

    expect(result).toEqual({ isValid: true, issues: [], missingRequiredFields: [] });
  });

  it("lists every required field that is not mapped, in the required order", () => {
    const result = validateStudentImportColumnMapping(sixColumns, {});

    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toEqual([...STUDENT_IMPORT_REQUIRED_FIELD_KEYS]);
    expect(result.issues.map((issue) => issue.code)).toEqual(Array(6).fill("missing_required_field"));
    expect(result.issues[0]).toEqual({
      code: "missing_required_field",
      fieldKey: "student_full_name",
      message: "Chưa ánh xạ trường bắt buộc student_full_name.",
    });
  });

  it("reports an unknown target field, an unknown column and a column used twice", () => {
    const result = validateStudentImportColumnMapping(sixColumns, {
      ...REQUIRED_MAPPING,
      nickname: "A",
      province_city: "Z",
      ...({ source: "B" } as StudentImportColumnMapping),
    });

    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toEqual([]);
    expect(result.issues).toEqual([
      { code: "duplicate_source_column", columnKey: "A", fieldKey: "nickname", message: "Cột A đang được dùng cho cả student_full_name và nickname." },
      { code: "unknown_source_column", columnKey: "Z", fieldKey: "province_city", message: "Không tìm thấy cột nguồn Z." },
      { code: "unknown_target_field", message: "Trường đích không hợp lệ: source." },
    ]);
  });

  it("trims column keys, and counts a required field on an unknown column as missing too", () => {
    expect(validateStudentImportColumnMapping(sixColumns, { ...REQUIRED_MAPPING, student_full_name: " A " }).isValid).toBe(true);

    const result = validateStudentImportColumnMapping(sixColumns, { ...REQUIRED_MAPPING, guardian_phone: "Q" });
    expect(result.missingRequiredFields).toEqual(["guardian_phone"]);
    expect(result.issues.map((issue) => issue.code)).toEqual(["unknown_source_column", "missing_required_field"]);
  });
});

describe("mapStudentImportWorkbookRows", () => {
  const workbook: StudentImportParsedWorkbook = {
    columns: columns(["Họ tên", "Năm sinh", "Khối", "Phụ huynh", "SĐT", "Quan hệ", "Ghi chú"]),
    rowCount: 2,
    rows: [
      { rowNumber: 2, values: { A: "Đào Thu Trang", B: 2015, C: 6, D: "Đào Văn Kiên", E: "0915222333", F: "Bố", G: "x" } },
      { rowNumber: 5, values: { A: "Lý Gia Hân", B: 2014, C: 7, D: "Lý Văn Sơn", F: "Mẹ" } },
    ],
    sheetName: "HocSinh",
    sourceFilename: "hs.xlsx",
    sourceSha256: "c".repeat(64),
  };

  it("keeps the sheet row number, maps only mapped fields and turns a missing cell into null", () => {
    expect(mapStudentImportWorkbookRows(workbook, { ...REQUIRED_MAPPING, internal_notes: "G" })).toEqual([
      {
        birth_year: 2015,
        current_grade: 6,
        guardian_full_name: "Đào Văn Kiên",
        guardian_phone: "0915222333",
        guardian_relationship: "Bố",
        internal_notes: "x",
        row_number: 2,
        student_full_name: "Đào Thu Trang",
      },
      {
        birth_year: 2014,
        current_grade: 7,
        guardian_full_name: "Lý Văn Sơn",
        guardian_phone: null,
        guardian_relationship: "Mẹ",
        internal_notes: null,
        row_number: 5,
        student_full_name: "Lý Gia Hân",
      },
    ]);
  });

  it("throws the mapping error with the issues instead of mapping an invalid mapping", () => {
    let thrown: unknown;
    try {
      mapStudentImportWorkbookRows(workbook, { student_full_name: "A" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(StudentImportMappingError);
    expect((thrown as StudentImportMappingError).message).toBe("Ánh xạ cột import chưa hợp lệ.");
    expect((thrown as StudentImportMappingError).issues.map((issue) => issue.fieldKey)).toEqual([
      "birth_year",
      "current_grade",
      "guardian_full_name",
      "guardian_phone",
      "guardian_relationship",
    ]);
  });
});
