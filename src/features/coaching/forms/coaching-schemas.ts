import { z } from "zod";

const uuidSchema = z.string().trim().uuid("Mã dữ liệu không hợp lệ.");

const optionalDateSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(new Date(`${value}T00:00:00`).getTime())),
    "Ngày xem lại không hợp lệ.",
  );

export const createCoachingRecordSchema = z.object({
  assistantOwnerId: uuidSchema,
  campaignName: z
    .string()
    .trim()
    .min(1, "Tên đợt coaching không được để trống.")
    .max(240, "Tên đợt coaching tối đa 240 ký tự."),
  priority: z.enum(["low", "medium", "high"]),
  reason: z
    .string()
    .trim()
    .min(1, "Bắt buộc nhập lý do theo dõi.")
    .max(4000, "Lý do theo dõi tối đa 4.000 ký tự."),
  reviewAt: optionalDateSchema,
  studentId: uuidSchema,
});

export const addCoachingNoteSchema = z.object({
  coachingRecordId: uuidSchema,
  note: z
    .string()
    .trim()
    .min(1, "Ghi chú không được để trống.")
    .max(4000, "Ghi chú tối đa 4.000 ký tự."),
});

export const advanceCoachingStatusSchema = z
  .object({
    coachingRecordId: uuidSchema,
    note: z.string().trim().max(4000, "Ghi chú tối đa 4.000 ký tự."),
    outcome: z.string().trim().max(4000, "Kết quả tối đa 4.000 ký tự."),
    targetStatus: z.enum(["in_progress", "closed"]),
  })
  .superRefine((value, context) => {
    if (value.targetStatus === "in_progress" && !value.note) {
      context.addIssue({
        code: "custom",
        message: "Bắt buộc ghi nội dung bắt đầu xử lý.",
        path: ["note"],
      });
    }

    if (value.targetStatus === "closed" && !value.outcome) {
      context.addIssue({
        code: "custom",
        message: "Bắt buộc ghi kết quả trước khi đóng phiếu.",
        path: ["outcome"],
      });
    }
  });
