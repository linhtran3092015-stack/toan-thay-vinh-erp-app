import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSessionAttendanceStatus } from "@/features/sessions/detail-read-models";
import { getVietnamTime, getVietnamToday } from "@/lib/datetime";

import {
  paymentRequestStatuses,
  summarizeAttendance,
  summarizePaymentRequests,
  type StudentAttendanceHistory,
  type StudentAttendanceHistoryItem,
  type StudentPaymentRequestItem,
  type StudentPaymentRequestStatus,
  type StudentPaymentSummary,
  type StudentUpcomingSession,
} from "./student-activity-models";

/**
 * Read-only activity feeds for the student profile (design 05): attendance by
 * session, payment requests, and the next scheduled session. Every loader
 * returns `null` when the query fails so the page can show an error slot
 * instead of pretending the student has no activity.
 */

/** Max rows each activity feed loads; the tabs paginate on top of this. */
const ACTIVITY_FEED_LIMIT = 200;

export async function getStudentAttendanceHistory(
  studentId: string,
  limit = ACTIVITY_FEED_LIMIT,
): Promise<StudentAttendanceHistory | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("session_attendance")
      .select(
        `
        id,
        attendance_status,
        actual_learning_mode,
        is_late_update,
        marked_at,
        notes,
        class_session_id,
        session:class_sessions (
          id,
          session_date,
          start_time,
          component_code,
          locked_at,
          class:classes!class_sessions_class_id_fkey ( id, code, name )
        )
        `,
      )
      .eq("student_id", studentId)
      .order("marked_at", { ascending: false })
      .limit(limit);

    if (error) {
      return null;
    }

    const rows = data ?? [];
    const sessionIds = rows.map((row) => row.class_session_id);
    const resultsById = new Map<string, { notebookStatus: string | null; testScore: number | null }>();

    if (sessionIds.length > 0) {
      const { data: results } = await supabase
        .from("session_results")
        .select("class_session_id, test_score, notebook_status")
        .eq("student_id", studentId)
        .in("class_session_id", sessionIds);

      for (const result of results ?? []) {
        resultsById.set(result.class_session_id, {
          notebookStatus: result.notebook_status,
          testScore: result.test_score === null ? null : Number(result.test_score),
        });
      }
    }

    const items: StudentAttendanceHistoryItem[] = [];

    for (const row of rows) {
      const session = row.session as unknown as {
        class: { code: string; id: string; name: string } | null;
        component_code: string | null;
        id: string;
        locked_at: string | null;
        session_date: string;
        start_time: string;
      } | null;

      if (!session || !isSessionAttendanceStatus(row.attendance_status)) {
        continue;
      }

      const result = resultsById.get(row.class_session_id);

      items.push({
        actualLearningMode: row.actual_learning_mode,
        classCode: session.class?.code ?? "",
        classId: session.class?.id ?? "",
        className: session.class?.name ?? "Lớp không xác định",
        componentCode: session.component_code,
        id: row.id,
        isLateUpdate: row.is_late_update,
        markedAt: row.marked_at,
        notebookStatus: result?.notebookStatus ?? null,
        notes: row.notes,
        sessionDate: session.session_date,
        sessionId: session.id,
        sessionLockedAt: session.locked_at,
        startTime: session.start_time,
        status: row.attendance_status,
        testScore: result?.testScore ?? null,
      });
    }

    items.sort((left, right) =>
      right.sessionDate === left.sessionDate
        ? right.startTime.localeCompare(left.startTime)
        : right.sessionDate.localeCompare(left.sessionDate),
    );

    return summarizeAttendance(items);
  } catch {
    return null;
  }
}

export async function getStudentPaymentRequests(
  studentId: string,
  limit = ACTIVITY_FEED_LIMIT,
): Promise<StudentPaymentSummary | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("student_payment_requests")
      .select(
        "id, public_code, expected_amount_vnd, paid_amount_vnd, paid_at, purchased_sessions, bonus_sessions, topup_type, status, notes, created_at",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return null;
    }

    // Unknown statuses are skipped rather than coerced: counting them as
    // "pending" would inflate the student's open debt.
    const requests: StudentPaymentRequestItem[] = (data ?? [])
      .filter((row): row is typeof row & { status: StudentPaymentRequestStatus } =>
        (paymentRequestStatuses as readonly string[]).includes(row.status),
      )
      .map((row) => ({
        bonusSessions: row.bonus_sessions,
        createdAt: row.created_at,
        expectedAmountVnd: Number(row.expected_amount_vnd),
        id: row.id,
        notes: row.notes,
        paidAmountVnd: Number(row.paid_amount_vnd),
        paidAt: row.paid_at,
        publicCode: row.public_code,
        purchasedSessions: row.purchased_sessions,
        status: row.status,
        topupType: row.topup_type === "renewal" ? "renewal" : "new",
      }));

    return summarizePaymentRequests(requests);
  } catch {
    return null;
  }
}

/**
 * Next scheduled or running session of the student's active class. Composite
 * classes hold their sessions on component classes, so those are included.
 */
export async function getStudentUpcomingSession(classId: string): Promise<StudentUpcomingSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const today = getVietnamToday();
    const { data: links } = await supabase
      .from("class_component_links")
      .select("component_class_id")
      .eq("parent_class_id", classId)
      .is("effective_to", null);
    const classIds = [classId, ...(links ?? []).map((link) => link.component_class_id)];
    const { data, error } = await supabase
      .from("class_sessions")
      .select(
        `
        id,
        session_date,
        start_time,
        end_time,
        learning_mode,
        room_name,
        status,
        class:classes!class_sessions_class_id_fkey ( code, name )
        `,
      )
      .in("class_id", classIds)
      .gte("session_date", today)
      // A session that already ended today is not "next"; the auto-end job may lag.
      .or(`session_date.gt.${today},end_time.gte.${getVietnamTime()}`)
      .in("status", ["scheduled", "in_progress"])
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const klass = data.class as unknown as { code: string; name: string } | null;

    return {
      classCode: klass?.code ?? "",
      className: klass?.name ?? "Lớp không xác định",
      endTime: data.end_time,
      id: data.id,
      learningMode: data.learning_mode,
      roomName: data.room_name,
      sessionDate: data.session_date,
      startTime: data.start_time,
      status: data.status,
    };
  } catch {
    return null;
  }
}
