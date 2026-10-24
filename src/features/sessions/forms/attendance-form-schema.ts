import { z } from "zod";

function normalizeOptionalText(
  value: unknown,
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

const attendanceStatusSchema = z.enum([
  "present",
  "excused_absence",
  "unexcused_absence",
  "additional_study",
]);

const actualLearningModeSchema = z.enum([
  "online",
  "offline",
]);

const notesSchema = z.preprocess(
  normalizeOptionalText,
  z
    .string()
    .max(
      1000,
      "Ghi chú không được vượt quá 1.000 ký tự.",
    )
    .optional(),
);

export const markSessionAttendanceSchema =
  z.object({
    actualLearningMode:
      actualLearningModeSchema,

    attendanceStatus:
      attendanceStatusSchema,

    classSessionId: z
      .string()
      .uuid(
        "Mã buổi học không hợp lệ.",
      ),

    deferRefresh: z.boolean().optional(),

    notes: notesSchema,

    studentId: z
      .string()
      .uuid(
        "Mã học viên không hợp lệ.",
      ),
  });

export const refreshSessionAttendanceSchema = z
  .string()
  .uuid("Mã buổi học không hợp lệ.");

export const updateSessionAttendanceSchema =
  z.object({
    actualLearningMode:
      actualLearningModeSchema,

    attendanceId: z
      .string()
      .uuid(
        "Mã điểm danh không hợp lệ.",
      ),

    attendanceStatus:
      attendanceStatusSchema,

    notes: notesSchema,

    reason: z
      .string()
      .trim()
      .min(
        3,
        "Lý do cập nhật phải có ít nhất 3 ký tự.",
      )
      .max(
        500,
        "Lý do cập nhật không được vượt quá 500 ký tự.",
      ),
  });
