import { z } from "zod";

const dateStringPattern = /^\d{4}-\d{2}-\d{2}$/;
const timeStringPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDateString(value: string): boolean {
  if (!dateStringPattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const uuidSchema = z.string().trim().uuid("Mã dữ liệu không hợp lệ.");

const reasonSchema = z
  .string()
  .trim()
  .min(1, "Bắt buộc nhập lý do thao tác.")
  .max(2000, "Lý do thao tác quá dài.");

const dateSchema = z
  .string()
  .trim()
  .refine(isValidDateString, "Ngày chưa đúng định dạng YYYY-MM-DD.");

const timeSchema = z
  .string()
  .trim()
  .regex(timeStringPattern, "Giờ phải có định dạng HH:MM.");

const workShiftFieldsSchema = z
  .object({
    breakMinutes: z
      .number()
      .int("Số phút nghỉ phải là số nguyên.")
      .min(0, "Số phút nghỉ không được âm."),
    code: z
      .string()
      .trim()
      .regex(
        /^[A-Z0-9._-]{2,64}$/,
        "Mã ca gồm 2-64 ký tự in hoa, số hoặc . _ -.",
      ),
    crossesMidnight: z.boolean(),
    endTime: timeSchema,
    name: z
      .string()
      .trim()
      .min(1, "Bắt buộc nhập tên ca.")
      .max(160, "Tên ca quá dài."),
    notes: z.string().trim().max(2000, "Ghi chú quá dài."),
    startTime: timeSchema,
  })
  .superRefine((value, context) => {
    const isTimeRangeValid = value.crossesMidnight
      ? value.endTime < value.startTime
      : value.endTime > value.startTime;

    if (!isTimeRangeValid) {
      context.addIssue({
        code: "custom",
        message: value.crossesMidnight
          ? "Ca qua ngày phải kết thúc trước giờ bắt đầu."
          : "Giờ kết thúc phải sau giờ bắt đầu.",
        path: ["endTime"],
      });
    }
  });

const workShiftFieldsTransformSchema = z.object(workShiftFieldsSchema.shape);

export const createWorkShiftSchema = workShiftFieldsSchema.extend({
  reason: reasonSchema,
});

export const updateWorkShiftSchema = workShiftFieldsTransformSchema
  .extend({
    reason: reasonSchema,
    workShiftId: uuidSchema,
  })
  .superRefine((value, context) => {
    const isTimeRangeValid = value.crossesMidnight
      ? value.endTime < value.startTime
      : value.endTime > value.startTime;

    if (!isTimeRangeValid) {
      context.addIssue({
        code: "custom",
        message: value.crossesMidnight
          ? "Ca qua ngày phải kết thúc trước giờ bắt đầu."
          : "Giờ kết thúc phải sau giờ bắt đầu.",
        path: ["endTime"],
      });
    }
  });

export const retireWorkShiftSchema = z.object({
  reason: reasonSchema,
  workShiftId: uuidSchema,
});

export const createStaffShiftAssignmentSchema = z.object({
  effectiveFrom: dateSchema,
  reason: reasonSchema,
  staffId: uuidSchema,
  weekday: z
    .number()
    .int("Thứ trong tuần phải là số nguyên.")
    .min(1, "Thứ trong tuần phải từ 1 đến 7.")
    .max(7, "Thứ trong tuần phải từ 1 đến 7."),
  workShiftId: uuidSchema,
});

export const replaceStaffShiftAssignmentSchema = z.object({
  effectiveFrom: dateSchema,
  reason: reasonSchema,
  staffShiftAssignmentId: uuidSchema,
  workShiftId: uuidSchema,
});

export const endStaffShiftAssignmentSchema = z.object({
  effectiveTo: dateSchema,
  reason: reasonSchema,
  staffShiftAssignmentId: uuidSchema,
});
