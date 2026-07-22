import type { StudentLifecycleStatus } from "@/types/domain";
import type {
  Student,
  StudentFiltersState,
  StudentStatusMeta,
} from "./types";

export const STUDENTS_PAGE_SIZE = 20;

export const defaultStudentFilters: StudentFiltersState = {
  alert: "all",
  balance: "all",
  className: "all",
  communicationGroup: "all",
  grade: "all",
  leadSourceGroup: "all",
  learningLevel: "all",
  registeredMode: "all",
  saleOwnerName: "all",
  search: "",
  status: "all",
};

export const studentStatusOptions: Array<{
  value: StudentLifecycleStatus;
  label: string;
}> = [
  { value: "interested", label: "Đang quan tâm" },
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

export const studentStatusMeta: Record<StudentLifecycleStatus, StudentStatusMeta> =
  {
    active: { label: "Đang học", tone: "success" },
    completed: { label: "Hoàn thành", tone: "success" },
    interested: { label: "Đang quan tâm", tone: "info" },
    pending_enrollment_confirmation: {
      label: "Chờ xác nhận nhập học",
      tone: "warning",
    },
    reserved: { label: "Bảo lưu", tone: "warning" },
    resumed: { label: "Quay lại học", tone: "purple" },
    trial_booked: { label: "Đã đặt lịch học thử", tone: "purple" },
    trial_completed: { label: "Đã học thử", tone: "purple" },
    waiting_class: { label: "Chờ chọn lớp", tone: "info" },
  };

export function filterStudents(
  students: Student[],
  filters: StudentFiltersState,
): Student[] {
  const normalizedSearch = normalize(filters.search);
  const normalizedPhoneSearch = normalizePhone(filters.search);

  return students.filter((student) => {
    const matchesPhoneSearch =
      normalizedPhoneSearch.length > 0 &&
      normalizePhone(student.guardianPhone).includes(normalizedPhoneSearch);
    const matchesSearch =
      normalizedSearch.length === 0 ||
      normalize(student.fullName).includes(normalizedSearch) ||
      normalize(student.publicCode).includes(normalizedSearch) ||
      matchesPhoneSearch;

    const matchesGrade =
      filters.grade === "all" || String(student.currentGrade) === filters.grade;
    const matchesClass =
      filters.className === "all" || student.mainClassName === filters.className;
    const matchesStatus =
      filters.status === "all" || student.lifecycleStatus === filters.status;
    const matchesLevel =
      filters.learningLevel === "all" ||
      student.learningLevel === filters.learningLevel;
    const matchesMode =
      filters.registeredMode === "all" ||
      student.registeredMode === filters.registeredMode;
    const matchesSource =
      filters.leadSourceGroup === "all" ||
      student.leadSourceGroup === filters.leadSourceGroup;
    const matchesSale =
      filters.saleOwnerName === "all" ||
      student.saleOwnerName === filters.saleOwnerName;
    const matchesBalance =
      filters.balance === "all" ||
      (filters.balance === "positive" && student.sessionBalance > 0) ||
      (filters.balance === "zero" && student.sessionBalance === 0) ||
      (filters.balance === "negative" && student.sessionBalance < 0);
    const matchesAlert =
      filters.alert === "all" ||
      (filters.alert === "has_alert" && student.alertCount > 0);
    const matchesCommunicationGroup =
      filters.communicationGroup === "all" ||
      (filters.communicationGroup === "has_group" &&
        student.hasCommunicationGroup) ||
      (filters.communicationGroup === "no_group" &&
        !student.hasCommunicationGroup);

    return (
      matchesSearch &&
      matchesGrade &&
      matchesClass &&
      matchesStatus &&
      matchesLevel &&
      matchesMode &&
      matchesSource &&
      matchesSale &&
      matchesBalance &&
      matchesAlert &&
      matchesCommunicationGroup
    );
  });
}

export function paginateStudents(students: Student[], page: number) {
  const pageCount = Math.max(1, Math.ceil(students.length / STUDENTS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * STUDENTS_PAGE_SIZE;

  return {
    end: Math.min(start + STUDENTS_PAGE_SIZE, students.length),
    page: safePage,
    pageCount,
    rows: students.slice(start, start + STUDENTS_PAGE_SIZE),
    start: students.length === 0 ? 0 : start + 1,
  };
}

export function hasActiveStudentFilters(filters: StudentFiltersState): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (key === "search") {
      return value.trim().length > 0;
    }

    return value !== "all";
  });
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
