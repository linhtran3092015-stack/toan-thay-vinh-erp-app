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
