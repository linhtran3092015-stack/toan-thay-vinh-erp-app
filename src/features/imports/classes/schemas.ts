import { z } from "zod";

export const classImportRowInputSchema = z.object({
  academic_year_code: z.string().trim().min(1, "Mã năm học không được để trống"),
  class_code: z.string().trim().min(1, "Mã lớp không được để trống"),
  class_name: z.string().trim().min(1, "Tên lớp không được để trống"),
  default_learning_mode: z.string().trim().default("hybrid"),
  grade: z.coerce.number().int().min(1).max(12),
  level: z.string().trim().toUpperCase(),
  source_row_number: z.number().int().positive(),
  status: z.string().trim().default("active"),
  weekly_session_count: z.coerce.number().int().min(1).max(7).default(2),
});

export const scheduleImportRowInputSchema = z.object({
  class_code: z.string().trim().min(1, "Mã lớp không được để trống"),
  component_code: z.string().trim().min(1, "Mã thành phần không được để trống"),
  effective_from: z.string().trim().min(1, "Ngày hiệu lực không được để trống"),
  effective_to: z.string().trim().nullable().optional(),
  end_time: z.string().trim().min(1, "Giờ kết thúc không được để trống"),
  learning_mode: z.string().trim().default("hybrid"),
  meeting_url: z.string().trim().nullable().optional(),
  room_name: z.string().trim().nullable().optional(),
  source_row_number: z.number().int().positive(),
  start_time: z.string().trim().min(1, "Giờ bắt đầu không được để trống"),
  weekday: z.coerce.number().int().min(1).max(7),
});

export const dryRunClassScheduleImportSchema = z.object({
  academic_year_code: z.string().trim().min(1, "Mã năm học là bắt buộc"),
  classes: z.array(classImportRowInputSchema).min(1, "Yêu cầu ít nhất 1 dòng lớp học"),
  schedules: z.array(scheduleImportRowInputSchema).min(1, "Yêu cầu ít nhất 1 dòng lịch học"),
});

export type DryRunClassScheduleImportSchemaInput = z.infer<
  typeof dryRunClassScheduleImportSchema
>;

export const createClassScheduleImportBatchSchema = z.object({
  academic_year_code: z.string().trim().min(1, "Mã năm học là bắt buộc"),
  classes: z.array(classImportRowInputSchema).min(1, "Yêu cầu ít nhất 1 dòng lớp học"),
  explicit_confirmation: z
    .boolean()
    .refine((val) => val === true, "Bạn phải đánh dấu xác nhận trước khi tạo batch"),
  reason: z.string().trim().min(1, "Lý do tạo batch không được để trống"),
  schedules: z.array(scheduleImportRowInputSchema).min(1, "Yêu cầu ít nhất 1 dòng lịch học"),
  source_filename: z.string().trim().min(1, "Tên file gốc không được để trống"),
  source_sha256: z.string().trim().min(1, "SHA-256 không được để trống"),
});

export type CreateClassScheduleImportBatchSchemaInput = z.infer<
  typeof createClassScheduleImportBatchSchema
>;

export const commitClassScheduleImportBatchSchema = z.object({
  batch_id: z.string().uuid("Mã Batch không đúng định dạng UUID"),
  confirmation_checked: z
    .boolean()
    .refine((val) => val === true, "Bạn phải xác nhận đã kiểm tra batch trước khi import"),
  confirmation_text: z
    .string()
    .trim()
    .refine(
      (val) => val === "IMPORT LOP LICH",
      "Văn bản xác nhận phải nhập chính xác: IMPORT LOP LICH"
    ),
  reason: z.string().trim().min(1, "Lý do import không được để trống"),
});

export type CommitClassScheduleImportBatchSchemaInput = z.infer<
  typeof commitClassScheduleImportBatchSchema
>;
