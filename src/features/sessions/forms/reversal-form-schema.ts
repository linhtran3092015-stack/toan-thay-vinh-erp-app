import { z } from "zod";

export const reverseSessionChargeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Lý do hoàn buổi phải có ít nhất 3 ký tự.")
    .max(500, "Lý do hoàn buổi không được vượt quá 500 ký tự."),

  sessionAttendanceId: z
    .string()
    .uuid("Mã lượt điểm danh không hợp lệ."),
});
