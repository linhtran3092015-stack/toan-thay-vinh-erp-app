// Value: protects=the class & schedule import's column mapping as it is today (pure functions in src/features/imports/classes/mapping.ts, unchanged by step 15b): template headers (with " *", "/", "_" and any case) auto-map every field of both sheets, a header matching no alias stays unmatched, two headers matching one field leave it unmapped and reported as ambiguous, empty headers are skipped; validation lists every unmapped required field (labels in field order, Vietnamese messages), reports a column used for two fields, accepts unmapped optional fields, and never mutates its input;
// fails_when=an alias or the header normalisation changes (a template header stops auto-mapping), an ambiguous header silently picks a column, a required field can stay unmapped (the wizard's "Kiểm tra dòng" would send empty values), a duplicate column passes, an optional schedule field becomes required, or the messages the wizard shows change;
// why_new=the import mapping modules had zero tests (step 15 map §0 finding 2) and the redesigned wizard (step 2 "Ánh xạ cột") renders these results directly;
// seam=none (pure functions over a hand-built parsed sheet); no_claim=does not prove the workbook parser, the dry-run payload or the server's own validation
import { describe, expect, it } from "vitest";

import { CLASS_IMPORT_FIELDS, SCHEDULE_IMPORT_FIELDS } from "@/features/imports/classes/fields";
import {
  autoMapClassesSheet,
  autoMapSchedulesSheet,
  validateClassesMapping,
  validateSchedulesMapping,
} from "@/features/imports/classes/mapping";
import type { ClassScheduleImportParsedSheet } from "@/features/imports/classes/types";

function sheetWithHeaders(headers: readonly (string | null)[]): ClassScheduleImportParsedSheet {
  return {
    columns: headers.map((header, index) => ({
      columnIndex: index + 1,
      columnKey: String.fromCharCode(65 + index),
      sourceHeader: header,
    })),
    rowCount: 0,
    rows: [],
    sheetName: "Sheet",
  };
}

describe("autoMapClassesSheet", () => {
  it("maps every field from the template headers and leaves extra columns unmatched", () => {
    const sheet = sheetWithHeaders([...CLASS_IMPORT_FIELDS.map((field) => field.templateHeader), "Ghi chú"]);
    const result = autoMapClassesSheet(sheet);

    expect(result.mapping).toEqual({
      academic_year_code: "A",
      class_code: "B",
      class_name: "C",
      default_learning_mode: "G",
      grade: "D",
      level: "E",
      status: "H",
      weekly_session_count: "F",
    });
    expect(result.ambiguousFields).toEqual([]);
    expect(result.unmatchedColumns).toEqual(["I"]);
  });

  it("normalises case, underscores, slashes and asterisks, and skips empty headers", () => {
    const sheet = sheetWithHeaders([null, "MÃ_LỚP", "Class Name", "khối lớp", "LEVEL", "Weekly_Session_Count", "Status *", "  Year  "]);
    const result = autoMapClassesSheet(sheet);

    expect(result.mapping.class_code).toBe("B");
    expect(result.mapping.class_name).toBe("C");
    expect(result.mapping.grade).toBe("D");
    expect(result.mapping.level).toBe("E");
    expect(result.mapping.weekly_session_count).toBe("F");
    expect(result.mapping.status).toBe("G");
    expect(result.mapping.academic_year_code).toBe("H");
    expect(result.mapping.default_learning_mode).toBeNull();
    expect(result.unmatchedColumns).toEqual(["A"]);
  });

  it("leaves a field unmapped and reports it when two headers match it", () => {
    const sheet = sheetWithHeaders(["Mã lớp", "Lớp", "Tên lớp"]);
    const result = autoMapClassesSheet(sheet);

    expect(result.mapping.class_code).toBeNull();
    expect(result.ambiguousFields).toEqual(["class_code"]);
    expect(result.mapping.class_name).toBe("C");
    expect(result.unmatchedColumns).toEqual(["A", "B"]);
  });
});

describe("autoMapSchedulesSheet", () => {
  it("maps every field from the template headers, the schedule 'Hình thức' included", () => {
    const sheet = sheetWithHeaders(SCHEDULE_IMPORT_FIELDS.map((field) => field.templateHeader));
    const result = autoMapSchedulesSheet(sheet);

    expect(result.mapping).toEqual({
      class_code: "A",
      component_code: "B",
      effective_from: "I",
      effective_to: "J",
      end_time: "E",
      learning_mode: "F",
      meeting_url: "H",
      room_name: "G",
      start_time: "D",
      weekday: "C",
    });
    expect(result.ambiguousFields).toEqual([]);
    expect(result.unmatchedColumns).toEqual([]);
  });

  it("does not map a class-sheet header onto a schedule field", () => {
    const result = autoMapSchedulesSheet(sheetWithHeaders(["Mã lớp", "Hình thức mặc định", "Thứ"]));

    expect(result.mapping.class_code).toBe("A");
    expect(result.mapping.learning_mode).toBeNull();
    expect(result.mapping.weekday).toBe("C");
    expect(result.unmatchedColumns).toEqual(["B"]);
  });
});

describe("validateClassesMapping", () => {
  it("lists every unmapped required field in field order with its message", () => {
    const result = validateClassesMapping({});

    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toEqual(CLASS_IMPORT_FIELDS.map((field) => field.label));
    expect(result.issues).toHaveLength(8);
    expect(result.issues[0]).toEqual({
      code: "missing_required_field",
      fieldKey: "academic_year_code",
      message: 'Trường bắt buộc "Mã năm học" chưa được gán cột.',
    });
  });

  it("accepts a full mapping and reports a column used for two fields", () => {
    const full = autoMapClassesSheet(sheetWithHeaders(CLASS_IMPORT_FIELDS.map((field) => field.templateHeader))).mapping;
    expect(validateClassesMapping(full)).toEqual({ isValid: true, issues: [], missingRequiredFields: [] });

    const input = { ...full, class_name: "B" };
    const snapshot = JSON.stringify(input);
    const result = validateClassesMapping(input);

    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toEqual([]);
    expect(result.issues).toEqual([
      {
        code: "duplicate_source_column",
        columnKey: "B",
        message: 'Cột "B" đang được gán trùng cho 2 trường "Mã lớp" và "Tên lớp".',
      },
    ]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("validateSchedulesMapping", () => {
  it("accepts the required fields alone (room, link and end date are optional)", () => {
    const required = Object.fromEntries(
      SCHEDULE_IMPORT_FIELDS.filter((field) => field.required).map((field, index) => [field.key, String.fromCharCode(65 + index)]),
    );
    expect(SCHEDULE_IMPORT_FIELDS.filter((field) => !field.required).map((field) => field.key)).toEqual(["room_name", "meeting_url", "effective_to"]);
    expect(validateSchedulesMapping(required)).toEqual({ isValid: true, issues: [], missingRequiredFields: [] });
  });

  it("reports a missing required field and a duplicate column together", () => {
    const result = validateSchedulesMapping({
      class_code: "A",
      component_code: "B",
      end_time: "E",
      learning_mode: "F",
      room_name: "A",
      start_time: "D",
      weekday: "C",
    });

    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toEqual(["Hiệu lực từ"]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'Cột "A" đang được gán trùng cho 2 trường "Mã lớp" và "Phòng học".',
      'Trường bắt buộc "Hiệu lực từ" chưa được gán cột.',
    ]);
  });
});
