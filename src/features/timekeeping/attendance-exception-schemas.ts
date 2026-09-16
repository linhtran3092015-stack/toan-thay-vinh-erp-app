import { z } from "zod";

export const attendanceExceptionRequestSchema = z.object({
  operation: z.enum(["check-in", "check-out"]),
  reason: z.string().trim().min(1, "Vui lòng nêu lý do cần duyệt.").max(2000),
  requestId: z.string().uuid(),
  timeEntryId: z.string().uuid().nullable(),
}).refine((input) => input.operation !== "check-out" || input.timeEntryId !== null, {
  message: "Không tìm thấy ca đang mở. Vui lòng tải lại trang.",
  path: ["timeEntryId"],
});

export const attendanceExceptionDecisionSchema = z.object({
  timeEntryId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(1, "Vui lòng ghi lý do quyết định.").max(2000),
});

export const attendanceExceptionReviewSchema = z.object({
  id: z.string().uuid(),
  staff_id: z.string().uuid(),
  staff_name: z.string().nullable(),
  check_in_at: z.string(),
  check_out_at: z.string().nullable(),
  work_date: z.string(),
  entry_status: z.enum(["open", "checked_out", "auto_ended"]),
  status: z.enum(["pending", "approved", "rejected"]),
  check_in_reason: z.string().nullable(),
  check_out_reason: z.string().nullable(),
  requested_at: z.string(),
  decision_reason: z.string().nullable(),
  has_check_in_gps: z.boolean(),
  has_check_out_gps: z.boolean(),
});

export type AttendanceExceptionReview = z.infer<typeof attendanceExceptionReviewSchema>;
