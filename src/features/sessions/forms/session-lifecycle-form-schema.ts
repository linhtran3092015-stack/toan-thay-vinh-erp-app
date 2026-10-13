import { z } from "zod";

const UUID_MESSAGE =
  "Mã dữ liệu không hợp lệ.";

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function emptyToUndefined(
  value: unknown,
): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (
    typeof value === "string" &&
    value.trim().length === 0
  ) {
    return undefined;
  }

  return value;
}

function isValidDate(
  value: string,
): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function timeToSeconds(
  value: string,
): number {
  const [hour, minute, second = "0"] =
    value.split(":");

  return (
    Number(hour) * 3600 +
    Number(minute) * 60 +
    Number(second)
  );
}

const optionalUuidSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .uuid(UUID_MESSAGE)
    .optional(),
);

const optionalTimeSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(
      TIME_PATTERN,
      "Giờ phải có định dạng HH:mm.",
    )
    .optional(),
);

const optionalShortTextSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(
      120,
      "Nội dung không được vượt quá 120 ký tự.",
    )
    .optional(),
);

const optionalLongTextSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(
      1000,
      "Nội dung không được vượt quá 1.000 ký tự.",
    )
    .optional(),
);

const optionalUrlSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .url("Đường dẫn học trực tuyến không hợp lệ.")
    .max(
      1000,
      "Đường dẫn không được vượt quá 1.000 ký tự.",
    )
    .optional(),
);

export const createSessionSchema = z
  .object({
    classId: z
      .string()
      .uuid("Mã lớp học không hợp lệ."),

    componentCode:
      optionalShortTextSchema,

    endTime: optionalTimeSchema,

    learningMode: z.preprocess(
      emptyToUndefined,
      z
        .enum([
          "online",
          "offline",
          "hybrid",
        ])
        .optional(),
    ),

    makeupForSessionId:
      optionalUuidSchema,

    meetingUrl: optionalUrlSchema,

    notes: optionalLongTextSchema,

    roomName: optionalShortTextSchema,

    scheduleTemplateId:
      optionalUuidSchema,

    sessionDate: z
      .string()
      .refine(
        isValidDate,
        "Ngày học không hợp lệ.",
      ),

    sessionKind: z.enum([
      "regular",
      "makeup",
      "additional",
    ]),

    startTime: optionalTimeSchema,
  })
  .superRefine((value, context) => {
    if (
      value.sessionKind === "regular" &&
      !value.scheduleTemplateId
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Buổi chính phải chọn lịch học cố định.",
        path: ["scheduleTemplateId"],
      });
    }

    if (
      value.sessionKind === "makeup" &&
      !value.makeupForSessionId
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Buổi bù phải chọn buổi đã hủy cần học bù.",
        path: ["makeupForSessionId"],
      });
    }

    if (
      value.sessionKind !== "regular"
    ) {
      if (!value.startTime) {
        context.addIssue({
          code: "custom",
          message:
            "Bắt buộc nhập giờ bắt đầu.",
          path: ["startTime"],
        });
      }

      if (!value.endTime) {
        context.addIssue({
          code: "custom",
          message:
            "Bắt buộc nhập giờ kết thúc.",
          path: ["endTime"],
        });
      }

      if (!value.learningMode) {
        context.addIssue({
          code: "custom",
          message:
            "Bắt buộc chọn hình thức học.",
          path: ["learningMode"],
        });
      }
    }

    if (
      value.startTime &&
      value.endTime &&
      timeToSeconds(value.endTime) <=
        timeToSeconds(value.startTime)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Giờ kết thúc phải sau giờ bắt đầu.",
        path: ["endTime"],
      });
    }
  });

export const sessionIdSchema = z.object({
  sessionId: z
    .string()
    .uuid("Mã buổi học không hợp lệ."),
});

/** Bounds of a cancel reason; the single-session and bulk cancel dialogs use the same ones. */
export const CANCEL_REASON_MIN_LENGTH = 3;
export const CANCEL_REASON_MAX_LENGTH = 500;

export const cancelSessionSchema =
  sessionIdSchema.extend({
    reason: z
      .string()
      .trim()
      .min(
        CANCEL_REASON_MIN_LENGTH,
        `Lý do hủy phải có ít nhất ${CANCEL_REASON_MIN_LENGTH} ký tự.`,
      )
      .max(
        CANCEL_REASON_MAX_LENGTH,
        `Lý do hủy không được vượt quá ${CANCEL_REASON_MAX_LENGTH} ký tự.`,
      ),
  });

/**
 * Most sessions one bulk cancel may touch. The server cancels them one RPC at a
 * time, so the cap keeps one action well inside the server function timeout.
 */
export const BULK_CANCEL_MAX_SESSIONS = 40;

/** Bulk cancel from a class page: every session must belong to that class (checked on the server). */
export const cancelClassSessionsSchema = z.object({
  classId: z.string().uuid("Mã lớp học không hợp lệ."),
  reason: cancelSessionSchema.shape.reason,
  sessionIds: z
    .array(z.string().uuid("Mã buổi học không hợp lệ."), { message: "Danh sách buổi học không hợp lệ." })
    .min(1, "Chọn ít nhất 1 buổi học cần hủy.")
    .max(BULK_CANCEL_MAX_SESSIONS, `Mỗi lần chỉ hủy được tối đa ${BULK_CANCEL_MAX_SESSIONS} buổi.`)
    .refine((ids) => new Set(ids).size === ids.length, "Danh sách buổi học bị trùng."),
});

const LEARNING_MODES = ["online", "offline", "hybrid"] as const;

/** Reschedule or edit a session that is still "scheduled". */
export const rescheduleSessionSchema = sessionIdSchema
  .extend({
    endTime: z.string().regex(TIME_PATTERN, "Giờ kết thúc phải có định dạng HH:mm."),
    learningMode: z.enum(LEARNING_MODES, { message: "Hình thức học không hợp lệ." }),
    meetingUrl: optionalUrlSchema,
    notes: optionalLongTextSchema,
    reason: z
      .string()
      .trim()
      .min(3, "Lý do đổi lịch phải có ít nhất 3 ký tự.")
      .max(1000, "Lý do đổi lịch không được vượt quá 1.000 ký tự."),
    roomName: optionalShortTextSchema,
    sessionDate: z
      .string()
      .refine(isValidDate, "Ngày học không hợp lệ."),
    startTime: z.string().regex(TIME_PATTERN, "Giờ bắt đầu phải có định dạng HH:mm."),
  })
  .superRefine((value, context) => {
    if (timeToSeconds(value.endTime) <= timeToSeconds(value.startTime)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Giờ kết thúc phải sau giờ bắt đầu.",
        path: ["endTime"],
      });
    }
  });
