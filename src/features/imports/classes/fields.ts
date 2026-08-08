import type {
  ClassImportFieldDefinition,
  ClassImportFieldKey,
  ScheduleImportFieldDefinition,
  ScheduleImportFieldKey,
} from "./types";

export const CLASS_IMPORT_FIELDS: readonly ClassImportFieldDefinition[] = [
  {
    key: "academic_year_code",
    label: "Mã năm học",
    required: true,
    templateHeader: "Mã năm học *",
    width: 18,
  },
  {
    key: "class_code",
    label: "Mã lớp",
    required: true,
    templateHeader: "Mã lớp *",
    width: 16,
  },
  {
    key: "class_name",
    label: "Tên lớp",
    required: true,
    templateHeader: "Tên lớp *",
    width: 22,
  },
  {
    key: "grade",
    label: "Khối",
    required: true,
    templateHeader: "Khối *",
    width: 12,
  },
  {
    key: "level",
    label: "Trình độ",
    required: true,
    templateHeader: "Trình độ *",
    width: 14,
  },
  {
    key: "weekly_session_count",
    label: "Số buổi / tuần",
    required: true,
    templateHeader: "Số buổi / tuần *",
    width: 18,
  },
  {
    key: "default_learning_mode",
    label: "Hình thức mặc định",
    required: true,
    templateHeader: "Hình thức mặc định *",
    width: 22,
  },
  {
    key: "status",
    label: "Trạng thái",
    required: true,
    templateHeader: "Trạng thái *",
    width: 14,
  },
] as const;

export const SCHEDULE_IMPORT_FIELDS: readonly ScheduleImportFieldDefinition[] = [
  {
    key: "class_code",
    label: "Mã lớp",
    required: true,
    templateHeader: "Mã lớp *",
    width: 16,
  },
  {
    key: "component_code",
    label: "Mã thành phần",
    required: true,
    templateHeader: "Mã thành phần *",
    width: 18,
  },
  {
    key: "weekday",
    label: "Thứ",
    required: true,
    templateHeader: "Thứ *",
    width: 12,
  },
  {
    key: "start_time",
    label: "Giờ bắt đầu",
    required: true,
    templateHeader: "Giờ bắt đầu *",
    width: 16,
  },
  {
    key: "end_time",
    label: "Giờ kết thúc",
    required: true,
    templateHeader: "Giờ kết thúc *",
    width: 16,
  },
  {
    key: "learning_mode",
    label: "Hình thức",
    required: true,
    templateHeader: "Hình thức *",
    width: 18,
  },
  {
    key: "room_name",
    label: "Phòng học",
    required: false,
    templateHeader: "Phòng học",
    width: 20,
  },
  {
    key: "meeting_url",
    label: "Link học",
    required: false,
    templateHeader: "Link học",
    width: 30,
  },
  {
    key: "effective_from",
    label: "Hiệu lực từ",
    required: true,
    templateHeader: "Hiệu lực từ *",
    width: 16,
  },
  {
    key: "effective_to",
    label: "Hiệu lực đến",
    required: false,
    templateHeader: "Hiệu lực đến",
    width: 16,
  },
] as const;

export const CLASS_ALIAS_MAP: Record<ClassImportFieldKey, readonly string[]> = {
  academic_year_code: ["mã năm học", "năm học", "academic year", "year code", "year"],
  class_code: ["mã lớp", "class code", "lớp", "mã lớp học"],
  class_name: ["tên lớp", "class name", "tên lớp học"],
  grade: ["khối", "grade", "khối lớp"],
  level: ["trình độ", "level", "loại lớp"],
  weekly_session_count: ["số buổi / tuần", "số buổi", "weekly sessions", "weekly_session_count", "số buổi trên tuần"],
  default_learning_mode: ["hình thức mặc định", "learning mode", "hình thức học", "default_learning_mode", "default learning mode"],
  status: ["trạng thái", "status", "trạng thái lớp"],
};

export const SCHEDULE_ALIAS_MAP: Record<ScheduleImportFieldKey, readonly string[]> = {
  class_code: ["mã lớp", "class code", "lớp"],
  component_code: ["mã thành phần", "component", "component code", "thành phần", "môn"],
  weekday: ["thứ", "weekday", "day", "ngày trong tuần"],
  start_time: ["giờ bắt đầu", "start time", "start", "bắt đầu"],
  end_time: ["giờ kết thúc", "end time", "end", "kết thúc"],
  learning_mode: ["hình thức", "learning mode", "hình thức học"],
  room_name: ["phòng học", "room", "room name", "phòng"],
  meeting_url: ["link học", "meeting url", "online link", "classin url", "link classin"],
  effective_from: ["hiệu lực từ", "effective from", "ngày bắt đầu", "start date"],
  effective_to: ["hiệu lực đến", "effective to", "ngày kết thúc", "end date"],
};
