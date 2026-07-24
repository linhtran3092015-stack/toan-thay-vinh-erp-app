import type {
  ClassLearningLevel,
  ClassLearningMode,
} from "@/features/classes/read-models";
import type {
  StudentEnrollmentReadModel,
  StudentRegisteredMode,
} from "@/features/students/read-models";

export type StudentEnrollmentOperation =
  | "enroll"
  | "reserve"
  | "resume"
  | "transfer";

export interface StudentEnrollmentClassOption {
  academicYearName: string | null;
  code: string;
  defaultLearningMode: ClassLearningMode;
  grade: number;
  id: string;
  level: ClassLearningLevel;
  name: string;
}

export interface StudentEnrollmentActionAvailability {
  enabled: boolean;
  reason: string | null;
  visible: boolean;
}

export interface StudentEnrollmentActionMap {
  enroll: StudentEnrollmentActionAvailability;
  reserve: StudentEnrollmentActionAvailability;
  resume: StudentEnrollmentActionAvailability;
  transfer: StudentEnrollmentActionAvailability;
}

export interface StudentEnrollmentUiModel {
  actions: StudentEnrollmentActionMap;
  activeEnrollment: StudentEnrollmentReadModel | null;
  businessDate: string;
  classOptions: StudentEnrollmentClassOption[];
  classOptionsError: string | null;
  defaultRegisteredMode: StudentRegisteredMode;
  latestEnrollment: StudentEnrollmentReadModel | null;
  transferClassOptions: StudentEnrollmentClassOption[];
}
