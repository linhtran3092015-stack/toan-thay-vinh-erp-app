import type { TimeEntryMode } from "@/features/timekeeping/types";

export interface TimekeepingAdjustmentRequestInput {
  requestReason: string;
  requestedCheckInAt: string;
  requestedCheckInMode: TimeEntryMode;
  requestedCheckOutAt: string;
  requestedCheckOutMode: TimeEntryMode;
  timeEntryId: string;
}

export interface TimekeepingAdjustmentDecisionInput {
  decision: "approved" | "rejected";
  decisionReason: string;
  requestId: string;
}

export interface TimekeepingAdjustmentActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: "error" | "idle" | "success";
}

export const initialTimekeepingAdjustmentActionState: TimekeepingAdjustmentActionState = {
  message: "",
  status: "idle",
};
