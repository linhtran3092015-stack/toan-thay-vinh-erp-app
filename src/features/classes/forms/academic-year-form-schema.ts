import { z } from "zod";

const dateStringPattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: string): boolean {
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

const academicYearIdSchema = z
  .string()
  .trim()
  .uuid("Mã năm học không hợp lệ.");

const academicYearReasonSchema = z
  .string()
  .trim()
  .min(1, "Bắt buộc nhập lý do thao tác.")
  .max(2000, "Lý do thao tác quá dài.");

const academicYearDateSchema = z
  .string()
  .trim()
  .refine(
    isValidDateString,
    "Ngày chưa đúng định dạng YYYY-MM-DD.",
  );

export const academicYearFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(
        /^\d{4}-\d{4}$/,
        "Mã năm học phải có dạng YYYY-YYYY.",
      ),

    endsOn: academicYearDateSchema,

    name: z
      .string()
      .trim()
      .min(
        1,
        "Tên năm học không được để trống.",
      )
      .max(200, "Tên năm học quá dài."),

    startsOn: academicYearDateSchema,
  })
  .superRefine((value, context) => {
    if (value.endsOn < value.startsOn) {
      context.addIssue({
        code: "custom",
        message:
          "Ngày kết thúc không được trước ngày bắt đầu.",
        path: ["endsOn"],
      });
    }
  });

export const activateAcademicYearSchema =
  z.object({
    academicYearId: academicYearIdSchema,
    reason: academicYearReasonSchema,
  });

export const changeAcademicYearStatusSchema =
  z.object({
    academicYearId: academicYearIdSchema,

    reason: academicYearReasonSchema,

    targetStatus: z.enum([
      "closed",
      "archived",
    ]),
  });

export type AcademicYearFormValues = z.infer<
  typeof academicYearFormSchema
>;

export type ActivateAcademicYearValues =
  z.infer<
    typeof activateAcademicYearSchema
  >;

export type ChangeAcademicYearStatusValues =
  z.infer<
    typeof changeAcademicYearStatusSchema
  >;
