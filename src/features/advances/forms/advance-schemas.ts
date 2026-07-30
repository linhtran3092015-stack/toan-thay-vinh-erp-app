import { z } from "zod";

const requiredNoteSchema = z
  .string()
  .trim()
  .min(1, "Cần nêu lý do hoặc nội dung.")
  .max(2000, "Nội dung tối đa 2.000 ký tự.");

const optionalNoteSchema = z
  .string()
  .trim()
  .max(2000, "Nội dung tối đa 2.000 ký tự.");

export const requestSalaryAdvanceSchema = z.object({
  amountVnd: z
    .number()
    .int("Số tiền phải là số nguyên VND.")
    .positive("Số tiền phải lớn hơn 0."),
  deductionPeriodMonth: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, "Kỳ khấu trừ phải là tháng dương lịch hợp lệ."),
  requestNote: requiredNoteSchema,
});

export const reviewSalaryAdvanceSchema = z.object({
  decision: z.enum(["rejected", "review"]),
  note: optionalNoteSchema,
  salaryAdvanceId: z.string().uuid("Yêu cầu tạm ứng không hợp lệ."),
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.note) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cần nêu lý do từ chối.",
      path: ["note"],
    });
  }
});

export const approveSalaryAdvanceSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: optionalNoteSchema,
  salaryAdvanceId: z.string().uuid("Yêu cầu tạm ứng không hợp lệ."),
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.note) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cần nêu lý do từ chối.",
      path: ["note"],
    });
  }
});
