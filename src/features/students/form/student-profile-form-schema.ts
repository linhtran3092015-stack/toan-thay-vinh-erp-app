import { z } from "zod";

const currentYear = new Date().getFullYear();

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s.-]/g, "");

  if (compact.startsWith("+84")) {
    return `0${compact.slice(3)}`;
  }

  if (compact.startsWith("84")) {
    return `0${compact.slice(2)}`;
  }

  return compact;
}

export const studentProfileFormSchema = z.object({
  birthYear: z
    .number()
    .int("Năm sinh phải là số nguyên.")
    .min(1990, "Năm sinh chưa hợp lệ.")
    .max(currentYear, "Năm sinh không được lớn hơn năm hiện tại."),

  currentGrade: z
    .number()
    .int("Khối phải là số nguyên.")
    .min(1, "Khối phải từ 1 đến 12.")
    .max(12, "Khối phải từ 1 đến 12."),

  duplicateOverrideReason: z
    .string()
    .trim()
    .max(2000, "Lý do xử lý trùng quá dài."),

  fullName: z
    .string()
    .trim()
    .min(1, "Họ và tên học viên không được để trống.")
    .max(200, "Họ và tên học viên quá dài."),

  guardianEmail: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Email phụ huynh chưa đúng định dạng.",
    ),

  guardianFullName: z
    .string()
    .trim()
    .min(1, "Họ tên phụ huynh không được để trống.")
    .max(200, "Họ tên phụ huynh quá dài."),

  guardianNote: z
    .string()
    .trim()
    .max(5000, "Ghi chú phụ huynh quá dài."),

  guardianPhone: z
    .string()
    .trim()
    .min(1, "Số điện thoại phụ huynh là bắt buộc.")
    .refine(
      (value) =>
        /^0(3|5|7|8|9)\d{8}$/.test(normalizePhone(value)),
      "Số điện thoại cần là số di động Việt Nam hợp lệ.",
    ),

  guardianRelationship: z
    .string()
    .trim()
    .min(1, "Quan hệ với học sinh là bắt buộc.")
    .max(100, "Thông tin quan hệ quá dài."),

  guardianZalo: z
    .string()
    .trim()
    .max(200, "Thông tin Zalo quá dài."),

  internalNote: z
    .string()
    .trim()
    .max(10000, "Ghi chú nội bộ quá dài."),

  learningGoal: z
    .string()
    .trim()
    .max(5000, "Mục tiêu học tập quá dài."),

  learningLevel: z.enum(["A", "B", "CLC"]),

  nickname: z
    .string()
    .trim()
    .max(100, "Tên thường gọi quá dài."),

  provinceName: z
    .string()
    .trim()
    .max(200, "Tên tỉnh/thành phố quá dài."),

  publicCode: z.string().trim(),

  reason: z
    .string()
    .trim()
    .min(1, "Bắt buộc nhập lý do tạo hoặc cập nhật hồ sơ.")
    .max(2000, "Lý do thao tác quá dài."),

  registeredMode: z.enum(["online", "offline"]),

  studentId: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        z.string().uuid().safeParse(value).success,
      "Mã học viên không hợp lệ.",
    ),
});

export type StudentProfileFormValues = z.infer<
  typeof studentProfileFormSchema
>;

export function normalizeStudentProfilePhone(
  value: string,
): string {
  return normalizePhone(value);
}
