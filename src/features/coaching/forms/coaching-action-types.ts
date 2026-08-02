import type {
  CoachingPriority,
  CoachingStatus,
} from "@/features/coaching/read-models";

export type CoachingManagementActionStatus = "error" | "idle" | "success";

export interface CoachingManagementActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  redirectTo?: string;
  status: CoachingManagementActionStatus;
}

export const initialCoachingManagementActionState: CoachingManagementActionState = {
  message: "",
  status: "idle",
};

export interface CreateCoachingRecordActionInput {
  assistantOwnerId: string;
  campaignName: string;
  priority: CoachingPriority;
  reason: string;
  reviewAt: string;
  studentId: string;
}

export interface AddCoachingNoteActionInput {
  coachingRecordId: string;
  note: string;
}

export interface AdvanceCoachingStatusActionInput {
  coachingRecordId: string;
  note: string;
  outcome: string;
  targetStatus: Extract<CoachingStatus, "closed" | "in_progress">;
}
