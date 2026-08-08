export interface EnrollmentFieldSpec {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  description: string;
}

export const ENROLLMENT_IMPORT_FIELDS: EnrollmentFieldSpec[] = [
  {
    key: "student_public_code",
    label: "Mã học viên",
    required: true,
    aliases: ["Mã học viên *", "Mã học viên", "Mã HV", "Student Public Code"],
    description: "Mã công khai duy nhất của học viên (ví dụ: TV-2026-00012)",
  },
  {
    key: "class_code",
    label: "Mã lớp",
    required: true,
    aliases: ["Mã lớp *", "Mã lớp", "Lớp", "Class Code"],
    description: "Mã lớp học active trong năm học (ví dụ: 12B1, 8A1)",
  },
  {
    key: "registered_mode",
    label: "Hình thức học",
    required: true,
    aliases: ["Hình thức *", "Hình thức", "Hình thức học", "Mode"],
    description: "Hình thức đăng ký học (chấp nhận: online hoặc offline)",
  },
  {
    key: "effective_from",
    label: "Hiệu lực từ",
    required: true,
    aliases: ["Hiệu lực từ *", "Hiệu lực từ", "Ngày bắt đầu", "Effective From"],
    description: "Ngày bắt đầu hiệu lực ghi danh (định dạng YYYY-MM-DD)",
  },
];
