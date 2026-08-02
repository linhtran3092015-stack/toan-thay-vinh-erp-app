import "server-only";

import type {
  CoachingAssigneeOption,
  CoachingManagementOptions,
  CoachingPriority,
  CoachingReadResult,
  CoachingRecordDashboardEntry,
  CoachingRecordEvent,
  CoachingStatus,
  CoachingStudentOption,
} from "@/features/coaching/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizePriority(value: string): CoachingPriority {
  if (value === "high" || value === "low" || value === "medium") {
    return value;
  }

  return "medium";
}

function normalizeStatus(value: string): CoachingStatus {
  if (value === "closed" || value === "in_progress" || value === "open") {
    return value;
  }

  return "open";
}

function normalizeEventType(
  value: string,
): CoachingRecordEvent["eventType"] {
  if (
    value === "note_added" ||
    value === "opened" ||
    value === "outcome_recorded" ||
    value === "status_changed"
  ) {
    return value;
  }

  return "note_added";
}

function toDashboardEntry(entry: {
  assistant_owner_display_name: string;
  assistant_owner_id: string;
  campaign_name: string;
  coaching_record_id: string;
  current_status: string;
  latest_event_at: string | null;
  latest_outcome: string | null;
  opened_at: string;
  priority: string;
  reason: string;
  review_at: string | null;
  student_full_name: string;
  student_id: string;
  student_public_code: string;
}): CoachingRecordDashboardEntry {
  return {
    assistantOwnerDisplayName: entry.assistant_owner_display_name,
    assistantOwnerId: entry.assistant_owner_id,
    campaignName: entry.campaign_name,
    currentStatus: normalizeStatus(entry.current_status),
    id: entry.coaching_record_id,
    latestEventAt: entry.latest_event_at,
    latestOutcome: entry.latest_outcome,
    openedAt: entry.opened_at,
    priority: normalizePriority(entry.priority),
    reason: entry.reason,
    reviewAt: entry.review_at,
    studentFullName: entry.student_full_name,
    studentId: entry.student_id,
    studentPublicCode: entry.student_public_code,
  };
}

export async function getCoachingRecordsDashboardResult(): Promise<
  CoachingReadResult<readonly CoachingRecordDashboardEntry[]>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_coaching_records_dashboard", {
      p_limit: 200,
    });

    if (error || !data) {
      return { ok: false };
    }

    return { data: data.map(toDashboardEntry), ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getCoachingRecordDetailResult(
  coachingRecordId: string,
): Promise<CoachingReadResult<CoachingRecordDashboardEntry | null>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_coaching_record_detail", {
      p_coaching_record_id: coachingRecordId,
    });

    if (error || !data) {
      return { ok: false };
    }

    return { data: data[0] ? toDashboardEntry(data[0]) : null, ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getCoachingRecordEventsResult(
  coachingRecordId: string,
): Promise<CoachingReadResult<readonly CoachingRecordEvent[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_coaching_record_events", {
      p_coaching_record_id: coachingRecordId,
    });

    if (error || !data) {
      return { ok: false };
    }

    return {
      data: data.map((entry) => ({
        eventType: normalizeEventType(entry.event_type),
        id: entry.coaching_record_event_id,
        note: entry.note,
        occurredAt: entry.occurred_at,
        occurredByDisplayName: entry.occurred_by_display_name,
        outcome: entry.outcome,
        status: entry.status ? normalizeStatus(entry.status) : null,
      })),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

export async function getCoachingManagementOptionsResult(): Promise<
  CoachingReadResult<CoachingManagementOptions>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const [studentsResult, assigneesResult] = await Promise.all([
      supabase.rpc("get_coaching_student_options", { p_limit: 500 }),
      supabase.rpc("get_coaching_assignee_options"),
    ]);

    if (
      studentsResult.error ||
      !studentsResult.data ||
      assigneesResult.error ||
      !assigneesResult.data
    ) {
      return { ok: false };
    }

    const students: CoachingStudentOption[] = studentsResult.data.map((student) => ({
      fullName: student.student_full_name,
      id: student.student_id,
      lifecycleStatus: student.lifecycle_status,
      publicCode: student.student_public_code,
    }));

    const assignees: CoachingAssigneeOption[] = assigneesResult.data.map(
      (assignee) => ({
        displayName: assignee.display_name,
        id: assignee.profile_id,
        roleCode:
          assignee.role_code === "owner" ? "owner" : "assistant_manager",
      }),
    );

    return { data: { assignees, students }, ok: true };
  } catch {
    return { ok: false };
  }
}
