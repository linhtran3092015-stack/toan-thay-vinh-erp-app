// Value: protects=the enrollment import's automatic header mapping as it is today (src/features/imports/enrollments/mapping.ts + fields.ts, unchanged by step 15b): every template header maps to its field, aliases match case-insensitively after trimming, the first matching header in file order wins, the original header text is kept (the parser looks it up by index), unknown headers are ignored and a missing field stays absent (the parser then names the missing columns);
// fails_when=a template header or a documented alias stops matching, a later duplicate header wins, the mapped value is no longer the header as written, or an unknown header gets mapped;
// why_new=the mapping module had no test; step 15b's wizard shows this mapping read-only as its "Ánh xạ cột" step;
// seam=none (pure function); no_claim=workbook parsing, the "Enrollments" sheet rule or the server's dry-run; it documents (not endorses) that marks are not normalised ("Ma hoc vien" does not match)
import { describe, expect, it } from "vitest";

import { ENROLLMENT_IMPORT_FIELDS } from "@/features/imports/enrollments/fields";
import { autoMapEnrollmentHeaders } from "@/features/imports/enrollments/mapping";

describe("autoMapEnrollmentHeaders", () => {
  it("maps the template's four headers", () => {
    expect(autoMapEnrollmentHeaders(["Mã học viên *", "Mã lớp *", "Hình thức *", "Hiệu lực từ *"])).toEqual({
      class_code: "Mã lớp *",
      effective_from: "Hiệu lực từ *",
      registered_mode: "Hình thức *",
      student_public_code: "Mã học viên *",
    });
  });

  it("has four required fields, each with its documented aliases", () => {
    expect(ENROLLMENT_IMPORT_FIELDS.map((field) => [field.key, field.required])).toEqual([
      ["student_public_code", true],
      ["class_code", true],
      ["registered_mode", true],
      ["effective_from", true],
    ]);
  });

  it("matches aliases in any case after trimming and keeps the header as written", () => {
    expect(autoMapEnrollmentHeaders(["  mã hv  ", "CLASS CODE", "mode", "Ngày bắt đầu"])).toEqual({
      class_code: "CLASS CODE",
      effective_from: "Ngày bắt đầu",
      registered_mode: "mode",
      student_public_code: "  mã hv  ",
    });
  });

  it("takes the first matching header in file order", () => {
    expect(autoMapEnrollmentHeaders(["Lớp", "Mã lớp", "Hình thức học", "Hình thức"])).toEqual({
      class_code: "Lớp",
      registered_mode: "Hình thức học",
    });
  });

  it("ignores unknown headers, leaves missing fields absent and does not strip Vietnamese marks", () => {
    expect(autoMapEnrollmentHeaders([])).toEqual({});
    expect(autoMapEnrollmentHeaders(["Ma hoc vien", "Ghi chú", "constructor", "Student Public Code"])).toEqual({
      student_public_code: "Student Public Code",
    });
  });
});
