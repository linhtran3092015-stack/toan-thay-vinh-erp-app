// Value: protects=the class students and results tabs' numbers: one row per student (open enrolment first), who may be transferred or reserved, and which result cells are scores, notebook-only, absent or missing;
// fails_when=a newer closed enrolment hides the open one, a student who joined today can be moved, a present student at an unfinished session is called missing, an absence or walk-in is mishandled, an unread attendance feed still flags missing cells, or averages count non-score cells;
// why_new=step 5b part 2 introduced these pure helpers with no prior coverage;
// seam=pure functions only; no_claim=does not prove the loader feeds these shapes or that the RPCs accept the same dates
import { describe, expect, it } from "vitest";

import type { AttendanceEntry, ClassSessionRow, ClassStudentRef } from "@/features/classes/detail/class-detail-models";
import {
  buildClassResultMatrix,
  classStudentFilters,
  countClassStudentFilters,
  formatAverageScore,
  formatScore,
  getClassEnrollmentStatusMeta,
  getClassStudentFilter,
  getEnrollmentChangeBlocker,
  getResultColumnAverage,
  pickLatestEnrollments,
  type ClassEnrollmentRow,
  type ClassResultEntry,
} from "@/features/classes/detail/class-roster-models";

const TODAY = "2026-10-13";

function enrollment(overrides: Partial<ClassEnrollmentRow> & Pick<ClassEnrollmentRow, "enrollmentId" | "studentId">): ClassEnrollmentRow {
  return {
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
    endReason: null,
    fullName: "An",
    publicCode: null,
    registeredMode: "offline",
    status: "active",
    ...overrides,
  };
}

describe("pickLatestEnrollments", () => {
  it("prefers the open active enrolment over a newer closed one, else the latest start, sorted by Vietnamese name", () => {
    const rows = pickLatestEnrollments([
      // Student a: reserved earlier, resumed into the class; the closed row started later than the open one.
      enrollment({ effectiveFrom: "2026-09-01", enrollmentId: "a-open", fullName: "Đào An", studentId: "a" }),
      enrollment({ effectiveFrom: "2026-09-20", effectiveTo: "2026-09-30", enrollmentId: "a-closed", fullName: "Đào An", status: "reserved", studentId: "a" }),
      // Student b: nothing open, so the latest start wins.
      enrollment({ effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31", enrollmentId: "b-old", fullName: "Bảo", status: "transferred", studentId: "b" }),
      enrollment({ effectiveFrom: "2026-09-05", effectiveTo: "2026-09-25", enrollmentId: "b-new", fullName: "Bảo", status: "completed", studentId: "b" }),
      // Student c sorts before Đ in Vietnamese collation.
      enrollment({ enrollmentId: "c-1", fullName: "Cường", studentId: "c" }),
    ]);

    expect(rows.map((row) => row.enrollmentId)).toEqual(["b-new", "c-1", "a-open"]);
  });

  it("keeps the open enrolment whichever order the rows arrive in", () => {
    const open = enrollment({ effectiveFrom: "2026-09-01", enrollmentId: "open", studentId: "a" });
    const closed = enrollment({ effectiveFrom: "2026-09-20", effectiveTo: "2026-09-30", enrollmentId: "closed", status: "reserved", studentId: "a" });

    expect(pickLatestEnrollments([open, closed])[0].enrollmentId).toBe("open");
    expect(pickLatestEnrollments([closed, open])[0].enrollmentId).toBe("open");
  });
});

describe("student filter chips", () => {
  it("maps statuses to chips and counts them", () => {
    expect(classStudentFilters).toEqual(["active", "reserved", "left"]);
    expect(getClassStudentFilter("active")).toBe("active");
    expect(getClassStudentFilter("reserved")).toBe("reserved");
    expect(getClassStudentFilter("transferred")).toBe("left");
    expect(getClassStudentFilter("completed")).toBe("left");

    expect(
      countClassStudentFilters([
        enrollment({ enrollmentId: "1", studentId: "1" }),
        enrollment({ enrollmentId: "2", status: "reserved", studentId: "2" }),
        enrollment({ enrollmentId: "3", status: "transferred", studentId: "3" }),
        enrollment({ enrollmentId: "4", status: "completed", studentId: "4" }),
      ]),
    ).toEqual({ active: 1, left: 2, reserved: 1 });
  });

  // Value: protects=a reserved enrolment that resumed in another class counts as having left this class and is labelled "Đã học lại lớp khác", while a plain reservation stays under "Bảo lưu";
  // fails_when=resumedElsewhere is ignored (the student still shows as reserved here after studying elsewhere), the flag moves a non-reserved row, or the badge keeps "Bảo lưu";
  // why_new=resumedElsewhere is new in the pre-landing review fixes;
  // seam=pure functions; no_claim=does not prove the loader sets the flag (class-detail-data.test.ts)
  it("moves a reserved student who resumed elsewhere under Đã rời lớp", () => {
    expect(getClassStudentFilter("reserved", true)).toBe("left");
    expect(getClassStudentFilter("reserved", false)).toBe("reserved");
    expect(getClassStudentFilter("active", true)).toBe("active");
    expect(getClassEnrollmentStatusMeta({ resumedElsewhere: true, status: "reserved" })).toEqual({ label: "Đã học lại lớp khác", tone: "neutral" });
    expect(getClassEnrollmentStatusMeta({ resumedElsewhere: false, status: "reserved" })).toEqual({ label: "Bảo lưu", tone: "warning" });
    expect(getClassEnrollmentStatusMeta({ resumedElsewhere: true, status: "transferred" })).toEqual({ label: "Đã chuyển lớp", tone: "neutral" });

    expect(
      countClassStudentFilters([
        enrollment({ enrollmentId: "1", status: "reserved", studentId: "1" }),
        enrollment({ enrollmentId: "2", resumedElsewhere: true, status: "reserved", studentId: "2" }),
      ]),
    ).toEqual({ active: 0, left: 1, reserved: 1 });
  });
});

describe("getEnrollmentChangeBlocker", () => {
  it("blocks an enrolment that starts today or later, allows an earlier one", () => {
    const base = { effectiveTo: null, status: "active" as const };

    expect(getEnrollmentChangeBlocker({ ...base, effectiveFrom: TODAY }, TODAY)).toMatch(/mới vào lớp hôm nay/);
    expect(getEnrollmentChangeBlocker({ ...base, effectiveFrom: "2026-10-20" }, TODAY)).not.toBeNull();
    expect(getEnrollmentChangeBlocker({ ...base, effectiveFrom: "2026-10-12" }, TODAY)).toBeNull();
  });

  // Value: protects=an enrolment that starts after today is blocked with its own start date in dd/mm/yyyy, not the "joined today" reason;
  // fails_when=a future start reuses the "mới vào lớp hôm nay" wording (wrong for a student who has not started), the date is shown in ISO or swapped day/month, or a future start is allowed;
  // why_new=the review split the today and future-start messages; the old test only matched "hôm nay" for both;
  // seam=pure function; no_claim=does not prove the transfer/reserve RPCs reject the same dates
  it("names the start date for an enrolment that starts after today", () => {
    expect(getEnrollmentChangeBlocker({ effectiveFrom: "2026-10-20", effectiveTo: null, status: "active" }, TODAY)).toBe(
      "Học sinh vào lớp từ 20/10/2026; từ ngày hôm sau mới chuyển lớp hoặc bảo lưu được.",
    );
  });

  it("blocks anything that is not an open active enrolment", () => {
    expect(getEnrollmentChangeBlocker({ effectiveFrom: "2026-09-01", effectiveTo: null, status: "reserved" }, TODAY)).toMatch(/đang học/);
    expect(getEnrollmentChangeBlocker({ effectiveFrom: "2026-09-01", effectiveTo: null, status: "transferred" }, TODAY)).toMatch(/đang học/);
    expect(getEnrollmentChangeBlocker({ effectiveFrom: "2026-09-01", effectiveTo: "2026-10-01", status: "active" }, TODAY)).toMatch(/đang học/);
  });
});

function session(overrides: Partial<ClassSessionRow> & Pick<ClassSessionRow, "id" | "sessionDate">): ClassSessionRow {
  return {
    attendance: null,
    classCode: "L-9A26",
    classId: "class-1",
    componentCode: null,
    endTime: "21:30:00",
    learningMode: "offline",
    lockedAt: null,
    ordinal: null,
    resultCount: null,
    roomName: null,
    rosterCount: null,
    sessionKind: "regular",
    startTime: "19:30:00",
    status: "completed",
    ...overrides,
  };
}

const student = (id: string, fullName: string): ClassStudentRef => ({ fullName, id, publicCode: null });
const mark = (sessionId: string, studentId: string, status: string): AttendanceEntry => ({ attendance_status: status, class_session_id: sessionId, student_id: studentId });
const result = (sessionId: string, studentId: string, score: ClassResultEntry["test_score"]): ClassResultEntry => ({ class_session_id: sessionId, student_id: studentId, test_score: score });

describe("buildClassResultMatrix", () => {
  const sessions = [
    session({ id: "s3", sessionDate: "2026-10-12", status: "in_progress" }),
    session({ id: "s-future", sessionDate: "2026-10-20", status: "scheduled" }),
    session({ id: "s1", sessionDate: "2026-10-01" }),
    session({ id: "s-cancelled", sessionDate: "2026-10-05", status: "cancelled" }),
    session({ id: "s2", sessionDate: "2026-10-08" }),
  ];

  it("has one column per completed or in-progress session, oldest first", () => {
    const matrix = buildClassResultMatrix({ activeStudents: [], attendance: [], enrollments: [], results: [], sessions });

    expect(matrix.columns.map((column) => [column.id, column.completed])).toEqual([
      ["s1", true],
      ["s2", true],
      ["s3", false],
    ]);
  });

  it("classifies each cell and counts missing ones only at completed sessions", () => {
    const matrix = buildClassResultMatrix({
      activeStudents: [student("a", "An"), student("b", "Bảo"), student("c", "Cúc"), student("d", "Dũng")],
      attendance: [
        mark("s1", "a", "present"),
        mark("s1", "b", "present"),
        mark("s1", "c", "excused_absence"),
        mark("s1", "d", "additional_study"),
        mark("s2", "a", "present"),
        // Present at the session still in progress: results are not expected yet.
        mark("s3", "a", "present"),
        mark("s3", "c", "unexcused_absence"),
      ],
      enrollments: [],
      results: [
        result("s1", "a", 8.5),
        // Notebook only: a result row without a test score.
        result("s1", "b", null),
        result("s2", "c", "9.00"),
      ],
      sessions,
    });

    const byName = Object.fromEntries(matrix.rows.map((row) => [row.student.fullName, row]));

    expect(byName.An.cells).toEqual([{ kind: "score", score: 8.5 }, { kind: "missing" }, null]);
    expect(byName.Bảo.cells).toEqual([{ kind: "graded" }, null, null]);
    // Absence at s1, a numeric-string score ("9.00") parsed at s2, absence at s3.
    expect(byName.Cúc.cells).toEqual([{ kind: "absent" }, { kind: "score", score: 9 }, { kind: "absent" }]);
    // A walk-in who attended a completed session is expected to have a result too.
    expect(byName.Dũng.cells).toEqual([{ kind: "missing" }, null, null]);

    expect(byName.An.missingCount).toBe(1);
    expect(byName.Dũng.missingCount).toBe(1);
    expect(matrix.missingCount).toBe(2);
    expect(matrix.attendanceKnown).toBe(true);
  });

  // Value: protects=a present student without a result at a completed LOCKED session is "unrecorded" (results can no longer be entered) and is not counted as missing, while the same gap on an unlocked session still is;
  // fails_when=the locked check is dropped (the tab and its badge count gaps nobody can fill), an unrecorded cell is counted in missingCount, or the column loses its locked flag;
  // why_new=the review introduced the locked column flag and the "unrecorded" cell kind;
  // seam=pure function; no_claim=does not prove which sessions the database locks
  it("marks a gap at a locked session unrecorded and does not count it", () => {
    const matrix = buildClassResultMatrix({
      activeStudents: [student("a", "An"), student("b", "Bảo")],
      attendance: [mark("s1", "a", "present"), mark("s1", "b", "additional_study"), mark("s2", "a", "present")],
      enrollments: [],
      results: [],
      sessions: [
        session({ id: "s1", lockedAt: "2026-10-02T00:00:00Z", sessionDate: "2026-10-01" }),
        session({ id: "s2", sessionDate: "2026-10-08" }),
      ],
    });
    const byName = Object.fromEntries(matrix.rows.map((row) => [row.student.fullName, row]));

    expect(matrix.columns.map((column) => [column.id, column.locked])).toEqual([
      ["s1", true],
      ["s2", false],
    ]);
    expect(byName.An.cells).toEqual([{ kind: "unrecorded" }, { kind: "missing" }]);
    expect(byName.Bảo.cells).toEqual([{ kind: "unrecorded" }, null]);
    expect(byName.An.missingCount).toBe(1);
    expect(byName.Bảo.missingCount).toBe(0);
    expect(matrix.missingCount).toBe(1);
  });

  it("averages test scores only, parsing numeric strings", () => {
    const matrix = buildClassResultMatrix({
      activeStudents: [student("a", "An"), student("b", "Bảo"), student("c", "Cúc")],
      attendance: [mark("s1", "c", "present")],
      enrollments: [],
      results: [result("s1", "a", "8.50"), result("s2", "a", 7), result("s2", "b", null)],
      sessions,
    });
    const byName = Object.fromEntries(matrix.rows.map((row) => [row.student.fullName, row]));

    expect(byName.An.average).toBeCloseTo(7.75);
    // Notebook-only and missing cells never enter the mean.
    expect(byName.Bảo.average).toBeNull();
    expect(byName.Cúc.average).toBeNull();
    expect(getResultColumnAverage(matrix, 0)).toBe(8.5);
    expect(getResultColumnAverage(matrix, 1)).toBe(7);
    expect(getResultColumnAverage(matrix, 2)).toBeNull();
  });

  it("flags no missing cells and no absences when attendance was not read", () => {
    const matrix = buildClassResultMatrix({
      activeStudents: [student("a", "An")],
      attendance: null,
      enrollments: [],
      results: [result("s1", "a", 6)],
      sessions,
    });

    expect(matrix.attendanceKnown).toBe(false);
    expect(matrix.missingCount).toBe(0);
    expect(matrix.rows[0].cells).toEqual([{ kind: "score", score: 6 }, null, null]);
  });

  it("lists a former student only when they hold a result in these sessions", () => {
    const former = (studentId: string, fullName: string) =>
      ({ effectiveFrom: "2026-09-01", effectiveTo: "2026-10-03", endReason: null, enrollmentId: `e-${studentId}`, fullName, publicCode: "HS9", registeredMode: "offline", status: "transferred", studentId }) satisfies ClassEnrollmentRow;
    const matrix = buildClassResultMatrix({
      activeStudents: [student("a", "An")],
      attendance: [],
      enrollments: [former("x", "Xuân"), former("y", "Yến"), enrollment({ enrollmentId: "e-a", studentId: "a" })],
      // Xuân's score sits on a cancelled session, which is no column: it does not count.
      results: [result("s1", "x", 7), result("s-cancelled", "y", 5)],
      sessions,
    });

    expect(matrix.rows.map((row) => [row.student.fullName, row.enrollmentStatus])).toEqual([
      ["An", null],
      ["Xuân", { label: "Đã chuyển lớp", tone: "neutral" }],
    ]);
  });
});

describe("score formatting", () => {
  it("uses the Vietnamese decimal comma", () => {
    expect(formatScore(8.5)).toBe("8,5");
    expect(formatScore(10)).toBe("10");
    expect(formatScore(7.25)).toBe("7,25");
    expect(formatAverageScore(7.75)).toBe("7,8");
    expect(formatAverageScore(8)).toBe("8,0");
  });
});
