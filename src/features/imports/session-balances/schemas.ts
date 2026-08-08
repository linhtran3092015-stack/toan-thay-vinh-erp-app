import { z } from "zod";

const sessionBalanceImportCellValueSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
]);

export const sessionBalanceImportRowInputSchema = z
  .object({
    row_number: z.number().int().positive().optional(),
    source_balance: sessionBalanceImportCellValueSchema.optional(),
    source_student_name: sessionBalanceImportCellValueSchema.optional(),
    student_public_code: sessionBalanceImportCellValueSchema.optional(),
  })
  .strip();

export const dryRunSessionBalanceImportInputSchema = z.object({
  effective_on: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày hiệu lực không đúng định dạng YYYY-MM-DD."),
  rows: z
    .array(sessionBalanceImportRowInputSchema)
    .min(1, "File import phải có ít nhất một dòng dữ liệu.")
    .max(5000, "Mỗi lần chỉ được kiểm tra tối đa 5.000 dòng."),
});

export const sessionBalanceImportRowResultSchema = z
  .object({
    current_balance_before: z.number().int().nullable(),
    delta_sessions: z.number().int().nullable(),
    expected_balance_after: z.number().int().nullable(),
    source_balance: z.number().nullable(),
    source_row_number: z.number().int().positive(),
    source_student_name: z.string().nullable(),
    student_enrollment_id: z.string().uuid().nullable(),
    student_id: z.string().uuid().nullable(),
    student_public_code: z.string().nullable(),
    validation_code: z.string().nullable(),
    validation_message: z.string().nullable(),
    validation_status: z.enum([
      "valid",
      "review",
      "invalid",
      "no_change",
    ]),
  })
  .passthrough();

export const sessionBalanceImportSummarySchema = z
  .object({
    invalid: z.number().int().nonnegative(),
    no_change: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    valid: z.number().int().nonnegative(),
  })
  .passthrough();

export const dryRunSessionBalanceImportResultSchema = z
  .object({
    rows: z.array(sessionBalanceImportRowResultSchema),
    summary: sessionBalanceImportSummarySchema,
  })
  .passthrough();

export const createSessionBalanceImportBatchInputSchema = z.object({
  effectiveOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày hiệu lực không đúng định dạng YYYY-MM-DD."),
  reason: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập lý do tạo batch.")
    .max(2000, "Lý do không được vượt quá 2.000 ký tự."),
  rows: z
    .array(sessionBalanceImportRowInputSchema)
    .min(1, "File import phải có ít nhất một dòng dữ liệu.")
    .max(5000, "Mỗi lần chỉ được tạo batch tối đa 5.000 dòng."),
  sourceFilename: z
    .string()
    .trim()
    .min(1, "Thiếu tên file nguồn.")
    .max(255, "Tên file không được vượt quá 255 ký tự."),
  sourceSha256: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{64}$/, "SHA-256 không hợp lệ."),
});

export const excludeSessionBalanceImportRowInputSchema = z.object({
  excludedReason: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập lý do loại dòng khỏi batch.")
    .max(2000, "Lý do loại không được vượt quá 2.000 ký tự."),
  rowId: z.string().uuid("ID dòng không hợp lệ."),
});

export const reconcileSessionBalanceImportBatchInputSchema = z.object({
  batchId: z.string().uuid("ID batch không hợp lệ."),
  reason: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập lý do hoàn tất đối soát.")
    .max(2000, "Lý do không được vượt quá 2.000 ký tự."),
});

export const approveSessionBalanceImportBatchInputSchema = z.object({
  batchId: z.string().uuid("ID batch không hợp lệ."),
});

export const postSessionBalanceImportBatchInputSchema = z.object({
  batchId: z.string().uuid("ID batch không hợp lệ."),
  confirmationText: z
    .string()
    .trim()
    .refine(
      (val) => val === "GHI SO DU",
      "Vui lòng nhập chính xác cụm từ 'GHI SO DU' để xác nhận ghi sổ.",
    ),
  confirmedCheck: z
    .boolean()
    .refine((val) => val === true, "Bạn phải tích xác nhận trước khi ghi sổ."),
});
