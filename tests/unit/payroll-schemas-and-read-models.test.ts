import { describe, expect, it } from "vitest";
import {
  addPayrollManualLineSchema,
  createPayrollDraftSchema,
  createPayrollImportBatchSchema,
  decidePayrollImportBatchSchema,
  payrollPeriodActionSchema,
  recalculatePayrollSchema,
  resolvePayrollCorrectionSchema,
  submitPayrollCorrectionSchema,
} from "@/features/payroll/forms/payroll-schemas";
import {
  enrichPayrollPeriodsWithExplanations,
  normalizePayrollPeriodsWithDetailsRows,
  type PayrollPeriodsWithDetailsRow,
} from "@/features/payroll/read-models";

describe("Payroll Validation Schemas", () => {
  describe("createPayrollDraftSchema", () => {
    it("accepts valid month string formatted as YYYY-MM-01", () => {
      expect(createPayrollDraftSchema.safeParse({ periodMonth: "2026-07-01" }).success).toBe(true);
    });

    it("rejects invalid month format", () => {
      expect(createPayrollDraftSchema.safeParse({ periodMonth: "2026-07-15" }).success).toBe(false);
      expect(createPayrollDraftSchema.safeParse({ periodMonth: "invalid" }).success).toBe(false);
      expect(createPayrollDraftSchema.safeParse({ periodMonth: "" }).success).toBe(false);
    });
  });

  describe("addPayrollManualLineSchema", () => {
    const validUuid = "12345678-1234-4234-8234-123456789012";

    it("accepts valid manual reward and deduction", () => {
      const reward = addPayrollManualLineSchema.safeParse({
        amountVnd: 500000,
        lineType: "manual_reward",
        note: "Thưởng dự án hoàn thành tốt",
        payrollStatementId: validUuid,
      });
      expect(reward.success).toBe(true);

      const deduction = addPayrollManualLineSchema.safeParse({
        amountVnd: 100000,
        lineType: "manual_deduction",
        note: "Phạt đi muộn",
        payrollStatementId: validUuid,
      });
      expect(deduction.success).toBe(true);
    });

    it("rejects non-positive amount and invalid UUID", () => {
      expect(
        addPayrollManualLineSchema.safeParse({
          amountVnd: 0,
          lineType: "manual_reward",
          note: "Note",
          payrollStatementId: validUuid,
        }).success,
      ).toBe(false);

      expect(
        addPayrollManualLineSchema.safeParse({
          amountVnd: 50000,
          lineType: "manual_reward",
          note: "Note",
          payrollStatementId: "not-a-uuid",
        }).success,
      ).toBe(false);

      expect(
        addPayrollManualLineSchema.safeParse({
          amountVnd: 50000,
          lineType: "manual_reward",
          note: "",
          payrollStatementId: validUuid,
        }).success,
      ).toBe(false);
    });
  });

  describe("payrollPeriodActionSchema & recalculatePayrollSchema", () => {
    const validUuid = "12345678-1234-4234-8234-123456789012";

    it("validates payroll period action", () => {
      expect(payrollPeriodActionSchema.safeParse({ payrollPeriodId: validUuid }).success).toBe(true);
      expect(payrollPeriodActionSchema.safeParse({ payrollPeriodId: "bad" }).success).toBe(false);
    });

    it("validates recalculate action with mandatory reason", () => {
      expect(
        recalculatePayrollSchema.safeParse({
          payrollPeriodId: validUuid,
          reason: "Cập nhật dữ liệu chấm công bổ sung",
        }).success,
      ).toBe(true);

      expect(
        recalculatePayrollSchema.safeParse({
          payrollPeriodId: validUuid,
          reason: "   ",
        }).success,
      ).toBe(false);
    });
  });

  describe("submitPayrollCorrectionSchema & resolvePayrollCorrectionSchema", () => {
    const validUuid = "12345678-1234-4234-8234-123456789012";

    it("validates correction request submission with optional evidenceUrl", () => {
      expect(
        submitPayrollCorrectionSchema.safeParse({
          evidenceUrl: "https://example.com/evidence.png",
          itemLabel: "Chấm công ngày 15/07",
          payrollLineItemId: validUuid,
          payrollStatementId: validUuid,
          requestMessage: "Bị thiếu giờ làm việc",
          requestedChange: "Thêm 540 phút",
        }).success,
      ).toBe(true);

      expect(
        submitPayrollCorrectionSchema.safeParse({
          evidenceUrl: "",
          itemLabel: "Chấm công ngày 15/07",
          payrollLineItemId: null,
          payrollStatementId: validUuid,
          requestMessage: "Bị thiếu giờ làm việc",
          requestedChange: "Thêm 540 phút",
        }).success,
      ).toBe(true);
    });

    it("validates resolution decision", () => {
      expect(
        resolvePayrollCorrectionSchema.safeParse({
          decision: "accepted",
          requestId: validUuid,
          responseMessage: "Đã duyệt và sẽ tính lại lương",
        }).success,
      ).toBe(true);

      expect(
        resolvePayrollCorrectionSchema.safeParse({
          decision: "rejected",
          requestId: validUuid,
          responseMessage: "Không đủ bằng chứng",
        }).success,
      ).toBe(true);
    });
  });

  describe("createPayrollImportBatchSchema & decidePayrollImportBatchSchema", () => {
    const validUuid = "12345678-1234-4234-8234-123456789012";
    const validSha = "a".repeat(64);

    it("validates import batch payload", () => {
      expect(
        createPayrollImportBatchSchema.safeParse({
          datasetType: "timekeeping",
          fileName: "cham_cong_thang_7.xlsx",
          fileSha256: validSha,
          periodMonth: "2026-07-01",
          rows: [
            {
              conflictPayload: null,
              normalizedPayload: { minutes: 540 },
              rawPayload: { cot_a: "540" },
              rowNumber: 1,
              sourceKey: "row-1-key",
              validationErrors: [],
              validationStatus: "valid",
            },
          ],
        }).success,
      ).toBe(true);
    });

    it("validates import batch decision", () => {
      expect(
        decidePayrollImportBatchSchema.safeParse({
          batchId: validUuid,
          decision: "approved",
          reviewNote: "Dữ liệu hợp lệ",
        }).success,
      ).toBe(true);
    });
  });
});

describe("Payroll Read Model Normalization & Enrichment", () => {
  it("normalizes flat RPC rows into nested Period -> Statement -> Line tree", () => {
    const rows: PayrollPeriodsWithDetailsRow[] = [
      {
        payroll_period_id: "p1",
        period_month: "2026-07-01",
        pay_date: "2026-08-05",
        period_status: "draft",
        payroll_statement_id: "s1",
        staff_id: "u1",
        staff_display_name: "Staff 1",
        staff_employee_code: "EMP-01",
        work_units: 1,
        work_hours: 9,
        total_earnings_vnd: 500000,
        total_deductions_vnd: 0,
        payable_amount_vnd: 500000,
        payroll_line_item_id: "l1",
        line_type: "base_offline",
        line_direction: "earning",
        line_amount_vnd: 500000,
        unit_count: 1,
        unit_rate_vnd: 500000,
        note: "Base salary",
      },
    ];

    const normalized = normalizePayrollPeriodsWithDetailsRows(rows);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe("p1");
    expect(normalized[0].statements).toHaveLength(1);
    expect(normalized[0].statements[0].id).toBe("s1");
    expect(normalized[0].statements[0].lines).toHaveLength(1);
    expect(normalized[0].statements[0].lines[0].id).toBe("l1");
  });

  it("handles period with null statement row (zero statements)", () => {
    const rows: PayrollPeriodsWithDetailsRow[] = [
      {
        payroll_period_id: "p2",
        period_month: "2026-08-01",
        pay_date: "2026-09-05",
        period_status: "draft",
        payroll_statement_id: null,
        staff_id: null,
        staff_display_name: null,
        staff_employee_code: null,
        work_units: null,
        work_hours: null,
        total_earnings_vnd: null,
        total_deductions_vnd: null,
        payable_amount_vnd: null,
        payroll_line_item_id: null,
        line_type: null,
        line_direction: null,
        line_amount_vnd: null,
        unit_count: null,
        unit_rate_vnd: null,
        note: null,
      },
    ];

    const normalized = normalizePayrollPeriodsWithDetailsRows(rows);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe("p2");
    expect(normalized[0].statements).toHaveLength(0);
  });

  it("enriches periods with explanations payload", () => {
    const rows: PayrollPeriodsWithDetailsRow[] = [
      {
        payroll_period_id: "p1",
        period_month: "2026-07-01",
        pay_date: "2026-08-05",
        period_status: "draft",
        payroll_statement_id: "s1",
        staff_id: "u1",
        staff_display_name: "Staff 1",
        staff_employee_code: "EMP-01",
        work_units: 1,
        work_hours: 9,
        total_earnings_vnd: 500000,
        total_deductions_vnd: 0,
        payable_amount_vnd: 500000,
        payroll_line_item_id: "l1",
        line_type: "base_offline",
        line_direction: "earning",
        line_amount_vnd: 500000,
        unit_count: 1,
        unit_rate_vnd: 500000,
        note: "Base salary",
      },
    ];

    const periods = normalizePayrollPeriodsWithDetailsRows(rows);

    const payload = {
      lines: [
        {
          evidenceSnapshot: { test: true },
          formulaSnapshot: { rate: 300000 },
          id: "l1",
          policyCode: "base_offline",
          quantity: 1,
          sourceKind: "timekeeping",
          unitLabel: "ngày",
          workMinutes: 540,
        },
      ],
      periods: [
        {
          blockingIssueCount: 0,
          currentRevision: 2,
          feedbackClosedAt: null,
          feedbackOpenedAt: "2026-07-01T00:00:00Z",
          id: "p1",
          pendingCorrectionCount: 1,
        },
      ],
      statements: [
        {
          id: "s1",
          workMinutes: 540,
        },
      ],
    };

    const enriched = enrichPayrollPeriodsWithExplanations(periods, payload);
    expect(enriched[0].currentRevision).toBe(2);
    expect(enriched[0].pendingCorrectionCount).toBe(1);
    expect(enriched[0].statements[0].workMinutes).toBe(540);
    expect(enriched[0].statements[0].lines[0].unitLabel).toBe("ngày");
    expect(enriched[0].statements[0].lines[0].formulaSnapshot).toEqual({ rate: 300000 });
  });

  it("throws when explanations payload is invalid", () => {
    expect(() => enrichPayrollPeriodsWithExplanations([], { invalid: true })).toThrow(
      "PAYROLL_EXPLANATIONS_INVALID",
    );
  });
});
