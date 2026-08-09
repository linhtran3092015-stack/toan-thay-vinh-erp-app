import { describe, expect, it } from "vitest";

import type { StudentDirectoryItem } from "@/features/students/read-models";
import {
  defaultStudentFilters,
  filterStudents,
  paginateStudents,
} from "@/features/students/student-filters";

const students: StudentDirectoryItem[] = [
  {
    activeEnrollment: null,
    birthYear: 2013,
    currentGrade: 7,
    fullName: "Nguyễn Thảo Vy",
    id: "student-1",
    learningLevel: "A",
    lifecycleStatus: "active",
    nickname: null,
    primaryGuardian: {
      email: null,
      fullName: "Lê Minh",
      id: "guardian-1",
      isPrimary: true,
      notes: null,
      phone: "0901 234 567",
      relationship: "Mẹ",
      zalo: null,
    },
    publicCode: "HV-001",
    registeredMode: "offline",
  },
  {
    activeEnrollment: null,
    birthYear: 2012,
    currentGrade: 8,
    fullName: "Trần Đức Anh",
    id: "student-2",
    learningLevel: "B",
    lifecycleStatus: "reserved",
    nickname: "Anh",
    primaryGuardian: null,
    publicCode: "HV-002",
    registeredMode: "online",
  },
];

describe("student directory helpers", () => {
  it("retains Vietnamese-insensitive name, code, and phone filtering", () => {
    expect(
      filterStudents(students, { ...defaultStudentFilters, search: "thao vy" }),
    ).toEqual([students[0]]);

    expect(
      filterStudents(students, { ...defaultStudentFilters, search: "hv-002" }),
    ).toEqual([students[1]]);

    expect(
      filterStudents(students, { ...defaultStudentFilters, search: "0901234567" }),
    ).toEqual([students[0]]);
  });

  it("clamps pagination at both ends and gives an empty directory a stable first page", () => {
    const lastPage = paginateStudents(students, 99);
    expect(lastPage.page).toBe(1);
    expect(lastPage.rows).toEqual(students);
    expect(lastPage.start).toBe(1);
    expect(lastPage.end).toBe(2);

    const emptyPage = paginateStudents([], -4);
    expect(emptyPage).toMatchObject({
      end: 0,
      page: 1,
      pageCount: 1,
      rows: [],
      start: 0,
    });
  });
});
