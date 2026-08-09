import { describe, expect, it } from "vitest";

import { defaultStudentFilters } from "@/features/students/student-filters";
import {
  getStudentDirectoryHref,
  getStudentDirectoryQuery,
  mergePendingStudentDirectoryFilter,
  parseStudentDirectoryViewState,
  resetStudentDirectoryViewState,
  serializeStudentDirectoryViewState,
  withStudentDirectoryQuery,
} from "@/features/students/student-directory-url-state";

const classNames = ["Toán 7A", "Toán 8B"];

describe("student directory URL view state", () => {
  it("parses only valid Students-owned values and falls back to existing defaults", () => {
    const viewState = parseStudentDirectoryViewState(
      new URLSearchParams("search=Nguyễn&status=active&grade=7&class=Toán+7A&level=A&mode=offline&page=3"),
      classNames,
    );

    expect(viewState).toEqual({
      filters: {
        className: "Toán 7A",
        grade: "7",
        learningLevel: "A",
        registeredMode: "offline",
        search: "Nguyễn",
        status: "active",
      },
      page: 3,
    });

    expect(
      parseStudentDirectoryViewState(
        new URLSearchParams("status=unknown&grade=13&class=missing&level=X&mode=hybrid&page=0"),
        classNames,
      ),
    ).toEqual({ filters: defaultStudentFilters, page: 1 });
  });

  it("preserves unrelated query parameters while resetting filters to page one", () => {
    const current = new URLSearchParams("notice=created&status=active&page=4");
    const next = serializeStudentDirectoryViewState(current, {
      filters: { ...defaultStudentFilters, search: "Minh" },
      page: 1,
    });

    expect(next.toString()).toBe("notice=created&search=Minh");
    expect(getStudentDirectoryHref(current, resetStudentDirectoryViewState())).toBe("/students?notice=created");
  });

  it("composes rapid filter updates before route replacement has settled", () => {
    const startingFilters = defaultStudentFilters;
    const afterStatus = mergePendingStudentDirectoryFilter(
      null,
      startingFilters,
      "status",
      "active",
    );
    const afterGrade = mergePendingStudentDirectoryFilter(
      afterStatus,
      startingFilters,
      "grade",
      "7",
    );

    expect(
      getStudentDirectoryHref(
        new URLSearchParams("notice=created&page=4"),
        { filters: afterGrade, page: 1 },
      ),
    ).toBe("/students?notice=created&status=active&grade=7");

    const afterGradeFirst = mergePendingStudentDirectoryFilter(
      null,
      startingFilters,
      "grade",
      "7",
    );
    const afterStatusSecond = mergePendingStudentDirectoryFilter(
      afterGradeFirst,
      startingFilters,
      "status",
      "active",
    );

    expect(afterStatusSecond).toEqual(afterGrade);
  });

  it("retains only safe Students-owned parameters for directory return links", () => {
    const query = new URLSearchParams("search=Vy&status=active&class=Toán+7A&page=2&next=https://outside.example");

    expect(new URLSearchParams(getStudentDirectoryQuery(query))).toEqual(
      new URLSearchParams("search=Vy&status=active&class=Toán+7A&page=2"),
    );
    expect(withStudentDirectoryQuery("/students/student-1", query)).toBe(
      "/students/student-1?search=Vy&status=active&class=To%C3%A1n+7A&page=2",
    );
  });
});
