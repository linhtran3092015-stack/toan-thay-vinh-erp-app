import "server-only";

import type {
  SessionDirectoryItem,
  SessionDirectoryResult,
  SessionKind,
  SessionLearningMode,
  SessionStatus,
} from "@/features/sessions/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SessionClassQueryRow {
  code: string;
  grade: number;
  id: string;
  level: string;
  name: string;
}

interface SessionDirectoryQueryRow {
  class:
    | SessionClassQueryRow
    | SessionClassQueryRow[]
    | null;
  class_id: string;
  component_code: string | null;
  end_time: string;
  id: string;
  learning_mode: string;
  locked_at: string | null;
  room_name: string | null;
  session_date: string;
  session_kind: string;
  start_time: string;
  status: string;
}

interface CountQueryRow {
  class_session_id: string;
}

interface GetSessionDirectoryOptions {
  includeAttendanceCounts?: boolean;
  includeResultCounts?: boolean;
  /** Inclusive YYYY-MM-DD bounds applied in the query, before the row limit. */
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Row cap; defaults to the directory limit. Exports pass a higher cap. */
  limit?: number;
}

const SESSION_DIRECTORY_LIMIT = 300;

function createCountMap(
  rows: CountQueryRow[],
): Map<string, number> {
  const result = new Map<string, number>();

  for (const row of rows) {
    result.set(
      row.class_session_id,
      (result.get(row.class_session_id) ?? 0) + 1,
    );
  }

  return result;
}

function getJoinedClass(
  value: SessionDirectoryQueryRow["class"],
): SessionClassQueryRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function isSessionKind(
  value: string,
): value is SessionKind {
  return [
    "regular",
    "makeup",
    "additional",
  ].includes(value);
}

function isSessionLearningMode(
  value: string,
): value is SessionLearningMode {
  return [
    "online",
    "offline",
    "hybrid",
  ].includes(value);
}

function isSessionStatus(
  value: string,
): value is SessionStatus {
  return [
    "scheduled",
    "in_progress",
    "completed",
    "cancelled",
  ].includes(value);
}

export async function getSessionDirectory(
  options: GetSessionDirectoryOptions = {},
): Promise<SessionDirectoryResult> {
  try {
    const supabase =
      await createSupabaseServerClient();

    let query = supabase
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
        status,
        locked_at,
        class:classes!class_sessions_class_id_fkey (
          id,
          code,
          name,
          grade,
          level
        )
      `)
      .order("session_date", {
        ascending: false,
      })
      .order("start_time", {
        ascending: true,
      });

    if (options.dateFrom) {
      query = query.gte("session_date", options.dateFrom);
    }

    if (options.dateTo) {
      query = query.lte("session_date", options.dateTo);
    }

    const { data, error } = await query.limit(
      options.limit ?? SESSION_DIRECTORY_LIMIT,
    );

    if (error) {
      return {
        error: {
          code: "query_failed",
          message:
            "Không thể tải danh sách buổi học từ database.",
        },
        ok: false,
      };
    }

    const rows =
      (data ?? []) as unknown as SessionDirectoryQueryRow[];

    const invalidRow = rows.some((row) => {
      const joinedClass = getJoinedClass(row.class);

      return (
        !joinedClass ||
        !isSessionKind(row.session_kind) ||
        !isSessionLearningMode(
          row.learning_mode,
        ) ||
        !isSessionStatus(row.status)
      );
    });

    if (invalidRow) {
      return {
        error: {
          code: "invalid_response",
          message:
            "Database trả về dữ liệu buổi học không hợp lệ.",
        },
        ok: false,
      };
    }

    const sessionIds = rows.map((row) => row.id);

    let attendanceCountMap =
      new Map<string, number>();

    let resultCountMap =
      new Map<string, number>();

    if (
      options.includeAttendanceCounts &&
      sessionIds.length > 0
    ) {
      const {
        data: attendanceRows,
        error: attendanceError,
      } = await supabase
        .from("session_attendance")
        .select("class_session_id")
        .in("class_session_id", sessionIds);

      if (attendanceError) {
        return {
          error: {
            code: "query_failed",
            message:
              "Không thể tải số lượng điểm danh của các buổi học.",
          },
          ok: false,
        };
      }

      attendanceCountMap = createCountMap(
        (attendanceRows ??
          []) as CountQueryRow[],
      );
    }

    if (
      options.includeResultCounts &&
      sessionIds.length > 0
    ) {
      const {
        data: resultRows,
        error: resultError,
      } = await supabase
        .from("session_results")
        .select("class_session_id")
        .in("class_session_id", sessionIds);

      if (resultError) {
        return {
          error: {
            code: "query_failed",
            message:
              "Không thể tải số lượng kết quả của các buổi học.",
          },
          ok: false,
        };
      }

      resultCountMap = createCountMap(
        (resultRows ?? []) as CountQueryRow[],
      );
    }

    const sessions: SessionDirectoryItem[] =
      rows.map((row) => {
        const joinedClass = getJoinedClass(
          row.class,
        );

        if (
          !joinedClass ||
          !isSessionKind(row.session_kind) ||
          !isSessionLearningMode(
            row.learning_mode,
          ) ||
          !isSessionStatus(row.status)
        ) {
          throw new Error(
            "INVALID_SESSION_DIRECTORY_ROW",
          );
        }

        return {
          attendanceCount:
            options.includeAttendanceCounts
              ? attendanceCountMap.get(row.id) ?? 0
              : null,
          classCode: joinedClass.code,
          classId: joinedClass.id,
          className: joinedClass.name,
          componentCode: row.component_code,
          endTime: row.end_time,
          grade: joinedClass.grade,
          id: row.id,
          learningMode: row.learning_mode,
          level: joinedClass.level,
          lockedAt: row.locked_at,
          resultCount:
            options.includeResultCounts
              ? resultCountMap.get(row.id) ?? 0
              : null,
          roomName: row.room_name,
          sessionDate: row.session_date,
          sessionKind: row.session_kind,
          startTime: row.start_time,
          status: row.status,
        };
      });

    return {
      ok: true,
      sessions,
    };
  } catch {
    return {
      error: {
        code: "query_failed",
        message:
          "Không thể kết nối tới dữ liệu buổi học. Vui lòng thử lại.",
      },
      ok: false,
    };
  }
}
