import type {
  StudentImportFieldDefinition,
  StudentImportFieldKey,
} from "@/features/imports/students/types";

export const STUDENT_IMPORT_FIELD_DEFINITIONS = [
  {
    key: "student_full_name",
    label: "Họ và tên học viên",
    required: true,
    templateHeader: "Họ và tên học viên *",
    width: 28,
  },
  {
    key: "nickname",
    label: "Tên thường gọi",
    required: false,
    templateHeader: "Tên thường gọi",
    width: 20,
  },
  {
    key: "birth_year",
    label: "Năm sinh",
    required: true,
    templateHeader: "Năm sinh *",
    width: 14,
  },
  {
    key: "province_city",
    label: "Tỉnh/Thành phố",
    required: false,
    templateHeader: "Tỉnh/Thành phố",
    width: 22,
  },
  {
    key: "current_grade",
    label: "Khối hiện tại",
    required: true,
    templateHeader: "Khối hiện tại *",
    width: 18,
  },
  {
    key: "learning_level",
    label: "Trình độ",
    required: false,
    templateHeader: "Trình độ",
    width: 16,
  },
  {
    key: "registered_mode",
    label: "Hình thức học",
    required: false,
    templateHeader: "Hình thức học",
    width: 18,
  },
  {
    key: "learning_goal",
    label: "Mục tiêu học tập",
    required: false,
    templateHeader: "Mục tiêu học tập",
    width: 30,
  },
  {
    key: "internal_notes",
    label: "Ghi chú nội bộ",
    required: false,
    templateHeader: "Ghi chú nội bộ",
    width: 30,
  },
  {
    key: "guardian_full_name",
    label: "Họ và tên phụ huynh",
    required: true,
    templateHeader: "Họ và tên phụ huynh *",
    width: 28,
  },
  {
    key: "guardian_phone",
    label: "Số điện thoại phụ huynh",
    required: true,
    templateHeader: "Số điện thoại phụ huynh *",
    width: 25,
  },
  {
    key: "guardian_relationship",
    label: "Quan hệ với học viên",
    required: true,
    templateHeader: "Quan hệ với học viên *",
    width: 23,
  },
  {
    key: "guardian_zalo",
    label: "Zalo phụ huynh",
    required: false,
    templateHeader: "Zalo phụ huynh",
    width: 22,
  },
  {
    key: "guardian_email",
    label: "Email phụ huynh",
    required: false,
    templateHeader: "Email phụ huynh",
    width: 28,
  },
  {
    key: "guardian_notes",
    label: "Ghi chú phụ huynh",
    required: false,
    templateHeader: "Ghi chú phụ huynh",
    width: 30,
  },
] as const satisfies readonly StudentImportFieldDefinition[];

export const STUDENT_IMPORT_FIELD_KEYS =
  STUDENT_IMPORT_FIELD_DEFINITIONS.map(
    (definition) => definition.key,
  ) as StudentImportFieldKey[];

export const STUDENT_IMPORT_REQUIRED_FIELD_KEYS =
  STUDENT_IMPORT_FIELD_DEFINITIONS
    .filter((definition) => definition.required)
    .map(
      (definition) => definition.key,
    ) as StudentImportFieldKey[];
