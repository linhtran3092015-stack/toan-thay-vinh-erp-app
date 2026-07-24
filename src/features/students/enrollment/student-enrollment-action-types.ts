export type StudentEnrollmentRegisteredMode =
  | "online"
  | "offline";

export type StudentEnrollmentActionStatus =
  | "error"
  | "success";

export interface EnrollStudentInput {
  classId: string;
  effectiveFrom: string;
  reason: string;
  registeredMode: StudentEnrollmentRegisteredMode;
  studentId: string;
}

export interface TransferStudentInput {
  effectiveFrom: string;
  reason: string;
  registeredMode: StudentEnrollmentRegisteredMode;
  studentId: string;
  targetClassId: string;
}

export interface ReserveStudentInput {
  reason: string;
  reservedFrom: string;
  studentId: string;
}

export interface ResumeStudentInput {
  effectiveFrom: string;
  reason: string;
  registeredMode: StudentEnrollmentRegisteredMode;
  studentId: string;
  targetClassId: string;
}

export interface StudentEnrollmentActionState {
  classId?: string;
  enrollmentId?: string;
  fieldErrors?: Record<
    string,
    string[] | undefined
  >;
  message: string;
  redirectTo?: string;
  status: StudentEnrollmentActionStatus;
  studentId?: string;
}
