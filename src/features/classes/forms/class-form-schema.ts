import { z } from "zod";

const uuidSchema = z
  .string()
  .trim()
  .uuid("Mã dữ liệu không hợp lệ.");

const reasonSchema = z
  .string()
  .trim()
  .min(1, "Bắt buộc nhập lý do thao tác.")
  .max(2000, "Lý do thao tác quá dài.");

const optionalUrlSchema = z
  .string()
  .trim()
  .max(2000, "Đường dẫn quá dài.")
  .refine(
    (value) =>
      value === "" ||
      z.url().safeParse(value).success,
    "Đường dẫn ClassIn chưa đúng định dạng.",
  );

export const classFormSchema = z.object({
  academicYearId: uuidSchema,

  classinUrl: optionalUrlSchema,

  code: z
    .string()
    .trim()
    .min(1, "Mã lớp không được để trống.")
    .max(100, "Mã lớp quá dài.")
    .regex(
      /^[A-Z0-9._-]+$/,
      "Mã lớp chỉ gồm chữ in hoa, số và các dấu . _ -.",
    ),

  defaultLearningMode: z.enum([
    "online",
    "offline",
    "hybrid",
  ]),

  grade: z
    .number()
    .int("Khối phải là số nguyên.")
    .min(1, "Khối phải từ 1 đến 12.")
    .max(12, "Khối phải từ 1 đến 12."),

  level: z.enum(["A", "B", "CLC"]),

  name: z
    .string()
    .trim()
    .min(1, "Tên lớp không được để trống.")
    .max(200, "Tên lớp quá dài."),

  notes: z
    .string()
    .trim()
    .max(10000, "Ghi chú quá dài."),

  weeklySessionCount: z
    .number()
    .int("Số buổi mỗi tuần phải là số nguyên.")
    .min(
      1,
      "Số buổi mỗi tuần phải từ 1 đến 7.",
    )
    .max(
      7,
      "Số buổi mỗi tuần phải từ 1 đến 7.",
    ),
});

export const createClassSchema =
  classFormSchema;

export const updateClassSchema =
  classFormSchema.extend({
    classId: uuidSchema,
    reason: reasonSchema,
  });

export const changeClassStatusSchema =
  z.object({
    classId: uuidSchema,

    reason: reasonSchema,

    targetStatus: z.enum([
      "active",
      "closed",
      "archived",
    ]),
  });

export type ClassFormValues = z.infer<
  typeof classFormSchema
>;

export type UpdateClassValues = z.infer<
  typeof updateClassSchema
>;

export type ChangeClassStatusValues =
  z.infer<typeof changeClassStatusSchema>;
