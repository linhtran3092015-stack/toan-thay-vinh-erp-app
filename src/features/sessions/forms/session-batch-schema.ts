import { z } from "zod";
import type { SessionKind, SessionLearningMode } from "@/features/sessions/read-models";

const UUID_MESSAGE = "Mã dữ liệu không hợp lệ.";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function timeToSeconds(value: string): number {
  const [hour, minute, second = "0"] = value.split(":");
  return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
}

function emptyToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  return value;
}

export const batchSessionItemSchema = z
  .object({
    sessionDate: z
      .string()
      .trim()
      .refine(isValidDateString, "Ngày học không đúng định dạng YYYY-MM-DD."),
    startTime: z
      .string()
      .trim()
      .regex(TIME_PATTERN, "Giờ bắt đầu không đúng định dạng HH:MM."),
    endTime: z
      .string()
      .trim()
      .regex(TIME_PATTERN, "Giờ kết thúc không đúng định dạng HH:MM."),
    learningMode: z.enum(["online", "offline", "hybrid"], {
      message: "Hình thức học không hợp lệ.",
    }),
    sessionKind: z.enum(["regular", "additional"], {
      message: "Loại buổi học chỉ có thể là buổi chính hoặc buổi bổ sung.",
    }),
    scheduleTemplateId: z.preprocess(
      emptyToUndefined,
      z.string().uuid(UUID_MESSAGE).optional().nullable(),
    ),
    componentCode: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9._-]+$/, "Mã thành phần chỉ gồm chữ in hoa, số và dấu . _ -.")
        .optional()
        .nullable(),
    ),
    roomName: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(100, "Tên phòng tối đa 100 ký tự.").optional().nullable(),
    ),
    meetingUrl: z.preprocess(
      emptyToUndefined,
      z.string().trim().url("Đường dẫn học trực tuyến không hợp lệ.").optional().nullable(),
    ),
    notes: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional().nullable(),
    ),
  })
  .superRefine((data, ctx) => {
    if (timeToSeconds(data.endTime) <= timeToSeconds(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Giờ kết thúc phải sau giờ bắt đầu.",
        path: ["endTime"],
      });
    }
  });

export type BatchSessionItemInput = z.infer<typeof batchSessionItemSchema>;

export const createBatchSessionsPayloadSchema = z.object({
  classId: z.string().uuid(UUID_MESSAGE),
  sessions: z
    .array(batchSessionItemSchema)
    .min(1, "Cần chọn ít nhất 1 buổi học để tạo.")
    .max(100, "Mỗi đợt tạo tối đa 100 buổi học."),
  reason: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(255, "Lý do tối đa 255 ký tự.").optional(),
  ),
});

export type CreateBatchSessionsPayload = z.infer<typeof createBatchSessionsPayloadSchema>;

export interface BatchSessionDraftItem {
  id: string; // client temporary ID
  sessionNumber: number;
  sessionDate: string;
  weekday: number; // 1 = Thứ 2 ... 7 = CN
  weekdayLabel: string; // e.g. "Thứ Hai"
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  learningMode: SessionLearningMode;
  sessionKind: Extract<SessionKind, "regular" | "additional">;
  scheduleTemplateId: string | null;
  componentCode: string | null;
  roomName: string | null;
  meetingUrl: string | null;
  notes: string | null;
  selected: boolean;
  statusConflict: "none" | "duplicate" | "past";
  conflictDetail?: string;
}
