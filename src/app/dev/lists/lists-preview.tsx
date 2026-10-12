"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ClassListPage } from "@/features/classes/class-list-page";
import type { ClassDirectoryItem } from "@/features/classes/read-models";
import type { StudentDirectoryItem } from "@/features/students/read-models";
import type { StudentDirectoryMetrics } from "@/features/students/student-directory-metrics";
import { StudentListPage } from "@/features/students/student-list-page";
import { DATABASE_PERMISSION_CODES } from "@/lib/permissions/types";
import type { StudentLifecycleStatus } from "@/types/domain";

const classNames = [
  "Toán 9A tối 2-4-6",
  "Toán 9B tối 3-5-7",
  "Toán 8B chiều 3-5-7",
  "Toán 7A chiều 2-4",
  "Toán 6A sáng 2-4-6",
];

const people: Array<[string, string, string, StudentLifecycleStatus, number]> = [
  ["Nguyễn Minh Anh", "Nguyễn Văn Hải", "0912 345 678", "active", 0],
  ["Trần Gia Bảo", "Trần Quốc Dũng", "0903 112 233", "reserved", 0],
  ["Lê Hoàng Nam", "Lê Thị Hương", "0978 445 566", "active", 0],
  ["Phạm Thu Hà", "Phạm Văn Toàn", "0966 778 899", "active", 1],
  ["Vũ Đức Huy", "Vũ Thị Nga", "0932 556 677", "active", 1],
  ["Đỗ Khánh Linh", "Đỗ Mạnh Cường", "0918 223 344", "waiting_class", 2],
  ["Bùi Quang Minh", "Bùi Thu Trang", "0975 334 455", "active", 2],
  ["Hoàng Ngọc Mai", "Hoàng Anh Tuấn", "0908 667 788", "withdrawn", 3],
  ["Ngô Tuấn Kiệt", "Ngô Thị Bích", "0944 889 900", "active", 3],
  ["Lý Nhật Quang", "Lý Văn Sơn", "0989 001 122", "active", 4],
  ["Đặng Hải Đăng", "Đặng Văn Lâm", "0911 222 333", "active", 0],
  ["Trịnh Bảo Châu", "Trịnh Thị Lan", "0922 333 444", "reserved", 1],
];

const students: StudentDirectoryItem[] = people.map(([fullName, guardian, phone, status, classIndex], index) => {
  const className = classNames[classIndex];
  const grade = Number(className.match(/Toán (\d+)/)?.[1] ?? 9);
  const hasClass = status !== "waiting_class" && status !== "withdrawn";

  return {
    activeEnrollment: hasClass
      ? {
          classInfo: {
            code: `L-${grade}A26`,
            defaultLearningMode: "offline",
            grade,
            id: `class-${classIndex}`,
            level: "A",
            name: className,
            status: "active",
          },
          effectiveFrom: "2026-09-01",
          effectiveTo: null,
          endReason: null,
          id: `enr-${index}`,
          registeredMode: index % 5 === 0 ? "online" : "offline",
          startReason: null,
          status: "active",
          transitionKind: "initial",
        }
      : null,
    birthYear: 2026 - grade - 6,
    currentGrade: grade,
    fullName,
    id: `student-${index}`,
    learningLevel: index % 3 === 0 ? "B" : "A",
    lifecycleStatus: status,
    nickname: null,
    primaryGuardian: {
      email: null,
      fullName: guardian,
      id: `guardian-${index}`,
      isPrimary: true,
      notes: null,
      phone,
      relationship: "Bố/Mẹ",
      zalo: null,
    },
    publicCode: `TTV-${String(100 + index * 7).padStart(5, "0")}`,
    registeredMode: "offline",
  };
});

// Design 06 sample values; index 5 (waiting for a class) has no attendance in the window.
const attendanceRates = [96, 71, 100, 89, 93, null, 84, 62, 97, 90, 100, 78];
const balances = [-1, 4, 7, 2, 5, 0, 9, 0, 3, 12, 6, 1];
const debts = [2_400_000, 0, 0, 2_400_000, 0, 0, 1_200_000, 0, 0, 0, 0, 600_000];

const studentMetrics: StudentDirectoryMetrics = {
  attendanceRate: {
    byStudentId: Object.fromEntries(
      attendanceRates.flatMap((rate, index) => (rate === null ? [] : [[`student-${index}`, rate]])),
    ),
    status: "ready",
  },
  balanceSessions: {
    byStudentId: Object.fromEntries(balances.map((value, index) => [`student-${index}`, value])),
    status: "ready",
  },
  outstandingVnd: {
    byStudentId: Object.fromEntries(debts.flatMap((value, index) => (value > 0 ? [[`student-${index}`, value]] : []))),
    status: "ready",
  },
};

const year = { code: "2026-2027", endsOn: "2027-05-31", id: "year-1", isCurrent: true, name: "Năm học 2026–2027", startsOn: "2026-08-01", status: "active" };

const classRows: Array<[string, string, number, "A" | "B" | "CLC", "offline" | "online" | "hybrid", number, number, number | null, string]> = [
  ["Toán 9A tối 2-4-6", "L-9A26", 9, "A", "offline", 3, 3, 22, "active"],
  ["Toán 9B tối 3-5-7", "L-9B26", 9, "A", "offline", 3, 3, 20, "active"],
  ["Luyện thi vào 10 · T9C", "L-T9C26", 9, "CLC", "offline", 1, 1, 24, "active"],
  ["Toán 8B chiều 3-5-7", "L-8B26", 8, "B", "offline", 3, 3, 18, "active"],
  ["Toán 8A tối 2-4-6", "L-8A26", 8, "A", "offline", 3, 3, 20, "active"],
  ["Toán 7A chiều 2-4", "L-7A26", 7, "A", "offline", 2, 2, 15, "active"],
  ["Toán 6A sáng 2-4-6", "L-6A26", 6, "A", "offline", 3, 3, 16, "active"],
  ["Toán 10 nâng cao tối 2-6", "L-10NC26", 10, "CLC", "hybrid", 2, 2, 12, "active"],
  ["Toán 6B chiều 3-5", "L-6B26", 6, "B", "offline", 2, 0, 6, "draft"],
  ["Toán 7B online tối 3-5", "L-7BO26", 7, "A", "online", 2, 2, 9, "draft"],
  ["Toán 9A tối 2-4-6 (2025)", "L-9A25", 9, "A", "offline", 3, 0, null, "closed"],
];

const classes: ClassDirectoryItem[] = classRows.map(([name, code, grade, level, mode, weekly, schedules, count, status], index) => ({
  academicYear: year,
  activeScheduleCount: schedules,
  activeStudentCount: count,
  code,
  defaultLearningMode: mode,
  grade,
  id: `class-${index}`,
  level,
  name,
  notes: null,
  status,
  weeklySessionCount: weekly,
}));

export function ListsPreview({ view }: { view: "students" | "classes" }) {
  return (
    <AppShell
      authUser={{ displayName: "Phạm Thu Hạnh", email: "hanh@example.com", id: "dev-user", initials: "PH" }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view")}
      previewPathname={view === "classes" ? "/classes" : "/students"}
      unreadNotificationCount={4}
    >
      {view === "classes" ? (
        <ClassListPage canCreateClass canImportClasses classes={classes} />
      ) : (
        <StudentListPage canCreateStudent canImportStudents canManageStatus metrics={studentMetrics} students={students} />
      )}
    </AppShell>
  );
}
