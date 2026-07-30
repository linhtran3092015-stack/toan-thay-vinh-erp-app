export type TimekeepingManagementActionStatus =
  | "idle"
  | "error"
  | "success";

export interface TimekeepingManagementActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: TimekeepingManagementActionStatus;
}

export const initialTimekeepingManagementActionState: TimekeepingManagementActionState =
  {
    message: "",
    status: "idle",
  };

export interface WorkShiftWriteFields {
  breakMinutes: number;
  code: string;
  crossesMidnight: boolean;
  endTime: string;
  name: string;
  notes: string;
  reason: string;
  startTime: string;
}

export type CreateWorkShiftActionInput = WorkShiftWriteFields;

export interface UpdateWorkShiftActionInput extends WorkShiftWriteFields {
  workShiftId: string;
}

export interface RetireWorkShiftActionInput {
  reason: string;
  workShiftId: string;
}

export interface CreateStaffShiftAssignmentActionInput {
  effectiveFrom: string;
  reason: string;
  staffId: string;
  weekday: number;
  workShiftId: string;
}

export interface ReplaceStaffShiftAssignmentActionInput {
  effectiveFrom: string;
  reason: string;
  staffShiftAssignmentId: string;
  workShiftId: string;
}

export interface EndStaffShiftAssignmentActionInput {
  effectiveTo: string;
  reason: string;
  staffShiftAssignmentId: string;
}
