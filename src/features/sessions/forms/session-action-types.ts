import type {
  SessionKind,
  SessionLearningMode,
} from "@/features/sessions/read-models";

export interface CreateSessionActionInput {
  classId: string;
  componentCode?: string | null;
  endTime?: string | null;
  learningMode?: SessionLearningMode | null;
  makeupForSessionId?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
  roomName?: string | null;
  scheduleTemplateId?: string | null;
  sessionDate: string;
  sessionKind: SessionKind;
  startTime?: string | null;
}

export interface SessionIdActionInput {
  sessionId: string;
}

export interface CancelSessionActionInput
  extends SessionIdActionInput {
  reason: string;
}

export interface RescheduleSessionActionInput
  extends SessionIdActionInput {
  endTime: string;
  learningMode: SessionLearningMode;
  meetingUrl?: string | null;
  notes?: string | null;
  reason: string;
  roomName?: string | null;
  sessionDate: string;
  startTime: string;
}

export type SessionLifecycleFieldErrors =
  Record<string, string[] | undefined>;

export type SessionLifecycleActionState =
  | {
      fieldErrors?: SessionLifecycleFieldErrors;
      message: string;
      status: "error";
    }
  | {
      message: string;
      redirectTo?: string;
      sessionId: string;
      status: "success";
    };
