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

export type CoachingReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };
