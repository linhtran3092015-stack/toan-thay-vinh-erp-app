import { z } from "zod";

export const createPayrollDraftSchema = z.object({
  periodMonth: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, "Kỳ lương phải là tháng dương lịch hợp lệ."),
});

export const addPayrollManualLineSchema = z.object({
  amountVnd: z
    .number()
    .int("Số tiền phải là số nguyên VND.")
    .positive("Số tiền phải lớn hơn 0."),
  lineType: z.enum(["manual_reward", "manual_deduction"]),
  note: z
    .string()
    .trim()
    .min(1, "Cần nêu nội dung thưởng hoặc khấu trừ.")
    .max(2000, "Nội dung tối đa 2.000 ký tự."),
  payrollStatementId: z.string().uuid("Bảng lương nhân sự không hợp lệ."),
});

export const payrollPeriodActionSchema = z.object({
  payrollPeriodId: z.string().uuid("Kỳ lương không hợp lệ."),
});

export const recalculatePayrollSchema = payrollPeriodActionSchema.extend({
  reason: z.string().trim().min(1, "Bắt buộc nhập lý do tính lại.").max(2000),
});

export const resetPayrollDraftSchema = payrollPeriodActionSchema.extend({
  confirmation: z.string().trim().min(1, "Bắt buộc nhập câu xác nhận."),
  expectedRevision: z.number().int().positive("Phiên bản tính lương không hợp lệ."),
  reason: z.string().trim().min(1, "Bắt buộc nhập lý do đặt lại.").max(2000),
});

export const submitPayrollCorrectionSchema = z.object({
  evidenceUrl: z.union([
    z.literal(""),
    z.string().url("Liên kết bằng chứng không hợp lệ."),
  ]),
  itemLabel: z.string().trim().min(1, "Bắt buộc nhập khoản cần kiểm tra.").max(240),
  payrollLineItemId: z.string().uuid().nullable(),
  payrollStatementId: z.string().uuid("Bảng lương không hợp lệ."),
  requestMessage: z.string().trim().min(1, "Bắt buộc mô tả vấn đề.").max(4000),
  requestedChange: z.string().trim().min(1, "Bắt buộc nêu kết quả mong muốn.").max(4000),
});

export const resolvePayrollCorrectionSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  requestId: z.string().uuid("Yêu cầu điều chỉnh không hợp lệ."),
  responseMessage: z.string().trim().min(1, "Bắt buộc nhập nội dung phản hồi.").max(4000),
});

const payrollImportRowSchema = z.object({
  conflictPayload: z.record(z.string(), z.unknown()).nullable(),
  normalizedPayload: z.record(z.string(), z.unknown()),
  rawPayload: z.record(z.string(), z.unknown()),
  rowNumber: z.number().int().positive(),
  sourceKey: z.string().trim().min(1).max(240),
  validationErrors: z.array(z.string().max(500)),
  validationStatus: z.enum(["valid", "error", "conflict"]),
});

export const createPayrollImportBatchSchema = z.object({
  datasetType: z.enum(["timekeeping", "grading", "renewal_orders", "new_enrollment_orders"]),
  fileName: z.string().trim().min(1).max(255),
  fileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  periodMonth: z.string().regex(/^\d{4}-\d{2}-01$/),
  rows: z.array(payrollImportRowSchema).min(1).max(5000),
});

export const decidePayrollImportBatchSchema = z.object({
  batchId: z.string().uuid("Lần nhập dữ liệu không hợp lệ."),
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().min(1, "Bắt buộc nhập nội dung phản hồi.").max(2000),
});
