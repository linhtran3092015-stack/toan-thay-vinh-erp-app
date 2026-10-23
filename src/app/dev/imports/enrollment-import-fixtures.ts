import type { EnrollmentImportCommitResult, EnrollmentImportFileSeed } from "@/features/imports/enrollments/enrollment-import-page";
import type {
  EnrollmentImportClassification,
  EnrollmentImportDryRunResult,
  EnrollmentImportDryRunRow,
} from "@/features/imports/enrollments/types";

import { IMPORTS_PREVIEW_TODAY } from "./imports-preview-params";

/*
 * /dev/imports `view=enrollments` fixtures (design 17c, fixed clock
 * 2026-10-19): one eight-row file, its dry-run with problems (one conflict,
 * two invalid rows), the fixed file's clean dry-run, the staging batch made
 * from it and the commit result. Messages are the RPC's own
 * (dry_run_student_enrollment_import).
 */

const ACADEMIC_YEAR_CODE = "2026-2027";
const FILENAME = "ghi-danh-2026-2027.xlsx";
const HEADERS = ["Mã học viên *", "Mã lớp *", "Hình thức *", "Hiệu lực từ *"];

type PreviewRow = {
  sourceRow: number;
  student: string;
  classCode: string;
  mode: string;
  from: string;
  classification: EnrollmentImportClassification;
  code?: string;
  message?: string;
};

const ROWS_WITH_PROBLEMS: readonly PreviewRow[] = [
  { classCode: "6A1", classification: "new", from: "2026-10-20", mode: "offline", sourceRow: 2, student: "TV-2026-00201" },
  { classCode: "7A2", classification: "new", from: "2026-10-20", mode: "online", sourceRow: 3, student: "TV-2026-00202" },
  { classCode: "6A1", classification: "existing_matching", from: "2026-09-07", mode: "offline", sourceRow: 4, student: "TV-2026-00203" },
  {
    classCode: "6A1",
    classification: "invalid",
    code: "ENROLLMENT_IMPORT_STUDENT_NOT_FOUND",
    from: "2026-10-20",
    message: "Không tìm thấy học viên có mã TV-2026-00999.",
    mode: "offline",
    sourceRow: 5,
    student: "TV-2026-00999",
  },
  {
    classCode: "8B1",
    classification: "invalid",
    code: "ENROLLMENT_IMPORT_CLASS_NOT_FOUND",
    from: "2026-10-20",
    message: "Không tìm thấy lớp học active 8B1 trong năm học 2026-2027.",
    mode: "offline",
    sourceRow: 6,
    student: "TV-2026-00204",
  },
  {
    classCode: "7A2",
    classification: "existing_conflict",
    code: "ENROLLMENT_IMPORT_ACTIVE_ENROLLMENT_CONFLICT",
    from: "2026-10-20",
    message: "Học viên đang có ghi danh active khác lớp, hình thức hoặc ngày bắt đầu.",
    mode: "offline",
    sourceRow: 7,
    student: "TV-2026-00205",
  },
  { classCode: "7A2", classification: "new", from: "2026-10-20", mode: "online", sourceRow: 8, student: "TV-2026-00206" },
  { classCode: "6A1", classification: "new", from: "2026-10-20", mode: "offline", sourceRow: 9, student: "TV-2026-00207" },
];

/** The same file after rows 5–7 were fixed in Excel. */
const ROWS_CLEAN: readonly PreviewRow[] = ROWS_WITH_PROBLEMS.map((row) => {
  if (row.sourceRow === 5) return { ...row, classification: "new", code: undefined, message: undefined, student: "TV-2026-00208" };
  if (row.sourceRow === 6) return { ...row, classCode: "8A1", classification: "new", code: undefined, message: undefined };
  if (row.sourceRow === 7) return { ...row, classification: "new", code: undefined, message: undefined, mode: "online" };
  return row;
});

function buildFile(rows: readonly PreviewRow[], sha256: string): EnrollmentImportFileSeed {
  return {
    name: FILENAME,
    sha256,
    workbook: {
      headers: HEADERS,
      mapping: {
        class_code: HEADERS[1],
        effective_from: HEADERS[3],
        registered_mode: HEADERS[2],
        student_public_code: HEADERS[0],
      },
      rows: rows.map((row) => ({
        class_code: row.classCode,
        effective_from: row.from,
        registered_mode: row.mode,
        source_row: row.sourceRow,
        student_public_code: row.student,
      })),
      sheetName: "Enrollments",
      totalRows: rows.length,
    },
  };
}

function buildDryRun(rows: readonly PreviewRow[]): EnrollmentImportDryRunResult {
  const dryRunRows: EnrollmentImportDryRunRow[] = rows.map((row) => ({
    academic_year_code: ACADEMIC_YEAR_CODE,
    class_code: row.classCode,
    classification: row.classification,
    effective_from: row.from,
    registered_mode: row.mode,
    resolved_class_id: row.classification === "invalid" ? null : `class-${row.classCode}`,
    resolved_enrollment_id: row.classification === "existing_matching" ? `enrollment-${row.sourceRow}` : null,
    resolved_student_id: row.code === "ENROLLMENT_IMPORT_STUDENT_NOT_FOUND" ? null : `student-${row.student}`,
    source_row: row.sourceRow,
    student_public_code: row.student,
    validation_code: row.code ?? null,
    validation_message: row.message ?? null,
  }));
  const count = (classification: EnrollmentImportClassification) => rows.filter((row) => row.classification === classification).length;
  return {
    academic_year_code: ACADEMIC_YEAR_CODE,
    academic_year_id: "ay-2026-2027",
    conflict_count: count("existing_conflict"),
    invalid_count: count("invalid"),
    matching_count: count("existing_matching"),
    new_count: count("new"),
    row_count: rows.length,
    rows: dryRunRows,
  };
}

export const enrollmentPreviewFileWithProblems = buildFile(ROWS_WITH_PROBLEMS, "c81f0e2d9b4a7c6e5d3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d");
export const enrollmentPreviewFileClean = buildFile(ROWS_CLEAN, "2a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c");
export const enrollmentPreviewDryRunWithProblems = buildDryRun(ROWS_WITH_PROBLEMS);
export const enrollmentPreviewDryRunClean = buildDryRun(ROWS_CLEAN);

/** `state=batch`: the staging batch created from the clean file. */
export const enrollmentPreviewBatch = {
  id: "5d2c8e41-3b7a-4f96-8c1d-2e9a6b4f7c30",
  matching_count: enrollmentPreviewDryRunClean.matching_count,
  new_count: enrollmentPreviewDryRunClean.new_count,
  row_count: enrollmentPreviewDryRunClean.row_count,
  status: "ready_to_commit",
};

/** `state=done`: that batch committed at 10:40 Vietnam time on the fixed date. */
export const enrollmentPreviewCommitResult: EnrollmentImportCommitResult = {
  batch_id: enrollmentPreviewBatch.id,
  committed_at: `${IMPORTS_PREVIEW_TODAY}T03:40:00.000Z`,
  committed_new_count: enrollmentPreviewBatch.new_count,
  reused_matching_count: enrollmentPreviewBatch.matching_count,
  status: "committed",
};
