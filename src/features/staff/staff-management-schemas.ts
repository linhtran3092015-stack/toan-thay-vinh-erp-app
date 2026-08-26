import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.")
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()),
    "Ngày không hợp lệ.",
  );

const optionalDateStringSchema = z.union([
  z.literal(""),
  dateStringSchema,
]);

export const updateStaffProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .max(160, "Tên hiển thị tối đa 160 ký tự."),
    employeeCode: z
      .string()
      .trim()
      .max(64, "Mã nhân sự tối đa 64 ký tự.")
      .refine(
        (value) => value === "" || /^[A-Za-z0-9._-]+$/.test(value),
        "Mã nhân sự chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.",
      ),
    employmentStatus: z.enum(["active", "inactive", "suspended"]),
    joinedAt: optionalDateStringSchema,
    leftAt: optionalDateStringSchema,
    phone: z
      .string()
      .trim()
      .max(32, "Số điện thoại tối đa 32 ký tự.")
      .refine(
        (value) => value === "" || /^[0-9+(). -]{7,32}$/.test(value),
        "Số điện thoại không hợp lệ.",
      ),
    reason: z
      .string()
      .trim()
      .min(1, "Bắt buộc nhập lý do cập nhật.")
      .max(2000, "Lý do tối đa 2.000 ký tự."),
    staffId: z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."),
  })
  .superRefine((value, context) => {
    if (value.employmentStatus === "inactive" && !value.leftAt) {
      context.addIssue({
        code: "custom",
        message: "Cần nhập ngày nghỉ khi nhân sự đã nghỉ.",
        path: ["leftAt"],
      });
    }

    if (value.employmentStatus !== "inactive" && value.leftAt) {
      context.addIssue({
        code: "custom",
        message: "Chỉ nhập ngày nghỉ khi trạng thái là Đã nghỉ.",
        path: ["leftAt"],
      });
    }

    if (value.joinedAt && value.leftAt && value.leftAt < value.joinedAt) {
      context.addIssue({
        code: "custom",
        message: "Ngày nghỉ không thể trước ngày vào làm.",
        path: ["leftAt"],
      });
    }
  });

export const createStaffRateVersionSchema = z.object({
  effectiveFrom: dateStringSchema,
  note: z
    .string()
    .trim()
    .max(1000, "Ghi chú tối đa 1.000 ký tự."),
  offlineDailyRateVnd: z
    .number()
    .int("Mức lương ngày phải là số nguyên.")
    .nonnegative("Mức lương ngày không thể âm."),
  reason: z
    .string()
    .trim()
    .min(1, "Bắt buộc nhập lý do thêm phiên bản đơn giá.")
    .max(2000, "Lý do tối đa 2.000 ký tự."),
  staffId: z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."),
});

export const configureStaffPayrollCompensationSchema =
  createStaffRateVersionSchema.extend({
    positionCode: z.enum([
      "teaching_assistant",
      "operations_assistant",
      "admissions_manager",
    ]),
  });

export const createStaffGradeAssignmentSchema = z
  .object({
    effectiveFrom: dateStringSchema,
    effectiveTo: optionalDateStringSchema,
    grade: z.number().int().min(2).max(12),
    reason: z.string().trim().min(1, "Bắt buộc nhập lý do.").max(2000),
    staffId: z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."),
  })
  .refine(
    (value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom,
    { message: "Ngày kết thúc không thể trước ngày bắt đầu.", path: ["effectiveTo"] },
  );

export const createStaffPayrollTaskVersionSchema = z.object({
  effectiveFrom: dateStringSchema,
  isEnabled: z.boolean(),
  reason: z.string().trim().min(1, "Bắt buộc nhập lý do.").max(2000),
  staffId: z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."),
  taskCode: z.enum([
    "center_renewal_duty",
    "record_excess",
    "payroll_processing",
    "staff_recruitment_care",
    "student_coaching",
    "daily_admin_reporting",
    "addon_product_sales",
  ]),
});

export const submitStaffBankAccountChangeSchema = z.object({
  accountHolderName: z.string().trim().min(1, "Bắt buộc nhập chủ tài khoản.").max(160),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9.-]{4,40}$/, "Số tài khoản không hợp lệ."),
  bankName: z.string().trim().min(1, "Bắt buộc nhập ngân hàng.").max(160),
  effectiveFrom: dateStringSchema,
  reason: z.string().trim().min(1, "Bắt buộc nhập lý do.").max(2000),
  staffId: z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."),
});

export const decideStaffBankAccountChangeSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  requestId: z.string().uuid("Yêu cầu ngân hàng không hợp lệ."),
  reviewNote: z.string().trim().min(1, "Bắt buộc nhập nội dung phản hồi.").max(2000),
  staffId: z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."),
});
