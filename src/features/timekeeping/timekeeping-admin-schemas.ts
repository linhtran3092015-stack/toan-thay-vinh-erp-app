import { z } from "zod";

export const adminAdjustTimeEntrySchema = z
  .object({
    checkInAt: z.string().min(1, "Thời điểm vào là bắt buộc."),
    checkOutAt: z.string().min(1, "Thời điểm ra là bắt buộc."),
    mode: z.enum(["online", "offline"]).optional(),
    reason: z
      .string()
      .trim()
      .min(1, "Lý do điều chỉnh không được để trống.")
      .max(500, "Lý do tối đa 500 ký tự."),
    timeEntryId: z.string().uuid("ID lượt chấm công không hợp lệ."),
  })
  .refine(
    (data) => {
      const checkIn = new Date(data.checkInAt).getTime();
      const checkOut = new Date(data.checkOutAt).getTime();
      return !Number.isNaN(checkIn) && !Number.isNaN(checkOut) && checkOut >= checkIn;
    },
    {
      message: "Thời điểm ra phải sau hoặc bằng thời điểm vào.",
      path: ["checkOutAt"],
    },
  );

export type AdminAdjustTimeEntryInput = z.infer<typeof adminAdjustTimeEntrySchema>;

export const adminCreateTimeEntrySchema = z
  .object({
    checkInAt: z.string().min(1, "Thời điểm vào là bắt buộc."),
    checkOutAt: z.string().min(1, "Thời điểm ra là bắt buộc."),
    mode: z.enum(["online", "offline"]).default("offline"),
    notes: z
      .string()
      .trim()
      .max(500, "Ghi chú tối đa 500 ký tự.")
      .optional()
      .default("Chủ trung tâm bổ sung công bù"),
    staffId: z.string().uuid("ID nhân sự không hợp lệ."),
    workDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày làm việc phải có định dạng YYYY-MM-DD."),
  })
  .refine(
    (data) => {
      const checkIn = new Date(data.checkInAt).getTime();
      const checkOut = new Date(data.checkOutAt).getTime();
      return !Number.isNaN(checkIn) && !Number.isNaN(checkOut) && checkOut >= checkIn;
    },
    {
      message: "Thời điểm ra phải sau hoặc bằng thời điểm vào.",
      path: ["checkOutAt"],
    },
  );

export type AdminCreateTimeEntryInput = z.infer<typeof adminCreateTimeEntrySchema>;

export const adminDeleteTimeEntrySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Lý do xóa không được để trống.")
    .max(500, "Lý do tối đa 500 ký tự."),
  timeEntryId: z.string().uuid("ID lượt chấm công không hợp lệ."),
});

export type AdminDeleteTimeEntryInput = z.infer<typeof adminDeleteTimeEntrySchema>;
