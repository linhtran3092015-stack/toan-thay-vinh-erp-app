import { z } from "zod";

import { getVietnamBusinessDate } from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingScheduleEntry } from "@/features/timekeeping/types";

export const scheduleDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "9998-12-31";
}, "Ngày không hợp lệ.");

export function addScheduleDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getScheduleWeek(date = getVietnamBusinessDate()): string {
  const safeDate = scheduleDateSchema.parse(date);
  const weekday = new Date(`${safeDate}T00:00:00Z`).getUTCDay() || 7;
  return addScheduleDays(safeDate, 1 - weekday);
}

export function resolveScheduleWeek(value: unknown): string {
  const parsed = scheduleDateSchema.safeParse(value);
  return getScheduleWeek(parsed.success ? parsed.data : getVietnamBusinessDate());
}

export function formatScheduleDate(value: string): string {
  return value.split("-").reverse().join("/");
}

export interface WeeklyScheduleEntry extends TimekeepingScheduleEntry {
  workDate: string;
  weekStart: string | null;
  updatedAt: string;
  isActive: boolean;
  isLocked: boolean;
}

export const weeklyAssignmentSchema = z.object({
  weekStart: scheduleDateSchema.refine((value) => scheduleDateSchema.safeParse(value).success && getScheduleWeek(value) === value, "Tuần phải bắt đầu vào thứ Hai."),
  weekday: z.number().int().min(1).max(7),
  staffId: z.string().uuid(),
  workShiftId: z.string().uuid().nullable(),
  expectedAssignmentId: z.string().uuid().nullable(),
  expectedUpdatedAt: z.string().max(64).nullable(),
  reason: z.string().trim().min(1, "Bắt buộc nhập lý do thay đổi.").max(2000),
});

export type WeeklyAssignmentInput = z.infer<typeof weeklyAssignmentSchema>;

export const weeklyScheduleResponseSchema = z.array(z.object({
  assignment_id: z.string().uuid(), staff_id: z.string().uuid(),
  staff_display_name: z.string().nullable(), staff_employee_code: z.string().nullable(),
  staff_employment_status: z.string(), weekday: z.number().int().min(1).max(7),
  effective_from: scheduleDateSchema, effective_to: scheduleDateSchema.nullable(),
  work_shift_id: z.string().uuid(), work_shift_code: z.string(), work_shift_name: z.string(),
  start_time: z.string(), end_time: z.string(), crosses_midnight: z.boolean(), break_minutes: z.number(),
  work_date: scheduleDateSchema, week_start: scheduleDateSchema.nullable(),
  updated_at: z.string(), is_active: z.boolean(), is_locked: z.boolean(),
}));
