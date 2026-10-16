import "server-only";

import { fetchChunked, fetchPaged } from "@/features/classes/detail/class-detail-data";
import { isLockCountedAttendanceStatus } from "@/features/classes/detail/class-detail-models";
import type {
  SessionDirectoryItem,
  SessionDirectoryResult,
  SessionKind,
  SessionLearningMode,
  SessionStatus,
} from "@/features/sessions/read-models";
import { SESSION_DIRECTORY_WINDOW_LIMIT } from "@/features/sessions/session-directory-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SessionClassQueryRow {
  code: string;
  grade: number;
  id: string;
  level: string;
  name: string;
}

interface SessionDirectoryQueryRow {
  cancellation_reason: string | null;
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
  meeting_url: string | null;
  room_name: string | null;
  session_date: string;
  session_kind: string;
  start_time: string;
  status: string;
}

interface AttendanceCountRow {
  attendance_status: string;
  class_session_id: string;
}

interface ResultCountRow {
  class_session_id: string;
}

interface AttendanceTally {
  /** Every row, any status: the meaning reports/export keep for attendanceCount. */
  all: number;
  /** present / excused / unexcused: only roster students may hold them. */
  markedRoster: number;
  /** present / additional_study: the students a result may be recorded for. */
  resultEligible: number;
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

const SESSION_DIRECTORY_LIMIT = SESSION_DIRECTORY_WINDOW_LIMIT;

function createCountMap(
  rows: readonly ResultCountRow[],
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

function createAttendanceTallies(
  rows: readonly AttendanceCountRow[],
): Map<string, AttendanceTally> {
  const result = new Map<string, AttendanceTally>();

  for (const row of rows) {
    const tally = result.get(row.class_session_id) ?? { all: 0, markedRoster: 0, resultEligible: 0 };
    tally.all += 1;
    if (isLockCountedAttendanceStatus(row.attendance_status)) tally.markedRoster += 1;
    if (row.attendance_status === "present" || row.attendance_status === "additional_study") tally.resultEligible += 1;
    result.set(row.class_session_id, tally);
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
        meeting_url,
        status,
        locked_at,
        cancellation_reason,
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

    // PostgREST returns at most 1000 rows per request and takes `in` ids in the
    // URL: read in 150-id chunks, each paged, so no session is undercounted.
    // Attendance and results are independent reads, so they run together.
    const [attendanceRows, resultRows] = await Promise.all([
      options.includeAttendanceCounts && sessionIds.length > 0
        ? fetchChunked(
            sessionIds,
            (ids) =>
              fetchPaged<AttendanceCountRow>((from, to) =>
                supabase
                  .from("session_attendance")
                  .select("class_session_id, attendance_status")
                  .in("class_session_id", ids)
                  .order("id", { ascending: true })
                  .range(from, to),
              ),
          )
        : Promise.resolve([] as AttendanceCountRow[]),
      options.includeResultCounts && sessionIds.length > 0
        ? fetchChunked(
            sessionIds,
            (ids) =>
              fetchPaged<ResultCountRow>((from, to) =>
                supabase
                  .from("session_results")
                  .select("class_session_id")
                  .in("class_session_id", ids)
                  .order("id", { ascending: true })
                  .range(from, to),
              ),
          )
        : Promise.resolve([] as ResultCountRow[]),
    ]);

    if (attendanceRows === null) {
      return {
        error: {
          code: "query_failed",
          message:
            "Không thể tải số lượng điểm danh của các buổi học.",
        },
        ok: false,
      };
    }

    if (resultRows === null) {
      return {
        error: {
          code: "query_failed",
          message:
            "Không thể tải số lượng kết quả của các buổi học.",
        },
        ok: false,
      };
    }

    const attendanceTallies =
      createAttendanceTallies(attendanceRows);

    const resultCountMap =
      createCountMap(resultRows);

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

        const tally = attendanceTallies.get(row.id);

        return {
          attendanceCount:
            options.includeAttendanceCounts
              ? tally?.all ?? 0
              : null,
          cancellationReason: row.cancellation_reason,
          classCode: joinedClass.code,
          classId: joinedClass.id,
          className: joinedClass.name,
          componentCode: row.component_code,
          endTime: row.end_time,
          grade: joinedClass.grade,
          // Only the flag leaves the server: the list says "có link", never the link.
          hasMeetingUrl: Boolean(row.meeting_url?.trim()),
          id: row.id,
          learningMode: row.learning_mode,
          level: joinedClass.level,
          lockedAt: row.locked_at,
          markedRosterCount:
            options.includeAttendanceCounts
              ? tally?.markedRoster ?? 0
              : null,
          resultCount:
            options.includeResultCounts
              ? resultCountMap.get(row.id) ?? 0
              : null,
          resultEligibleCount:
            options.includeAttendanceCounts
              ? tally?.resultEligible ?? 0
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
