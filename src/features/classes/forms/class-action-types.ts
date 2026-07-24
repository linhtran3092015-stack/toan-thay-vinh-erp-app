import type {
  ClassLearningLevel,
  ClassLearningMode,
} from "@/features/classes/read-models";

export type ClassManagementActionStatus =
  | "idle"
  | "error"
  | "success";

export type AcademicYearTargetStatus =
  | "closed"
  | "archived";

export type ClassTargetStatus =
  | "active"
  | "closed"
  | "archived";

export interface ClassManagementActionState {
  fieldErrors?: Record<
    string,
    string[] | undefined
  >;
  message: string;
  redirectTo?: string;
  status: ClassManagementActionStatus;
}

export const initialClassManagementActionState: ClassManagementActionState =
  {
    message: "",
    status: "idle",
  };

export interface AcademicYearWriteFields {
  code: string;
  endsOn: string;
  name: string;
  startsOn: string;
}

export type CreateAcademicYearActionInput =
  AcademicYearWriteFields;

export interface ActivateAcademicYearActionInput {
  academicYearId: string;
  reason: string;
}

export interface ChangeAcademicYearStatusActionInput {
  academicYearId: string;
  reason: string;
  targetStatus: AcademicYearTargetStatus;
}

export interface ClassWriteFields {
  academicYearId: string;
  classinUrl: string;
  code: string;
  defaultLearningMode: ClassLearningMode;
  grade: number;
  level: ClassLearningLevel;
  name: string;
  notes: string;
  weeklySessionCount: number;
}

export type CreateClassActionInput =
  ClassWriteFields;

export interface UpdateClassActionInput
  extends ClassWriteFields {
  classId: string;
  reason: string;
}

export interface ChangeClassStatusActionInput {
  classId: string;
  reason: string;
  targetStatus: ClassTargetStatus;
}

export interface ClassScheduleWriteFields {
  componentCode: string;
  effectiveFrom: string;
  endTime: string;
  learningMode: ClassLearningMode;
  meetingUrl: string;
  roomName: string;
  startTime: string;
  weekday: number;
}

export interface CreateClassScheduleActionInput
  extends ClassScheduleWriteFields {
  classId: string;
}

export interface ReplaceClassScheduleActionInput
  extends Omit<
    ClassScheduleWriteFields,
    "componentCode"
  > {
  reason: string;
  scheduleTemplateId: string;
}

export interface EndClassScheduleActionInput {
  effectiveTo: string;
  reason: string;
  scheduleTemplateId: string;
}
