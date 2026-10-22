import { describe, expect, it } from "vitest";

import {
  compareStudentNames,
  compareStudentsByGradeThenName,
  givenNameOf,
  sortByStudentName,
} from "@/lib/student-order";

describe("givenNameOf", () => {
  it("returns the last word of the full name", () => {
    expect(givenNameOf("  Nguyễn  Thị Minh Anh ")).toBe("Anh");
    expect(givenNameOf("Bình")).toBe("Bình");
  });
});

describe("compareStudentNames", () => {
  it("sorts by given name in Vietnamese alphabet order, not by family name", () => {
    const names = [
      "Nguyễn Văn Đức",
      "Trần Thị Dung",
      "Lê Ngọc Ân",
      "Phạm Văn Ánh",
      "Vũ Minh Anh",
      "Đỗ Văn An",
      "Hoàng Thị Ăn",
    ];
    expect([...names].sort(compareStudentNames)).toEqual([
      "Đỗ Văn An",
      "Vũ Minh Anh",
      "Phạm Văn Ánh",
      "Hoàng Thị Ăn",
      "Lê Ngọc Ân",
      "Trần Thị Dung",
      "Nguyễn Văn Đức",
    ]);
  });

  it("breaks a shared given name by the family and middle names", () => {
    expect(["Trần Văn An", "Bùi Thị An", "Đặng Minh An", "Bùi Minh An"].sort(compareStudentNames)).toEqual([
      "Bùi Minh An",
      "Bùi Thị An",
      "Đặng Minh An",
      "Trần Văn An",
    ]);
  });
});

describe("sortByStudentName", () => {
  it("returns a sorted copy without touching the input", () => {
    const rows = [{ name: "Lê Văn Bình" }, { name: "Trần Thị An" }];
    expect(sortByStudentName(rows, (row) => row.name).map((row) => row.name)).toEqual(["Trần Thị An", "Lê Văn Bình"]);
    expect(rows[0].name).toBe("Lê Văn Bình");
  });
});

describe("compareStudentsByGradeThenName", () => {
  it("puts grade 12 first, down to the lowest grade, with names in roll order inside each grade", () => {
    const students = [
      { currentGrade: 2, fullName: "Nguyễn Văn An" },
      { currentGrade: 12, fullName: "Trần Thị Yến" },
      { currentGrade: 9, fullName: "Lê Minh Bình" },
      { currentGrade: 12, fullName: "Phạm Văn Anh" },
      { currentGrade: 10, fullName: "Đỗ Thị Hà" },
      { currentGrade: 9, fullName: "Vũ Ngọc An" },
    ];
    expect(students.sort(compareStudentsByGradeThenName)).toEqual([
      { currentGrade: 12, fullName: "Phạm Văn Anh" },
      { currentGrade: 12, fullName: "Trần Thị Yến" },
      { currentGrade: 10, fullName: "Đỗ Thị Hà" },
      { currentGrade: 9, fullName: "Vũ Ngọc An" },
      { currentGrade: 9, fullName: "Lê Minh Bình" },
      { currentGrade: 2, fullName: "Nguyễn Văn An" },
    ]);
  });
});
