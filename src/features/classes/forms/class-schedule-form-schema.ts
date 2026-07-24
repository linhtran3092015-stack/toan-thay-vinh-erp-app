import { z } from "zod";

const dateStringPattern = /^\d{4}-\d{2}-\d{2}$/;
const timeStringPattern =
  /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDateString(
  value: string,
): boolean {
  if (!dateStringPattern.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const uuidSchema = z
  .string()
  .trim()
  .uuid("Mã dữ liệu không hợp lệ.");

const reasonSchema = z
  .string()
  .trim()
  .min(1, "Bắt buộc nhập lý do thao tác.")
  .max(2000, "Lý do thao tác quá dài.");

const dateSchema = z
  .string()
  .trim()
  .refine(
    isValidDateString,
    "Ngày chưa đúng định dạng YYYY-MM-DD.",
  );

const timeSchema = z
  .string()
  .trim()
  .regex(
    timeStringPattern,
    "Giờ phải có định dạng HH:MM.",
  );

const optionalUrlSchema = z
  .string()
  .trim()
  .max(2000, "Đường dẫn quá dài.")
  .refine(
    (value) =>
      value === "" ||
      z.url().safeParse(value).success,
    "Đường dẫn phòng học chưa đúng định dạng.",
  );

const classScheduleFieldsSchema = z
  .object({
    componentCode: z
      .string()
      .trim()
      .max(100, "Mã thành phần lịch quá dài.")
      .refine(
        (value) =>
          value === "" ||
          /^[A-Z0-9._-]+$/.test(value),
        "Mã thành phần chỉ gồm chữ in hoa, số và các dấu . _ -.",
      ),

    effectiveFrom: dateSchema,

    endTime: timeSchema,

    learningMode: z.enum([
      "online",
      "offline",
      "hybrid",
    ]),

    meetingUrl: optionalUrlSchema,

    roomName: z
      .string()
      .trim()
      .max(200, "Tên phòng học quá dài."),

    startTime: timeSchema,

    weekday: z
      .number()
      .int("Thứ trong tuần phải là số nguyên.")
      .min(1, "Thứ trong tuần phải từ 1 đến 7.")
      .max(7, "Thứ trong tuần phải từ 1 đến 7."),
  })
  .superRefine((value, context) => {
    if (value.endTime <= value.startTime) {
      context.addIssue({
        code: "custom",
        message:
          "Giờ kết thúc phải sau giờ bắt đầu.",
        path: ["endTime"],
      });
    }
  });

const classScheduleFieldsTransformSchema =
  z.object(classScheduleFieldsSchema.shape);

export const createClassScheduleSchema =
  classScheduleFieldsSchema.extend({
    classId: uuidSchema,
  });

export const replaceClassScheduleSchema =
  classScheduleFieldsTransformSchema
    .omit({
      componentCode: true,
    })
    .extend({
      reason: reasonSchema,
      scheduleTemplateId: uuidSchema,
    })
    .superRefine((value, context) => {
      if (value.endTime <= value.startTime) {
        context.addIssue({
          code: "custom",
          message:
            "Giờ kết thúc phải sau giờ bắt đầu.",
          path: ["endTime"],
        });
      }
    });

export const endClassScheduleSchema =
  z.object({
    effectiveTo: dateSchema,
    reason: reasonSchema,
    scheduleTemplateId: uuidSchema,
  });

export type CreateClassScheduleValues =
  z.infer<
    typeof createClassScheduleSchema
  >;

export type ReplaceClassScheduleValues =
  z.infer<
    typeof replaceClassScheduleSchema
  >;

export type EndClassScheduleValues =
  z.infer<
    typeof endClassScheduleSchema
  >;
