import { describe, expect, it } from "vitest";

import type { StudentDirectoryItem } from "@/features/students/read-models";
import {
  createStudentSearchIndex,
  defaultStudentFilters,
  filterIndexedStudents,
  filterStudents,
  normalizeStudentSearch,
  normalizeStudentPhone,
} from "@/features/students/student-filters";

describe("Student search Vietnamese normalization and accuracy", () => {
  it("normalizes Vietnamese diacritics including đ and uppercase Đ", () => {
    expect(normalizeStudentSearch("Đặng Hoàng Đức")).toBe("dang hoang duc");
    expect(normalizeStudentSearch("NGUYỄN THẢO VY")).toBe("nguyen thao vy");
    expect(normalizeStudentSearch("Trần Đức Anh")).toBe("tran duc anh");
  });

  it("normalizes phone numbers to digits only", () => {
    expect(normalizeStudentPhone("0901 234 567")).toBe("0901234567");
    expect(normalizeStudentPhone("+84-90-123-4567")).toBe("84901234567");
  });

  it("matches multi-word queries in any order and with/without accents", () => {
    const students: StudentDirectoryItem[] = [
      {
        activeEnrollment: null,
        birthYear: 2013,
        currentGrade: 7,
        fullName: "Nguyễn Thảo Vy",
        id: "s-1",
        learningLevel: "A",
        lifecycleStatus: "active",
        nickname: null,
        primaryGuardian: {
          email: null,
          fullName: "Lê Minh",
          id: "g-1",
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
        id: "s-2",
        learningLevel: "B",
        lifecycleStatus: "reserved",
        nickname: "Bé Bo",
        primaryGuardian: {
          email: null,
          fullName: "Đặng Thị Hoa",
          id: "g-2",
          isPrimary: true,
          notes: null,
          phone: "0987 654 321",
          relationship: "Mẹ",
          zalo: null,
        },
        publicCode: "HV-002",
        registeredMode: "online",
      },
    ];

    const index = createStudentSearchIndex(students);

    // Matches with diacritics
    expect(
      filterIndexedStudents(index, { ...defaultStudentFilters, search: "Đức Anh" }),
    ).toEqual([students[1]]);

    // Matches without diacritics (including d matching đ)
    expect(
      filterIndexedStudents(index, { ...defaultStudentFilters, search: "duc anh" }),
    ).toEqual([students[1]]);

    // Matches out of order
    expect(
      filterIndexedStudents(index, { ...defaultStudentFilters, search: "anh tran" }),
    ).toEqual([students[1]]);

    // Matches nickname
    expect(
      filterIndexedStudents(index, { ...defaultStudentFilters, search: "be bo" }),
    ).toEqual([students[1]]);

    // Matches guardian name without diacritics
    expect(
      filterIndexedStudents(index, { ...defaultStudentFilters, search: "dang thi hoa" }),
    ).toEqual([students[1]]);

    // Matches guardian phone
    expect(
      filterIndexedStudents(index, { ...defaultStudentFilters, search: "0987654321" }),
    ).toEqual([students[1]]);

    // Matches student code
    expect(
      filterIndexedStudents(index, { ...defaultStudentFilters, search: "hv-001" }),
    ).toEqual([students[0]]);
  });

  it("performs ultra-fast filtering on large dataset of 5,000 students (< 10ms search time)", () => {
    const names = [
      "Nguyễn Văn An",
      "Trần Thị Bình",
      "Lê Hoàng Cường",
      "Phạm Thị Dung",
      "Đặng Đức Em",
      "Vũ Thị Giang",
      "Đỗ Hoàng Hải",
      "Bùi Thị Kim",
      "Ngô Đăng Khoa",
      "Hoàng Thảo Linh",
    ];

    const largeStudents: StudentDirectoryItem[] = [];
    for (let i = 0; i < 5000; i++) {
      const name = names[i % names.length];
      largeStudents.push({
        activeEnrollment: null,
        birthYear: 2010 + (i % 8),
        currentGrade: (i % 12) + 1,
        fullName: `${name} ${i}`,
        id: `student-${i}`,
        learningLevel: i % 2 === 0 ? "A" : "B",
        lifecycleStatus: "active",
        nickname: null,
        primaryGuardian: {
          email: null,
          fullName: `Phụ huynh ${name} ${i}`,
          id: `guardian-${i}`,
          isPrimary: true,
          notes: null,
          phone: `090${String(i).padStart(7, "0")}`,
          relationship: "Bố",
          zalo: null,
        },
        publicCode: `HV-${String(i).padStart(5, "0")}`,
        registeredMode: i % 2 === 0 ? "offline" : "online",
      });
    }

    const tIndexStart = performance.now();
    const index = createStudentSearchIndex(largeStudents);
    const tIndexEnd = performance.now();
    expect(index.length).toBe(5000);
    expect(tIndexEnd - tIndexStart).toBeLessThan(100);

    const tSearchStart = performance.now();
    const results = filterIndexedStudents(index, {
      ...defaultStudentFilters,
      search: "dang khoa",
    });
    const tSearchEnd = performance.now();

    // 5,000 / 10 = 500 items match "dang khoa"
    expect(results.length).toBe(500);
    expect(tSearchEnd - tSearchStart).toBeLessThan(10);
  });
});
