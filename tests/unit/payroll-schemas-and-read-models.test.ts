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
import type { PayrollLineRead } from "@/features/payroll/read-models";
import {
  getEvidenceDetails,
  getLineFormulaSummary,
  getLineInputSummary,
  getLineRateSummary,
} from "@/features/payroll/payroll-presentation";

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

describe("Payroll payslip presentation", () => {
  const line = (overrides: Partial<PayrollLineRead>): PayrollLineRead => ({
    amountVnd: 1_000,
    direction: "earning",
    evidenceSnapshot: {},
    formulaSnapshot: {},
    id: "line-1",
    lineType: "manual_reward",
    note: null,
    payrollStatementId: "statement-1",
    policyCode: null,
    quantity: null,
    sourceKind: null,
    unitCount: null,
    unitLabel: null,
    unitRateVnd: null,
    workMinutes: null,
    ...overrides,
  });

  it("renders actual attendance metadata as a Vietnamese calculation", () => {
    const attendance = line({
      amountVnd: 7_838_333,
      formulaSnapshot: {
        daily_rate_vnd: 900_000,
        minutes_per_day: 540,
        mode_basis_points: 10_000,
        worked_minutes: 4_703,
      },
      lineType: "base_offline",
      workMinutes: 4_703,
    });

    expect(getLineInputSummary(attendance)).toBe("78 giờ 23 phút trên chuẩn 9 giờ");
    expect(getLineRateSummary(attendance)).toBe("900.000 VND/ngày");
    expect(getLineFormulaSummary(attendance)).toBe(
      "78 giờ 23 phút / 9 giờ × 900.000 VND = 7.838.333 VND",
    );
  });

  it("renders grading pool and revenue percentage formulas from snapshots", () => {
    const grading = line({
      amountVnd: 5_300_000,
      formulaSnapshot: {
        monthly_pool_vnd: 10_000_000,
        staff_credits: 530,
        total_credits: 1_000,
      },
      lineType: "grading_bonus",
      quantity: 530,
      unitLabel: "bài",
    });
    const revenue = line({
      amountVnd: 4_000_000,
      formulaSnapshot: { rate_basis_points: 400, revenue_vnd: 100_000_000 },
      lineType: "commission",
    });

    expect(getLineFormulaSummary(grading)).toBe(
      "530 phiếu / 1.000 phiếu × 10.000.000 VND = 5.300.000 VND",
    );
    expect(getLineFormulaSummary(revenue)).toBe(
      "100.000.000 VND × 4% = 4.000.000 VND",
    );
  });

  it("turns evidence metadata into concrete source details", () => {
    const evidence = line({
      evidenceSnapshot: {
        grade: 8,
        order_value_vnd: 12_000_000,
        source_code: "facebook",
      },
    });

    expect(getEvidenceDetails(evidence)).toEqual([
      { label: "Khối lớp", value: "8" },
      { label: "Giá trị đơn hàng", value: "12.000.000 VND" },
      { label: "Mã nguồn tuyển sinh", value: "facebook" },
    ]);
  });

  it("keeps fixed-source and record-excess policies distinct from simple revenue formulas", () => {
    const fixedSource = line({
      amountVnd: 300_000,
      evidenceSnapshot: { source_code: "facebook" },
      formulaSnapshot: { fixed_by_source: { facebook: 300_000 } },
      lineType: "new_student_fixed_bonus",
      quantity: 1,
      unitLabel: "đơn",
      unitRateVnd: 12_000_000,
    });
    const recordExcess = line({
      amountVnd: 2_000_000,
      evidenceSnapshot: { center_renewal_revenue_vnd: 120_000_000 },
      formulaSnapshot: { rate_basis_points: 1_000, record_revenue_vnd: 100_000_000 },
      lineType: "record_excess_bonus",
    });

    expect(getLineFormulaSummary(fixedSource)).toBe("1 đơn × 300.000 VND = 300.000 VND");
    expect(getLineRateSummary(fixedSource)).toBe("300.000 VND/đơn");
    expect(getLineFormulaSummary(recordExcess)).toBe(
      "(120.000.000 VND − 100.000.000 VND) × 10% = 2.000.000 VND",
    );
  });

  // Value: protects=the payslip dialog's "Dữ liệu đầu vào" and "Công thức tính" cells for the piecework offset read from both snapshot shapes (live estimate / current runs: `basis_points`; runs from migration 20260915170000: `base_floor_basis_points`) and never show the engine's "Bù trừ…" note;
  // fails_when=the `basis_points` key is dropped (the formula falls back to "Bù trừ lương khoán đến ngưỡng 85% lương cứng. = …", the penalty wording this change removes), the old key stops working, or the offset's input summary loses the lương khoán / lương cứng figures;
  // why_new=no presentation test covers a piecework_offset line;
  // seam=none (pure functions); no_claim=does not cover an offset whose snapshot lacks these keys (the formula then falls back to the raw note)
  it("explains the piecework offset from either snapshot shape without the engine's offset note", () => {
    const offset = (formulaSnapshot: Record<string, unknown>) => line({
      amountVnd: 900_000,
      direction: "deduction",
      formulaSnapshot,
      lineType: "piecework_offset",
      note: "Bù trừ lương khoán đến ngưỡng 85% lương cứng.",
    });
    const live = offset({ base_salary_vnd: 1_500_000, basis_points: 8_500, piecework_vnd: 900_000 });
    const run = offset({ base_floor_basis_points: 8_500, base_salary_vnd: 1_500_000, offset_vnd: 900_000, piecework_vnd: 900_000 });

    for (const snapshotLine of [live, run]) {
      expect(getLineFormulaSummary(snapshotLine)).toBe(
        "Mức thấp hơn giữa lương khoán 900.000 VND và 1.500.000 VND × 85% = 900.000 VND",
      );
      expect(getLineInputSummary(snapshotLine)).toBe("Lương khoán 900.000 VND, lương cứng 1.500.000 VND");
    }
    // Without the figures the input cell explains the offset instead of echoing the engine's note.
    expect(getLineInputSummary(offset({}))).toBe("Không phải khoản bị trừ: phần lương khoán này đã được trả trong lương cứng.");
  });
});
