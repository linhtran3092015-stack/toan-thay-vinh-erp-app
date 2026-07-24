export type ClassLearningLevel = "A" | "B" | "CLC";
export type ClassLearningMode =
  | "hybrid"
  | "offline"
  | "online";

export interface AcademicYearReadModel {
  code: string;
  endsOn: string;
  id: string;
  isCurrent: boolean;
  name: string;
  startsOn: string;
  status: string;
}

export interface ClassScheduleReadModel {
  componentCode: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  endReason: string | null;
  endTime: string;
  id: string;
  isActive: boolean;
  learningMode: ClassLearningMode;
  meetingUrl: string | null;
  roomName: string | null;
  startTime: string;
  weekday: number;
}

export interface ClassDirectoryItem {
  academicYear: AcademicYearReadModel | null;
  activeScheduleCount: number;
  activeStudentCount: number | null;
  code: string;
  defaultLearningMode: ClassLearningMode;
  grade: number;
  id: string;
  level: ClassLearningLevel;
  name: string;
  notes: string | null;
  status: string;
  weeklySessionCount: number;
}

export interface ClassDetailReadModel
  extends ClassDirectoryItem {
  classinUrl: string | null;
  schedules: ClassScheduleReadModel[];
}

export type ClassDataErrorCode =
  | "academic_years_query_failed"
  | "class_not_found"
  | "classes_query_failed"
  | "enrollments_query_failed"
  | "invalid_class_data"
  | "schedules_query_failed";

export interface ClassDataError {
  code: ClassDataErrorCode;
  message: string;
}

export type ClassDirectoryResult =
  | {
      ok: true;
      classes: ClassDirectoryItem[];
    }
  | {
      ok: false;
      error: ClassDataError;
    };

export type ClassDetailResult =
  | {
      ok: true;
      detail: ClassDetailReadModel;
    }
  | {
      ok: false;
      error: ClassDataError;
    };

export interface AcademicYearClassCounts {
  active: number;
  archived: number;
  closed: number;
  draft: number;
  total: number;
}

export interface AcademicYearManagementItem
  extends AcademicYearReadModel {
  classCounts: AcademicYearClassCounts;
}

export type AcademicYearManagementDataErrorCode =
  | "academic_years_query_failed"
  | "classes_query_failed"
  | "invalid_academic_year_data";

export interface AcademicYearManagementDataError {
  code: AcademicYearManagementDataErrorCode;
  message: string;
}

export type AcademicYearManagementResult =
  | {
      academicYears: AcademicYearManagementItem[];
      ok: true;
    }
  | {
      error: AcademicYearManagementDataError;
      ok: false;
    };
