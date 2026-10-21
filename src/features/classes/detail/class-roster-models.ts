import {
  compareSessions,
  isAbsenceStatus,
  type AttendanceEntry,
  type ClassSessionRow,
  type ClassStudentRef,
} from "@/features/classes/detail/class-detail-models";
import type { StudentRegisteredMode } from "@/features/students/read-models";
import { compareStudentNames } from "@/lib/student-order";

/**
 * Pure models for the class page's students and results tabs (design 03,
 * step 5b part 2). The loader fills them in `class-detail-data.ts`.
 */

export type ClassEnrollmentStatus = "active" | "reserved" | "transferred" | "completed";

const enrollmentStatuses: readonly ClassEnrollmentStatus[] = ["active", "reserved", "transferred", "completed"];

export function isClassEnrollmentStatus(value: unknown): value is ClassEnrollmentStatus {
  return typeof value === "string" && (enrollmentStatuses as readonly string[]).includes(value);
}

/** One student's latest enrolment in the class (see pickLatestEnrollments). */
export interface ClassEnrollmentRow {
  effectiveFrom: string;
  /** Last day in the class; `null` while the enrolment is open. */
  effectiveTo: string | null;
  endReason: string | null;
  enrollmentId: string;
  fullName: string;
  publicCode: string | null;
  registeredMode: StudentRegisteredMode;
  /**
   * A reserved enrolment that a later one resumed, in another class:
   * resume_student_enrollment keeps the reserved row as it is.
   */
  resumedElsewhere?: boolean;
  status: ClassEnrollmentStatus;
  studentId: string;
}

export const classEnrollmentStatusMeta: Record<ClassEnrollmentStatus, { label: string; tone: "neutral" | "success" | "warning" }> = {
  active: { label: "Đang học", tone: "success" },
  completed: { label: "Đã nghỉ", tone: "neutral" },
  reserved: { label: "Bảo lưu", tone: "warning" },
  transferred: { label: "Đã chuyển lớp", tone: "neutral" },
};

/**
 * Students tab chips (owner decision, step 5b part 2): "Đang học" by default,
 * plus reserved and everyone who left (transferred, ended) for the history.
 */
export type ClassStudentFilter = "active" | "reserved" | "left";

export const classStudentFilters: readonly ClassStudentFilter[] = ["active", "reserved", "left"];

/** A reserved student who resumed in another class has left this one. */
export function getClassStudentFilter(status: ClassEnrollmentStatus, resumedElsewhere = false): ClassStudentFilter {
  if (status === "active") return "active";
  if (status === "reserved" && !resumedElsewhere) return "reserved";
  return "left";
}

export function getClassEnrollmentStatusMeta(row: Pick<ClassEnrollmentRow, "resumedElsewhere" | "status">): { label: string; tone: "neutral" | "success" | "warning" } {
  return row.status === "reserved" && row.resumedElsewhere ? { label: "Đã học lại lớp khác", tone: "neutral" } : classEnrollmentStatusMeta[row.status];
}

export function countClassStudentFilters(rows: readonly ClassEnrollmentRow[]): Record<ClassStudentFilter, number> {
  const counts: Record<ClassStudentFilter, number> = { active: 0, left: 0, reserved: 0 };
  for (const row of rows) counts[getClassStudentFilter(row.status, row.resumedElsewhere)] += 1;
  return counts;
}

/**
 * One row per student: the open (active) enrolment when there is one, otherwise
 * the most recent. A student can hold several enrolments in the same class
 * (reserved, then resumed into it). Sorted by name.
 */
export function pickLatestEnrollments(rows: readonly ClassEnrollmentRow[]): ClassEnrollmentRow[] {
  const byStudent = new Map<string, ClassEnrollmentRow>();

  for (const row of rows) {
    const current = byStudent.get(row.studentId);
    const isOpen = (candidate: ClassEnrollmentRow) => candidate.status === "active" && candidate.effectiveTo === null;

    if (
      !current ||
      (isOpen(row) && !isOpen(current)) ||
      (isOpen(row) === isOpen(current) && row.effectiveFrom > current.effectiveFrom)
    ) {
      byStudent.set(row.studentId, row);
    }
  }

  return [...byStudent.values()].sort((a, b) => compareStudentNames(a.fullName, b.fullName) || a.studentId.localeCompare(b.studentId));
}

export interface ClassStudentDebt {
  amountVnd: number;
  overdue: boolean;
}

/**
 * The transfer and reserve RPCs only accept today's business date, and only
 * after the enrolment's first day: an enrolment that starts today (or later)
 * cannot be moved yet. `null` = allowed.
 */
export function getEnrollmentChangeBlocker(row: Pick<ClassEnrollmentRow, "effectiveFrom" | "status" | "effectiveTo">, today: string): string | null {
  if (row.status !== "active" || row.effectiveTo !== null) return "Chỉ thao tác được với học sinh đang học.";
  if (row.effectiveFrom === today) return "Học sinh mới vào lớp hôm nay; từ ngày mai mới chuyển lớp hoặc bảo lưu được.";
  if (row.effectiveFrom > today) {
    const [year, month, day] = row.effectiveFrom.split("-");
    return `Học sinh vào lớp từ ${day}/${month}/${year}; từ ngày hôm sau mới chuyển lớp hoặc bảo lưu được.`;
  }
  return null;
}

/**
 * A test score, a result without one (notebook only), a present student still
 * missing a result, a present student without one on a locked session (results
 * can no longer be entered there), or an absence.
 */
export type ClassResultCell =
  | { kind: "score"; score: number }
  | { kind: "graded" }
  | { kind: "missing" }
  | { kind: "unrecorded" }
  | { kind: "absent" };

export interface ClassResultColumn {
  id: string;
  ordinal: number | null;
  sessionDate: string;
  sessionKind: ClassSessionRow["sessionKind"];
  /** Whether the session is over (completed): only then can a cell be "missing". */
  completed: boolean;
  /** A locked session takes no more results: its gaps are "unrecorded", not "missing". */
  locked: boolean;
}

export interface ClassResultMatrixRow {
  student: ClassStudentRef;
  /** Badge for a student who no longer studies in the class; `null` while active. */
  enrollmentStatus: { label: string; tone: "neutral" | "success" | "warning" } | null;
  /** Aligned with `columns`; `null` = nothing to show (not on the session, unmarked, or unknown). */
  cells: Array<ClassResultCell | null>;
  /** Mean test score over the cells that hold one; `null` without any. */
  average: number | null;
  missingCount: number;
}

export interface ClassResultMatrix {
  /** Started, non-cancelled sessions, oldest first. */
  columns: ClassResultColumn[];
  rows: ClassResultMatrixRow[];
  /**
   * Whether attendance was read: without it nobody is known to be present, so
   * no cell is "missing" and absences are not shown.
   */
  attendanceKnown: boolean;
  missingCount: number;
}

export interface ClassResultEntry {
  class_session_id: string;
  student_id: string;
  /** numeric(4,2) from PostgREST: a number or a numeric string. */
  test_score?: number | string | null;
}

function toScore(value: ClassResultEntry["test_score"]): number | null {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

/**
 * Students × started sessions (owner decision, step 5b part 2): a cell is
 * "missing" (light red) only when the student was present at a completed,
 * unlocked session and has no result row yet; on a locked session the gap can
 * no longer be filled, so it is "unrecorded" and not counted. Absent students show "absent"; a result
 * row without a test score (notebook only) is "graded". Rows are the class's
 * active students plus anyone else enrolled in the class who holds a result in
 * these sessions (a student who has since left keeps their scores).
 */
export function buildClassResultMatrix({
  activeStudents,
  attendance,
  enrollments,
  results,
  sessions,
}: {
  activeStudents: readonly ClassStudentRef[];
  /** `null` = attendance not read (no permission or failed). */
  attendance: readonly AttendanceEntry[] | null;
  /** Latest enrolment per student (any status), for students who left. */
  enrollments: readonly ClassEnrollmentRow[];
  results: readonly ClassResultEntry[];
  sessions: readonly ClassSessionRow[];
}): ClassResultMatrix {
  const columns: ClassResultColumn[] = sessions
    .filter((row) => row.status === "completed" || row.status === "in_progress")
    .sort(compareSessions)
    .map((row) => ({
      completed: row.status === "completed",
      id: row.id,
      locked: row.lockedAt !== null,
      ordinal: row.ordinal,
      sessionDate: row.sessionDate,
      sessionKind: row.sessionKind,
    }));
  const columnIds = new Set(columns.map((column) => column.id));

  const scores = new Map<string, number | null>();
  const studentsWithResults = new Set<string>();
  for (const entry of results) {
    if (!columnIds.has(entry.class_session_id)) continue;
    scores.set(`${entry.class_session_id}:${entry.student_id}`, toScore(entry.test_score));
    studentsWithResults.add(entry.student_id);
  }

  const statuses = new Map<string, string>();
  for (const entry of attendance ?? []) {
    if (columnIds.has(entry.class_session_id)) statuses.set(`${entry.class_session_id}:${entry.student_id}`, entry.attendance_status);
  }

  const activeIds = new Set(activeStudents.map((student) => student.id));
  const formerStudents = enrollments
    .filter((row) => !activeIds.has(row.studentId) && studentsWithResults.has(row.studentId))
    .map((row) => ({ row, student: { fullName: row.fullName, id: row.studentId, publicCode: row.publicCode } }));
  const students = [
    ...activeStudents.map((student) => ({ row: null, student })),
    ...formerStudents,
  ].sort((a, b) => compareStudentNames(a.student.fullName, b.student.fullName) || a.student.id.localeCompare(b.student.id));

  let missingCount = 0;
  const rows: ClassResultMatrixRow[] = students.map(({ row: enrollment, student }) => {
    let total = 0;
    let scored = 0;
    let studentMissing = 0;

    const cells = columns.map((column): ClassResultCell | null => {
      const key = `${column.id}:${student.id}`;

      if (scores.has(key)) {
        const score = scores.get(key) ?? null;
        if (score === null) return { kind: "graded" };
        total += score;
        scored += 1;
        return { kind: "score", score };
      }

      const mark = statuses.get(key);
      if (mark && isAbsenceStatus(mark)) return { kind: "absent" };
      // additional_study is a walk-in who attended: a result is expected too.
      if (column.completed && (mark === "present" || mark === "additional_study")) {
        if (column.locked) return { kind: "unrecorded" };
        studentMissing += 1;
        return { kind: "missing" };
      }
      return null;
    });

    missingCount += studentMissing;

    return {
      average: scored > 0 ? total / scored : null,
      cells,
      enrollmentStatus: enrollment ? getClassEnrollmentStatusMeta(enrollment) : null,
      missingCount: studentMissing,
      student,
    };
  });

  return { attendanceKnown: attendance !== null, columns, missingCount, rows };
}

/** Mean of a column's test scores; `null` without any. */
export function getResultColumnAverage(matrix: ClassResultMatrix, columnIndex: number): number | null {
  let total = 0;
  let count = 0;
  for (const row of matrix.rows) {
    const cell = row.cells[columnIndex];
    if (cell?.kind === "score") {
      total += cell.score;
      count += 1;
    }
  }
  return count > 0 ? total / count : null;
}

/** "8,5" / "10": scores keep at most two decimals, Vietnamese decimal comma. */
export function formatScore(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

/** Averages keep one decimal: "7,8". */
export function formatAverageScore(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
}
