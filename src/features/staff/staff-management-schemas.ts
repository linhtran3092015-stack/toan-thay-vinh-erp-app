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
  offlineHourlyRateVnd: z
    .number()
    .int("Đơn giá phải là số nguyên.")
    .nonnegative("Đơn giá không thể âm.")
    .refine(
      (value) => value % 2 === 0,
      "Đơn giá offline phải là số chẵn để tính đúng mức online 50%.",
    ),
  reason: z
    .string()
    .trim()
    .min(1, "Bắt buộc nhập lý do thêm phiên bản đơn giá.")
    .max(2000, "Lý do tối đa 2.000 ký tự."),
  staffId: z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."),
});
