import "server-only";

import type {
  SessionKind,
  SessionLearningMode,
} from "@/features/sessions/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionCreationClassOption {
  code: string;
  defaultLearningMode: SessionLearningMode;
  grade: number;
  id: string;
  level: string;
  name: string;
}

export interface SessionScheduleOption {
  classId: string;
  componentCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  endTime: string;
  id: string;
  learningMode: SessionLearningMode;
  meetingUrl: string | null;
  roomName: string | null;
  startTime: string;
  weekday: number;
}

export interface CancelledSessionOption {
  cancellationReason: string | null;
  classId: string;
  componentCode: string | null;
  endTime: string;
  id: string;
  learningMode: SessionLearningMode;
  meetingUrl: string | null;
  roomName: string | null;
  sessionDate: string;
  sessionKind: Exclude<
    SessionKind,
    "additional"
  >;
  startTime: string;
}

export type SessionCreationOptionsResult =
  | {
      cancelledSessions: CancelledSessionOption[];
      classes: SessionCreationClassOption[];
      ok: true;
      schedules: SessionScheduleOption[];
    }
  | {
      error: {
        code:
          | "invalid_response"
          | "query_failed";
        message: string;
      };
      ok: false;
    };

interface ClassQueryRow {
  code: string;
  default_learning_mode: string;
  grade: number;
  id: string;
  level: string;
  name: string;
}

interface ScheduleQueryRow {
  class_id: string;
  component_code: string;
  effective_from: string;
  effective_to: string | null;
  end_time: string;
  id: string;
  learning_mode: string;
  meeting_url: string | null;
  room_name: string | null;
  start_time: string;
  weekday: number;
}

interface CancelledSessionQueryRow {
  cancellation_reason: string | null;
  class_id: string;
  component_code: string | null;
  end_time: string;
  id: string;
  learning_mode: string;
  meeting_url: string | null;
  room_name: string | null;
  session_date: string;
  session_kind: string;
  start_time: string;
}

function isLearningMode(
  value: string,
): value is SessionLearningMode {
  return [
    "online",
    "offline",
    "hybrid",
  ].includes(value);
}

function isCancelledSourceKind(
  value: string,
): value is Exclude<
  SessionKind,
  "additional"
> {
  return ["regular", "makeup"].includes(
    value,
  );
}

export async function getSessionCreationOptions():
  Promise<SessionCreationOptionsResult> {
  try {
    const supabase =
      await createSupabaseServerClient();

    const {
      data: classData,
      error: classError,
    } = await supabase
      .from("classes")
      .select(`
        id,
        code,
        name,
        grade,
        level,
        default_learning_mode
      `)
      .eq("status", "active")
      .order("code", {
        ascending: true,
      });

    if (classError) {
      return {
        error: {
          code: "query_failed",
          message:
            "Không thể tải danh sách lớp đang hoạt động.",
        },
        ok: false,
      };
    }

    const classRows =
      (classData ?? []) as ClassQueryRow[];

    if (
      classRows.some(
        (row) =>
          !isLearningMode(
            row.default_learning_mode,
          ),
      )
    ) {
      return {
        error: {
          code: "invalid_response",
          message:
            "Database trả về hình thức học của lớp không hợp lệ.",
        },
        ok: false,
      };
    }

    const classes: SessionCreationClassOption[] =
      classRows.map((row) => ({
        code: row.code,
        defaultLearningMode:
          row.default_learning_mode as SessionLearningMode,
        grade: row.grade,
        id: row.id,
        level: row.level,
        name: row.name,
      }));

    const classIds = classes.map(
      (item) => item.id,
    );

    if (classIds.length === 0) {
      return {
        cancelledSessions: [],
        classes: [],
        ok: true,
        schedules: [],
      };
    }

    const [
      scheduleResponse,
      cancelledResponse,
    ] = await Promise.all([
      supabase
        .from("class_schedule_templates")
        .select(`
          id,
          class_id,
          component_code,
          weekday,
          start_time,
          end_time,
          learning_mode,
          room_name,
          meeting_url,
          effective_from,
          effective_to
        `)
        .in("class_id", classIds)
        .eq("is_active", true)
        .order("weekday", {
          ascending: true,
        })
        .order("start_time", {
          ascending: true,
        }),

      supabase
        .from("class_sessions")
        .select(`
          id,
          class_id,
          session_date,
          session_kind,
          component_code,
          start_time,
          end_time,
          learning_mode,
          room_name,
          meeting_url,
          cancellation_reason
        `)
        .in("class_id", classIds)
        .eq("status", "cancelled")
        .neq("session_kind", "additional")
        .order("session_date", {
          ascending: false,
        })
        .limit(200),
    ]);

    if (scheduleResponse.error) {
      return {
        error: {
          code: "query_failed",
          message:
            "Không thể tải lịch học cố định.",
        },
        ok: false,
      };
    }

    if (cancelledResponse.error) {
      return {
        error: {
          code: "query_failed",
          message:
            "Không thể tải các buổi đã hủy.",
        },
        ok: false,
      };
    }

    const scheduleRows =
      (scheduleResponse.data ??
        []) as ScheduleQueryRow[];

    const cancelledRows =
      (cancelledResponse.data ??
        []) as CancelledSessionQueryRow[];

    if (
      scheduleRows.some(
        (row) =>
          !isLearningMode(
            row.learning_mode,
          ),
      ) ||
      cancelledRows.some(
        (row) =>
          !isLearningMode(
            row.learning_mode,
          ) ||
          !isCancelledSourceKind(
            row.session_kind,
          ),
      )
    ) {
      return {
        error: {
          code: "invalid_response",
          message:
            "Database trả về dữ liệu lịch hoặc buổi hủy không hợp lệ.",
        },
        ok: false,
      };
    }

    const schedules: SessionScheduleOption[] =
      scheduleRows.map((row) => ({
        classId: row.class_id,
        componentCode:
          row.component_code,
        effectiveFrom:
          row.effective_from,
        effectiveTo: row.effective_to,
        endTime: row.end_time,
        id: row.id,
        learningMode:
          row.learning_mode as SessionLearningMode,
        meetingUrl: row.meeting_url,
        roomName: row.room_name,
        startTime: row.start_time,
        weekday: row.weekday,
      }));

    const cancelledSessions:
      CancelledSessionOption[] =
      cancelledRows.map((row) => ({
        cancellationReason:
          row.cancellation_reason,
        classId: row.class_id,
        componentCode:
          row.component_code,
        endTime: row.end_time,
        id: row.id,
        learningMode:
          row.learning_mode as SessionLearningMode,
        meetingUrl: row.meeting_url,
        roomName: row.room_name,
        sessionDate: row.session_date,
        sessionKind:
          row.session_kind as Exclude<
            SessionKind,
            "additional"
          >,
        startTime: row.start_time,
      }));

    return {
      cancelledSessions,
      classes,
      ok: true,
      schedules,
    };
  } catch {
    return {
      error: {
        code: "query_failed",
        message:
          "Không thể kết nối tới dữ liệu tạo buổi học.",
      },
      ok: false,
    };
  }
}
