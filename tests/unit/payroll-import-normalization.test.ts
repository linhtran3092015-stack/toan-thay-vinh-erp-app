import { describe, expect, it } from "vitest";

import { createPayrollImportBatchSchema } from "@/features/payroll/forms/payroll-schemas";
import {
  normalizePayrollImportRow,
  payrollImportTemplateHeaders,
} from "@/features/payroll/import-normalization";

const staffId = "0e4513d1-bf59-41c2-88ed-8426e9b1e960";
const studentId = "77000000-0000-4000-8000-000000000001";
const headers = payrollImportTemplateHeaders.new_enrollment_orders;

function source(studentIdValue: unknown): unknown[] {
  return [
    "TEST-NV30-NEW-ENROLL-20260702-001",
    "2026-07-02",
    staffId,
    studentIdValue,
    4,
    1_400_000,
    "school_telesales_ads",
    "https://example.com/evidence/test-nv30-001",
  ];
}

function batchWithStudentId(studentIdValue: unknown) {
  return {
    datasetType: "new_enrollment_orders" as const,
    fileName: "new-enrollment.xlsx",
    fileSha256: "a".repeat(64),
    periodMonth: "2026-07-01",
    rows: [{
      conflictPayload: null,
      normalizedPayload: {
        amount_vnd: 1_400_000,
        event_date: "2026-07-02",
        grade: 4,
        metadata: { evidence_url: "https://example.com/evidence/test-nv30-001" },
        quantity: null,
        source_code: "school_telesales_ads",
        staff_id: staffId,
        student_id: studentIdValue,
      },
      rawPayload: {},
      rowNumber: 2,
      sourceKey: "TEST-NV30-NEW-ENROLL-20260702-001",
      validationErrors: [],
      validationStatus: "valid" as const,
    }],
  };
}

describe("new enrollment payroll import normalization", () => {
  it("accepts a blank Excel student_id and writes null to normalizedPayload", () => {
    const row = normalizePayrollImportRow("new_enrollment_orders", headers, source("   "), 2);

    expect(row.validationStatus).toBe("valid");
    expect(row.normalizedPayload.student_id).toBeNull();
  });

  it("preserves a syntactically valid student UUID", () => {
    const row = normalizePayrollImportRow("new_enrollment_orders", headers, source(studentId), 2);

    expect(row.validationStatus).toBe("valid");
    expect(row.normalizedPayload.student_id).toBe(studentId);
  });

  it("rejects a non-UUID student_id when it is supplied", () => {
    const row = normalizePayrollImportRow("new_enrollment_orders", headers, source("not-a-student-id"), 2);

    expect(row.validationStatus).toBe("error");
    expect(row.validationErrors).toContain("student_id không hợp lệ");
  });
});

describe("payroll import server schema", () => {
  it("normalizes missing, blank, and whitespace student_id values to null", () => {
    for (const value of [undefined, null, "", "   "]) {
      const input = batchWithStudentId(value);
      if (value === undefined) delete input.rows[0].normalizedPayload.student_id;

      const result = createPayrollImportBatchSchema.parse(input);
      expect(result.rows[0].normalizedPayload.student_id).toBeNull();
    }
  });

  it("accepts a supplied UUID and rejects malformed values", () => {
    const valid = createPayrollImportBatchSchema.parse(batchWithStudentId(`  ${studentId}  `));
    expect(valid.rows[0].normalizedPayload.student_id).toBe(studentId);

    const invalid = createPayrollImportBatchSchema.safeParse(batchWithStudentId("not-a-uuid"));
    expect(invalid.success).toBe(false);
  });
});
