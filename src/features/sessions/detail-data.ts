import "server-only";

import {
  isSessionAttendanceStatus,
  type SessionDetailReadModel,
  type SessionDetailResult,
  type SessionNotebookStatus,
  type SessionParticipantReadModel,
} from "@/features/sessions/detail-read-models";
import type {
  SessionKind,
  SessionLearningMode,
  SessionStatus,
} from "@/features/sessions/read-models";
import { compareStudentNames } from "@/lib/student-order";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SessionClassRow {
  code: string;
  grade: number;
  id: string;
  level: string;
  name: string;
  status: string;
}

interface SessionDetailQueryRow {
  cancellation_reason: string | null;
  cancelled_at: string | null;
  class:
    | SessionClassRow
    | SessionClassRow[]
    | null;
  class_id: string;
  completed_at: string | null;
  component_code: string | null;
  end_time: string;
  id: string;
  learning_mode: string;
  locked_at: string | null;
  lock_reason: string | null;
  previous_session_date: string | null;
  reschedule_count: number;
  meeting_url: string | null;
  notes: string | null;
  room_name: string | null;
  session_date: string;
  session_kind: string;
  started_at: string | null;
  start_time: string;
  status: string;
}

interface EnrollmentQueryRow {
  enrollment_class_id: string;
  registered_mode: string;
  student_id: string;
  student_enrollment_id: string;
}

interface AttendanceQueryRow {
  actual_learning_mode: string;
  attendance_status: string;
  id: string;
  is_late_update: boolean;
  notes: string | null;
  student_enrollment_id: string | null;
  student_id: string;
}

interface ResultQueryRow {
  comment: string | null;
  id: string;
  notebook_score: number | null;
  notebook_status: string;
  student_id: string;
  test_score: number | null;
}

interface StudentQueryRow {
  current_grade: number | null;
  full_name: string;
  id: string;
  public_code: string;
}

interface GetSessionDetailOptions {
  includeAttendance?: boolean;
  includeResults?: boolean;
  includeRoster?: boolean;
  includeStudentIdentity?: boolean;
}

function getJoinedClass(
  value: SessionDetailQueryRow["class"],
): SessionClassRow | null {
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

function isLearningMode(
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

function isNotebookStatus(
  value: string,
): value is SessionNotebookStatus {
  return [
    "pending",
    "submitted",
    "not_submitted",
    "not_required",
  ].includes(value);
}

export async function getSessionDetail(
  sessionId: string,
  options: GetSessionDetailOptions = {},
): Promise<SessionDetailResult> {
  try {
    const supabase =
      await createSupabaseServerClient();

    const {
      data: sessionData,
      error: sessionError,
    } = await supabase
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
        started_at,
        completed_at,
        cancelled_at,
        cancellation_reason,
        locked_at,
        lock_reason,
        previous_session_date,
        reschedule_count,
        notes,
        class:classes!class_sessions_class_id_fkey (
          id,
          code,
          name,
          grade,
          level,
          status
        )
      `)
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return {
        error: {
          code: "query_failed",
          message:
            "Không thể tải thông tin buổi học từ database.",
        },
        ok: false,
      };
    }

    if (!sessionData) {
      return {
        error: {
          code: "session_not_found",
          message:
            "Không tìm thấy buổi học cần xem.",
        },
        ok: false,
      };
    }

    const session =
      sessionData as unknown as SessionDetailQueryRow;

    const joinedClass = getJoinedClass(
      session.class,
    );

    if (
      !joinedClass ||
      !isSessionKind(session.session_kind) ||
      !isLearningMode(session.learning_mode) ||
      !isSessionStatus(session.status)
    ) {
      return {
        error: {
          code: "invalid_response",
          message:
            "Database trả về thông tin buổi học không hợp lệ.",
        },
        ok: false,
      };
    }

    let enrollmentRows: EnrollmentQueryRow[] =
      [];

    let attendanceRows: AttendanceQueryRow[] =
      [];

    let resultRows: ResultQueryRow[] = [];

    if (options.includeRoster) {
      const {
        data: enrollmentData,
        error: enrollmentError,
      } = await supabase
        .rpc("resolve_class_session_roster", {
          p_class_session_id: sessionId,
        });

      if (enrollmentError) {
        return {
          error: {
            code: "query_failed",
            message:
              "Không thể tải danh sách học viên của buổi học.",
          },
          ok: false,
        };
      }

      enrollmentRows =
        (enrollmentData ??
          []) as EnrollmentQueryRow[];
    }

    if (options.includeAttendance) {
      const {
        data: attendanceData,
        error: attendanceError,
      } = await supabase
        .from("session_attendance")
        .select(`
          id,
          student_id,
          student_enrollment_id,
          attendance_status,
          actual_learning_mode,
          is_late_update,
          notes
        `)
        .eq("class_session_id", sessionId);

      if (attendanceError) {
        return {
          error: {
            code: "query_failed",
            message:
              "Không thể tải dữ liệu điểm danh của buổi học.",
          },
          ok: false,
        };
      }

      attendanceRows =
        (attendanceData ??
          []) as AttendanceQueryRow[];
    }

    if (options.includeResults) {
      const {
        data: resultData,
        error: resultError,
      } = await supabase
        .from("session_results")
        .select(`
          id,
          student_id,
          test_score,
          notebook_score,
          notebook_status,
          comment
        `)
        .eq("class_session_id", sessionId);

      if (resultError) {
        return {
          error: {
            code: "query_failed",
            message:
              "Không thể tải kết quả cuối buổi.",
          },
          ok: false,
        };
      }

      resultRows =
        (resultData ?? []) as ResultQueryRow[];
    }

    const studentIds = Array.from(
      new Set([
        ...enrollmentRows.map(
          (row) => row.student_id,
        ),
        ...attendanceRows.map(
          (row) => row.student_id,
        ),
        ...resultRows.map(
          (row) => row.student_id,
        ),
      ]),
    );

    let studentRows: StudentQueryRow[] = [];

    if (
      options.includeStudentIdentity &&
      studentIds.length > 0
    ) {
      const {
        data: studentData,
        error: studentError,
      } = await supabase
        .from("students")
        .select(`
          id,
          public_code,
          full_name,
          current_grade
        `)
        .in("id", studentIds);

      if (studentError) {
        return {
          error: {
            code: "query_failed",
            message:
              "Không thể tải thông tin học viên của buổi học.",
          },
          ok: false,
        };
      }

      studentRows =
        (studentData ?? []) as StudentQueryRow[];
    }

    const enrollmentMap = new Map(
      enrollmentRows.map((row) => [
        row.student_id,
        row,
      ]),
    );

    const attendanceMap = new Map(
      attendanceRows.map((row) => [
        row.student_id,
        row,
      ]),
    );

    const resultMap = new Map(
      resultRows.map((row) => [
        row.student_id,
        row,
      ]),
    );

    const studentMap = new Map(
      studentRows.map((row) => [
        row.id,
        row,
      ]),
    );

    const participantIds = Array.from(
      new Set([
        ...enrollmentMap.keys(),
        ...attendanceMap.keys(),
        ...resultMap.keys(),
      ]),
    );

    const participants: SessionParticipantReadModel[] =
      participantIds.map((studentId) => {
        const enrollment =
          enrollmentMap.get(studentId) ?? null;

        const attendance =
          attendanceMap.get(studentId) ?? null;

        const result =
          resultMap.get(studentId) ?? null;

        const student =
          studentMap.get(studentId) ?? null;

        const attendanceStatus =
          attendance &&
          isSessionAttendanceStatus(
            attendance.attendance_status,
          )
            ? attendance.attendance_status
            : null;

        const notebookStatus =
          result &&
          isNotebookStatus(
            result.notebook_status,
          )
            ? result.notebook_status
            : null;

        return {
          actualLearningMode:
            attendance?.actual_learning_mode ===
              "online" ||
            attendance?.actual_learning_mode ===
              "offline"
              ? attendance.actual_learning_mode
              : null,
          attendanceId:
            attendance?.id ?? null,
          attendanceNotes:
            attendance?.notes ?? null,
          attendanceStatus,
          currentGrade:
            student?.current_grade ?? null,
          enrollmentClassId:
            enrollment?.enrollment_class_id ?? null,
          enrollmentId:
            enrollment?.student_enrollment_id ??
            attendance?.student_enrollment_id ??
            null,
          isLateUpdate:
            attendance?.is_late_update ??
            false,
          notebookScore:
            result?.notebook_score ?? null,
          notebookStatus,
          registeredMode:
            enrollment?.registered_mode ?? null,
          resultComment:
            result?.comment ?? null,
          resultId: result?.id ?? null,
          studentCode:
            student?.public_code ?? null,
          studentId,
          studentName:
            student?.full_name ?? null,
          testScore:
            result?.test_score ?? null,
        };
      });

    participants.sort((left, right) => {
      const leftLabel =
        left.studentName ??
        left.studentCode ??
        "";

      const rightLabel =
        right.studentName ??
        right.studentCode ??
        "";

      return compareStudentNames(
        leftLabel,
        rightLabel,
      );
    });

    const detail: SessionDetailReadModel = {
      attendanceCount:
        options.includeAttendance
          ? attendanceRows.length
          : null,
      cancellationReason:
        session.cancellation_reason,
      cancelledAt: session.cancelled_at,
      classCode: joinedClass.code,
      classId: joinedClass.id,
      className: joinedClass.name,
      classStatus: joinedClass.status,
      completedAt: session.completed_at,
      componentCode: session.component_code,
      endTime: session.end_time,
      grade: joinedClass.grade,
      id: session.id,
      learningMode: session.learning_mode,
      level: joinedClass.level,
      lockedAt: session.locked_at,
      lockReason: session.lock_reason,
      previousSessionDate: session.previous_session_date,
      rescheduleCount: session.reschedule_count,
      meetingUrl: session.meeting_url,
      notes: session.notes,
      participants,
      resultCount:
        options.includeResults
          ? resultRows.length
          : null,
      roomName: session.room_name,
      rosterCount:
        options.includeRoster
          ? enrollmentRows.length
          : null,
      sessionDate: session.session_date,
      sessionKind: session.session_kind,
      startedAt: session.started_at,
      startTime: session.start_time,
      status: session.status,
    };

    return {
      detail,
      ok: true,
    };
  } catch {
    return {
      error: {
        code: "query_failed",
        message:
          "Không thể kết nối tới dữ liệu chi tiết buổi học.",
      },
      ok: false,
    };
  }
}
