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
  { value: "withdrawn", label: "Đã nghỉ" },
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
  withdrawn: { label: "Đã nghỉ", tone: "neutral" },
};

export function normalizeStudentSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d");
}

export function normalizeStudentPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export interface IndexedStudentItem {
  className: string;
  gradeString: string;
  learningLevel: string | null;
  lifecycleStatus: string;
  normalizedPhone: string;
  registeredMode: string | null;
  searchCorpus: string;
  student: StudentDirectoryItem;
}

export function createStudentSearchIndex(
  students: readonly StudentDirectoryItem[],
): IndexedStudentItem[] {
  return students.map((student) => {
    const guardian = student.primaryGuardian;
    const activeClass = student.activeEnrollment?.classInfo;
    const className = activeClass?.name ?? "";
    const learningLevel = activeClass?.level ?? student.learningLevel;
    const registeredMode =
      student.activeEnrollment?.registeredMode ?? student.registeredMode;

    const parts = [
      student.fullName,
      student.publicCode,
      student.nickname ?? "",
      guardian?.fullName ?? "",
    ];
    const searchCorpus = parts
      .map((part) => normalizeStudentSearch(part))
      .filter((s) => s.length > 0)
      .join(" ");

    const normalizedPhone = guardian
      ? normalizeStudentPhone(guardian.phone)
      : "";

    return {
      className,
      gradeString: String(student.currentGrade),
      learningLevel,
      lifecycleStatus: student.lifecycleStatus,
      normalizedPhone,
      registeredMode,
      searchCorpus,
      student,
    };
  });
}

export function filterIndexedStudents(
  indexedStudents: readonly IndexedStudentItem[],
  filters: StudentDirectoryFiltersState,
): StudentDirectoryItem[] {
  const rawSearch = filters.search.trim();
  const hasSearch = rawSearch.length > 0;
  const normalizedSearch = hasSearch ? normalizeStudentSearch(rawSearch) : "";
  const normalizedPhoneSearch = hasSearch ? normalizeStudentPhone(rawSearch) : "";
  const searchWords =
    normalizedSearch.length > 0
      ? normalizedSearch.split(/\s+/).filter((word) => word.length > 0)
      : [];

  const results: StudentDirectoryItem[] = [];

  for (let i = 0; i < indexedStudents.length; i++) {
    const item = indexedStudents[i];

    if (filters.grade !== "all" && item.gradeString !== filters.grade) {
      continue;
    }
    if (filters.className !== "all" && item.className !== filters.className) {
      continue;
    }
    if (filters.status !== "all" && item.lifecycleStatus !== filters.status) {
      continue;
    }
    if (filters.learningLevel !== "all" && item.learningLevel !== filters.learningLevel) {
      continue;
    }
    if (filters.registeredMode !== "all" && item.registeredMode !== filters.registeredMode) {
      continue;
    }

    if (hasSearch) {
      const matchesPhone =
        normalizedPhoneSearch.length > 0 &&
        item.normalizedPhone.length > 0 &&
        item.normalizedPhone.includes(normalizedPhoneSearch);

      if (!matchesPhone) {
        if (searchWords.length > 0) {
          let matchesAllWords = true;
          for (let j = 0; j < searchWords.length; j++) {
            if (!item.searchCorpus.includes(searchWords[j])) {
              matchesAllWords = false;
              break;
            }
          }
          if (!matchesAllWords) {
            continue;
          }
        }
      }
    }

    results.push(item.student);
  }

  return results;
}

export function filterStudents(
  students: StudentDirectoryItem[],
  filters: StudentDirectoryFiltersState,
): StudentDirectoryItem[] {
  const indexed = createStudentSearchIndex(students);
  return filterIndexedStudents(indexed, filters);
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
