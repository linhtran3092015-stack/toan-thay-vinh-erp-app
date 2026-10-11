import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface UnlockedSessionQueueItem {
  attendanceCount: number;
  autoLockOn: string | null;
  classCode: string;
  classId: string;
  className: string;
  completedAt: string | null;
  completedByName: string | null;
  daysSinceCompleted: number;
  endTime: string;
  id: string;
  missingAttendanceCount: number;
  rosterCount: number;
  sessionDate: string;
  sessionKind: string;
  startTime: string;
}

export interface UnlockedSessionQueue {
  autoLockAfterDays: number;
  items: UnlockedSessionQueueItem[];
}

export type UnlockedSessionQueueResult =
  | { data: UnlockedSessionQueue; ok: true }
  | { error: string; ok: false };

const rowSchema = z.object({
  attendance_count: z.number().int(),
  auto_lock_on: z.string().nullable(),
  class_code: z.string(),
  class_id: z.string().uuid(),
  class_name: z.string(),
  class_session_id: z.string().uuid(),
  completed_at: z.string().nullable(),
  completed_by_name: z.string().nullable(),
  days_since_completed: z.number().int(),
  end_time: z.string(),
  missing_attendance_count: z.number().int(),
  roster_count: z.number().int(),
  session_date: z.string(),
  session_kind: z.string(),
  start_time: z.string(),
});

/** Completed sessions that still have to be locked, oldest first. */
export async function getUnlockedSessionQueueResult(limit = 100): Promise<UnlockedSessionQueueResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const [queue, setting] = await Promise.all([
      supabase.rpc("get_unlocked_completed_sessions", { p_limit: limit }),
      supabase.rpc("session_auto_lock_after_days"),
    ]);
    if (queue.error) {
      return { error: "Không tải được danh sách buổi học chưa khóa.", ok: false };
    }
    const parsed = z.array(rowSchema).safeParse(queue.data ?? []);
    if (!parsed.success) {
      return { error: "Dữ liệu buổi học chưa khóa không hợp lệ.", ok: false };
    }
    return {
      data: {
        autoLockAfterDays: setting.error ? 0 : Number(setting.data ?? 0),
        items: parsed.data.map((row) => ({
          attendanceCount: row.attendance_count,
          autoLockOn: row.auto_lock_on,
          classCode: row.class_code,
          classId: row.class_id,
          className: row.class_name,
          completedAt: row.completed_at,
          completedByName: row.completed_by_name,
          daysSinceCompleted: row.days_since_completed,
          endTime: row.end_time,
          id: row.class_session_id,
          missingAttendanceCount: row.missing_attendance_count,
          rosterCount: row.roster_count,
          sessionDate: row.session_date,
          sessionKind: row.session_kind,
          startTime: row.start_time,
        })),
      },
      ok: true,
    };
  } catch {
    return { error: "Không tải được danh sách buổi học chưa khóa.", ok: false };
  }
}
