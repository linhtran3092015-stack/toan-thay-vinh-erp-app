import { z } from "zod";

const studentImportCellValueSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
]);

export const studentImportRowInputSchema = z
  .object({
    birth_year: studentImportCellValueSchema.optional(),
    current_grade: studentImportCellValueSchema.optional(),
    guardian_email: studentImportCellValueSchema.optional(),
    guardian_full_name: studentImportCellValueSchema.optional(),
    guardian_notes: studentImportCellValueSchema.optional(),
    guardian_phone: studentImportCellValueSchema.optional(),
    guardian_relationship: studentImportCellValueSchema.optional(),
    guardian_zalo: studentImportCellValueSchema.optional(),
    internal_notes: studentImportCellValueSchema.optional(),
    learning_goal: studentImportCellValueSchema.optional(),
    learning_level: studentImportCellValueSchema.optional(),
    nickname: studentImportCellValueSchema.optional(),
    province_city: studentImportCellValueSchema.optional(),
    registered_mode: studentImportCellValueSchema.optional(),
    row_number: studentImportCellValueSchema.optional(),
    student_full_name: studentImportCellValueSchema.optional(),
  })
  .strip();

const studentImportRowsSchema = z
  .array(studentImportRowInputSchema)
  .min(1, "File import phải có ít nhất một dòng dữ liệu.")
  .max(500, "Mỗi lần chỉ được import tối đa 500 dòng.");

export const validateStudentImportInputSchema = z.object({
  rows: studentImportRowsSchema,
});

export const commitStudentImportInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Bắt buộc nhập lý do import.")
    .max(1500, "Lý do import không được vượt quá 1.500 ký tự."),

  rows: studentImportRowsSchema,

  sourceFilename: z
    .string()
    .trim()
    .min(1, "Thiếu tên file import.")
    .max(255, "Tên file không được vượt quá 255 ký tự.")
    .regex(
      /\.xlsx$/i,
      "Import học viên v1 chỉ nhận file .xlsx.",
    ),

  sourceSha256: z
    .string()
    .trim()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "SHA-256 của file không hợp lệ.",
    ),
});

const studentImportIssueSchema = z
  .object({
    code: z.string().min(1),
    field: z.string().nullable(),
    message: z.string().min(1),
  })
  .passthrough();

const studentImportNormalizedDataSchema = z
  .object({
    birth_year: z.number().int().nullable(),
    current_grade: z.number().int().nullable(),
    guardian_email: z.string().nullable(),
    guardian_full_name: z.string().nullable(),
    guardian_notes: z.string().nullable(),
    guardian_phone: z.string().nullable(),
    guardian_relationship: z.string().nullable(),
    guardian_zalo: z.string().nullable(),
    internal_notes: z.string().nullable(),
    learning_goal: z.string().nullable(),
    learning_level: z.string().nullable(),
    nickname: z.string().nullable(),
    province_city: z.string().nullable(),
    registered_mode: z.string().nullable(),
    student_full_name: z.string().nullable(),
  })
  .passthrough();

const studentImportValidationRowSchema = z
  .object({
    errors: z.array(studentImportIssueSchema),
    exact_student_duplicate: z.boolean(),
    existing_guardian_id: z.string().uuid().nullable(),
    guardian_reused: z.boolean(),
    normalized_data: studentImportNormalizedDataSchema,
    row_number: z.number().int().positive(),
    status: z.enum([
      "valid",
      "warning",
      "invalid",
    ]),
    warnings: z.array(studentImportIssueSchema),
  })
  .passthrough();

export const studentImportValidationResultSchema = z
  .object({
    invalid_count: z.number().int().nonnegative(),
    row_count: z.number().int().min(1).max(500),
    rows: z.array(studentImportValidationRowSchema),
    valid_count: z.number().int().nonnegative(),
    warning_count: z.number().int().nonnegative(),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.rows.length !== value.row_count) {
      context.addIssue({
        code: "custom",
        message:
          "Số dòng kết quả không khớp tổng số dòng import.",
        path: ["rows"],
      });
    }

    const classifiedCount =
      value.valid_count +
      value.warning_count +
      value.invalid_count;

    if (classifiedCount !== value.row_count) {
      context.addIssue({
        code: "custom",
        message:
          "Tổng số dòng hợp lệ, cảnh báo và lỗi không khớp.",
        path: ["row_count"],
      });
    }
  });

const studentImportCommitStudentSchema = z
  .object({
    guardian_id: z.string().uuid(),
    guardian_reused: z.boolean(),
    row_number: z.number().int().positive(),
    student_id: z.string().uuid(),
    student_public_code: z.string().min(1),
  })
  .passthrough();

export const studentImportCommitResultSchema = z
  .object({
    batch_id: z.string().uuid(),
    committed_at: z.string().min(1),
    committed_by: z.string().uuid(),
    guardian_created_count: z.number().int().nonnegative(),
    guardian_reused_count: z.number().int().nonnegative(),
    row_count: z.number().int().min(1).max(500),
    source_filename: z.string().min(1),
    source_sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/),
    student_count: z.number().int().min(1).max(500),
    students: z.array(studentImportCommitStudentSchema),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.row_count !== value.student_count) {
      context.addIssue({
        code: "custom",
        message:
          "Số học viên được tạo không khớp số dòng import.",
        path: ["student_count"],
      });
    }

    if (value.students.length !== value.student_count) {
      context.addIssue({
        code: "custom",
        message:
          "Danh sách học viên được tạo không đầy đủ.",
        path: ["students"],
      });
    }

    const guardianCount =
      value.guardian_created_count +
      value.guardian_reused_count;

    if (guardianCount !== value.student_count) {
      context.addIssue({
        code: "custom",
        message:
          "Tổng số phụ huynh tạo mới và dùng lại không khớp.",
        path: ["guardian_created_count"],
      });
    }
  });
