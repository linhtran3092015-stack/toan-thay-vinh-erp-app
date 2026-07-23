import type { StudentLifecycleStatus } from "@/types/domain";

export type StudentLearningLevel = "A" | "B" | "CLC";
export type StudentRegisteredMode = "online" | "offline";

export interface StudentGuardianReadModel {
  email: string | null;
  fullName: string;
  id: string;
  isPrimary: boolean;
  phone: string;
  relationship: string;
  zalo: string | null;
}

export interface StudentClassReadModel {
  code: string;
  defaultLearningMode: string;
  grade: number;
  id: string;
  level: StudentLearningLevel;
  name: string;
  status: string;
}

export interface StudentEnrollmentReadModel {
  classInfo: StudentClassReadModel | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  endReason: string | null;
  id: string;
  registeredMode: StudentRegisteredMode;
  startReason: string | null;
  status: string;
  transitionKind: string;
}

export interface StudentScheduleReadModel {
  componentCode: string | null;
  effectiveFrom: string;
  endTime: string;
  id: string;
  learningMode: string;
  meetingUrl: string | null;
  roomName: string | null;
  startTime: string;
  weekday: number;
}

export interface StudentDirectoryFiltersState {
  className: string;
  grade: string;
  learningLevel: string;
  registeredMode: string;
  search: string;
  status: string;
}

export interface StudentDirectoryItem {
  activeEnrollment: StudentEnrollmentReadModel | null;
  birthYear: number;
  currentGrade: number;
  fullName: string;
  id: string;
  learningLevel: StudentLearningLevel | null;
  lifecycleStatus: StudentLifecycleStatus;
  nickname: string | null;
  primaryGuardian: StudentGuardianReadModel | null;
  publicCode: string;
  registeredMode: StudentRegisteredMode | null;
}

export interface StudentDetailReadModel extends StudentDirectoryItem {
  activeSchedules: StudentScheduleReadModel[];
  enrollmentHistory: StudentEnrollmentReadModel[];
  guardians: StudentGuardianReadModel[];
  internalNotes: string | null;
  learningGoal: string | null;
  officialStartDate: string | null;
  provinceCity: string | null;
}

export type StudentDataErrorCode =
  | "classes_query_failed"
  | "enrollments_query_failed"
  | "guardian_links_query_failed"
  | "guardians_query_failed"
  | "invalid_student_data"
  | "schedules_query_failed"
  | "student_not_found"
  | "students_query_failed";

export interface StudentDataError {
  code: StudentDataErrorCode;
  message: string;
}

export type StudentDirectoryResult =
  | {
      ok: true;
      students: StudentDirectoryItem[];
    }
  | {
      ok: false;
      error: StudentDataError;
    };

export type StudentDetailResult =
  | {
      ok: true;
      detail: StudentDetailReadModel;
    }
  | {
      ok: false;
      error: StudentDataError;
    };
