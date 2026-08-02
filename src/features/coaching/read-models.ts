export type CoachingPriority = "high" | "low" | "medium";
export type CoachingStatus = "closed" | "in_progress" | "open";

export interface CoachingRecordDashboardEntry {
  assistantOwnerDisplayName: string;
  assistantOwnerId: string;
  campaignName: string;
  currentStatus: CoachingStatus;
  id: string;
  latestEventAt: string | null;
  latestOutcome: string | null;
  openedAt: string;
  priority: CoachingPriority;
  reason: string;
  reviewAt: string | null;
  studentFullName: string;
  studentId: string;
  studentPublicCode: string;
}

export interface CoachingRecordEvent {
  eventType: "note_added" | "opened" | "outcome_recorded" | "status_changed";
  id: string;
  note: string | null;
  occurredAt: string;
  occurredByDisplayName: string;
  outcome: string | null;
  status: CoachingStatus | null;
}

export interface CoachingStudentOption {
  fullName: string;
  id: string;
  lifecycleStatus: string;
  publicCode: string;
}

export interface CoachingAssigneeOption {
  displayName: string;
  id: string;
  roleCode: "assistant_manager" | "owner";
}

export interface CoachingManagementOptions {
  assignees: readonly CoachingAssigneeOption[];
  students: readonly CoachingStudentOption[];
}

export type CoachingReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
