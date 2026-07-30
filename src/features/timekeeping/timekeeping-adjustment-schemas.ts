import { z } from "zod";

const timeEntryModeSchema = z.enum(["online", "offline"]);
const timestampSchema = z.string().trim().datetime({ offset: true });

export const timekeepingAdjustmentRequestSchema = z
  .object({
    requestReason: z
      .string()
      .trim()
      .min(1, "Cần nêu lý do điều chỉnh.")
      .max(2000, "Lý do điều chỉnh tối đa 2.000 ký tự."),
    requestedCheckInAt: timestampSchema,
    requestedCheckInMode: timeEntryModeSchema,
    requestedCheckOutAt: timestampSchema,
    requestedCheckOutMode: timeEntryModeSchema,
    timeEntryId: z.string().uuid("Lượt chấm công không hợp lệ."),
  })
  .superRefine((value, context) => {
    if (new Date(value.requestedCheckOutAt) < new Date(value.requestedCheckInAt)) {
      context.addIssue({
        code: "custom",
        message: "Check-out phải sau hoặc bằng check-in.",
        path: ["requestedCheckOutAt"],
      });
    }
  });

export const timekeepingAdjustmentDecisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    decisionReason: z.string().trim().max(2000, "Ghi chú tối đa 2.000 ký tự."),
    requestId: z.string().uuid("Yêu cầu điều chỉnh không hợp lệ."),
  })
  .superRefine((value, context) => {
    if (value.decision === "rejected" && !value.decisionReason) {
      context.addIssue({
        code: "custom",
        message: "Cần nêu lý do từ chối.",
        path: ["decisionReason"],
      });
    }
  });
