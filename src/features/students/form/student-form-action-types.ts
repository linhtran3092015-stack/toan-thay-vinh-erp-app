export type StudentFormActionStatus = "idle" | "error" | "success";

export interface StudentWriteFields {
  birthYear: number;
  currentGrade: number;
  duplicateOverrideReason: string;
  fullName: string;
  guardianEmail: string;
  guardianFullName: string;
  guardianNote: string;
  guardianPhone: string;
  guardianRelationship: string;
  guardianZalo: string;
  internalNote: string;
  learningGoal: string;
  learningLevel: "A" | "B" | "CLC";
  nickname: string;
  provinceName: string;
  reason: string;
  registeredMode: "online" | "offline";
}

export type CreateStudentActionInput = StudentWriteFields;

export interface UpdateStudentActionInput extends StudentWriteFields {
  studentId: string;
}

export interface StudentDuplicateLookupInput {
  birthYear: number;
  fullName: string;
  guardianPhone: string;
  studentId?: string;
}

export interface StudentDuplicateLinkedStudent {
  birthYear: number;
  fullName: string;
  id: string;
  isExactDuplicate: boolean;
  lifecycleStatus: string;
  publicCode: string;
}

export interface StudentDuplicateGuardian {
  children: StudentDuplicateLinkedStudent[];
  fullName: string;
  id: string;
  phone: string;
}

export type StudentDuplicateLookupResult =
  | {
      guardian: StudentDuplicateGuardian | null;
      hasExactStudentDuplicate: boolean;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

export interface StudentFormActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  guardianReused?: boolean;
  message: string;
  redirectTo?: string;
  status: StudentFormActionStatus;
  studentId?: string;
  studentPublicCode?: string;
}

export const initialStudentFormActionState: StudentFormActionState = {
  message: "",
  status: "idle",
};
