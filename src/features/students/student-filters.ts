import type {
  StudentDirectoryFiltersState,
  StudentDirectoryItem,
} from "@/features/students/read-models";
import type { StudentLifecycleStatus } from "@/types/domain";
import type { StudentStatusMeta } from "./types";

export const STUDENTS_PAGE_SIZE = 20;

export const defaultStudentFilters: StudentDirectoryFiltersState = {
  className: "all",
  grade: "all",
  learningLevel: "all",
  registeredMode: "all",
  search: "",
  status: "all",
};

export const studentStatusOptions: Array<{
  value: StudentLifecycleStatus;
  label: string;
}> = [
  { value: "interested", label: "Đang quan tâm" },
  { value: "trial_booked", label: "Đã đặt lịch học thử" },
  { value: "trial_completed", label: "Đã học thử" },
  {
    value: "pending_enrollment_confirmation",
    label: "Chờ xác nhận nhập học",
  },
  { value: "active", label: "Đang học" },
  { value: "reserved", label: "Bảo lưu" },
  { value: "resumed", label: "Quay lại học" },
  { value: "waiting_class", label: "Chờ chọn lớp" },
  { value: "completed", label: "Hoàn thành" },
];

export const studentStatusMeta: Record<
  StudentLifecycleStatus,
  StudentStatusMeta
> = {
  active: { label: "Đang học", tone: "success" },
  completed: { label: "Hoàn thành", tone: "success" },
  interested: { label: "Đang quan tâm", tone: "info" },
  pending_enrollment_confirmation: {
    label: "Chờ xác nhận nhập học",
    tone: "warning",
  },
  reserved: { label: "Bảo lưu", tone: "warning" },
  resumed: { label: "Quay lại học", tone: "info" },
  trial_booked: {
    label: "Đã đặt lịch học thử",
    tone: "info",
  },
  trial_completed: { label: "Đã học thử", tone: "info" },
  waiting_class: { label: "Chờ chọn lớp", tone: "info" },
};

export function filterStudents(
  students: StudentDirectoryItem[],
  filters: StudentDirectoryFiltersState,
): StudentDirectoryItem[] {
  const normalizedSearch = normalize(filters.search);
  const normalizedPhoneSearch = normalizePhone(filters.search);

  return students.filter((student) => {
    const guardian = student.primaryGuardian;
    const activeClass = student.activeEnrollment?.classInfo;
    const className = activeClass?.name ?? "";
    const learningLevel =
      activeClass?.level ?? student.learningLevel;
    const registeredMode =
      student.activeEnrollment?.registeredMode ??
      student.registeredMode;

    const matchesPhoneSearch =
      normalizedPhoneSearch.length > 0 &&
      guardian !== null &&
      normalizePhone(guardian.phone).includes(
        normalizedPhoneSearch,
      );

    const matchesSearch =
      normalizedSearch.length === 0 ||
      normalize(student.fullName).includes(normalizedSearch) ||
      normalize(student.publicCode).includes(normalizedSearch) ||
      normalize(student.nickname ?? "").includes(normalizedSearch) ||
      normalize(guardian?.fullName ?? "").includes(
        normalizedSearch,
      ) ||
      matchesPhoneSearch;

    const matchesGrade =
      filters.grade === "all" ||
      String(student.currentGrade) === filters.grade;

    const matchesClass =
      filters.className === "all" ||
      className === filters.className;

    const matchesStatus =
      filters.status === "all" ||
      student.lifecycleStatus === filters.status;

    const matchesLevel =
      filters.learningLevel === "all" ||
      learningLevel === filters.learningLevel;

    const matchesMode =
      filters.registeredMode === "all" ||
      registeredMode === filters.registeredMode;

    return (
      matchesSearch &&
      matchesGrade &&
      matchesClass &&
      matchesStatus &&
      matchesLevel &&
      matchesMode
    );
  });
}

export function paginateStudents(
  students: StudentDirectoryItem[],
  page: number,
) {
  const pageCount = Math.max(
    1,
    Math.ceil(students.length / STUDENTS_PAGE_SIZE),
  );
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * STUDENTS_PAGE_SIZE;

  return {
    end: Math.min(
      start + STUDENTS_PAGE_SIZE,
      students.length,
    ),
    page: safePage,
    pageCount,
    rows: students.slice(
      start,
      start + STUDENTS_PAGE_SIZE,
    ),
    start: students.length === 0 ? 0 : start + 1,
  };
}

export function hasActiveStudentFilters(
  filters: StudentDirectoryFiltersState,
): boolean {
  return countActiveStudentFilters(filters) > 0;
}

/** Counts only non-default directory filters; pagination is not a filter. */
export function countActiveStudentFilters(
  filters: StudentDirectoryFiltersState,
): number {
  return Object.entries(filters).filter(([key, value]) => {
    if (key === "search") {
      return value.trim().length > 0;
    }

    return value !== "all";
  }).length;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}
