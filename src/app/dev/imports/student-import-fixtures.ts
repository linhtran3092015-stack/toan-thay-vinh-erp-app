import type {
  StudentImportCommitResult,
  StudentImportIssue,
  StudentImportNormalizedData,
  StudentImportParsedWorkbook,
  StudentImportValidationResult,
  StudentImportValidationRow,
  StudentImportWorkbookColumn,
} from "@/features/imports/students/types";

import { IMPORTS_PREVIEW_TODAY } from "./imports-preview-params";

/*
 * /dev/imports `view=students` fixtures (design 17c, fixed clock
 * 2026-10-19): one eight-row file in two versions (with errors, then fixed),
 * the dry-run results the server would return for them, and a commit result.
 * Messages are the RPC's own (validate_student_import_rows).
 */

export const STUDENT_IMPORT_PREVIEW_FILENAME = "hoc-sinh-khoi-6-7.xlsx";
const SHA_WITH_ERRORS = "9b2f6c1e4d8a7b3c5e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d";
const SHA_CLEAN = "4e1d8c2b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d";

type PreviewRow = {
  rowNumber: number;
  name: string;
  birthYear: string | number;
  grade: number;
  guardian: string;
  phone: string | null;
  relationship: string;
  mode: string;
  status: StudentImportValidationRow["status"];
  errors?: StudentImportIssue[];
  warnings?: StudentImportIssue[];
  exactDuplicate?: boolean;
};

const REUSED: StudentImportIssue = {
  code: "GUARDIAN_WILL_BE_REUSED",
  field: "guardian_phone",
  message: "Phụ huynh đã tồn tại và sẽ được dùng lại.",
};

const ROWS_WITH_ERRORS: readonly PreviewRow[] = [
  { birthYear: 2015, grade: 6, guardian: "Đào Văn Kiên", mode: "offline", name: "Đào Thu Trang", phone: "0915222333", relationship: "Bố", rowNumber: 2, status: "valid" },
  { birthYear: 2014, grade: 7, guardian: "Hoàng Thị Lan", mode: "online", name: "Hoàng Nhật Minh", phone: "0933444555", relationship: "Mẹ", rowNumber: 3, status: "valid" },
  {
    birthYear: 20013,
    errors: [{ code: "BIRTH_YEAR_INVALID", field: "birth_year", message: "Năm sinh phải gồm 4 chữ số." }],
    grade: 6,
    guardian: "Nguyễn Văn An",
    mode: "offline",
    name: "Nguyễn Văn",
    phone: "0912000111",
    relationship: "Bố",
    rowNumber: 4,
    status: "invalid",
  },
  {
    birthYear: 2014,
    errors: [{ code: "GUARDIAN_PHONE_REQUIRED", field: "guardian_phone", message: "Số điện thoại phụ huynh là bắt buộc." }],
    grade: 7,
    guardian: "Trần Văn Bình",
    mode: "offline",
    name: "Trần Minh Thư",
    phone: null,
    relationship: "Bố",
    rowNumber: 5,
    status: "invalid",
  },
  { birthYear: 2015, grade: 6, guardian: "Lý Văn Sơn", mode: "offline", name: "Lý Gia Hân", phone: "0989001122", relationship: "Bố", rowNumber: 6, status: "warning", warnings: [REUSED] },
  { birthYear: 2014, grade: 7, guardian: "Phan Thị Mai", mode: "online", name: "Phan Minh Đức", phone: "0977334455", relationship: "Mẹ", rowNumber: 7, status: "warning", warnings: [REUSED] },
  {
    birthYear: 2015,
    errors: [
      {
        code: "EXACT_STUDENT_DUPLICATE",
        field: "student_full_name",
        message: "Học viên đã tồn tại với cùng họ tên, năm sinh và số điện thoại phụ huynh.",
      },
    ],
    exactDuplicate: true,
    grade: 6,
    guardian: "Bùi Văn Tùng",
    mode: "offline",
    name: "Bùi Khánh Vy",
    phone: "0966111222",
    relationship: "Bố",
    rowNumber: 8,
    status: "invalid",
    warnings: [REUSED],
  },
  { birthYear: 2015, grade: 6, guardian: "Vũ Văn Hòa", mode: "offline", name: "Vũ Hải Yến", phone: "0909888777", relationship: "Mẹ", rowNumber: 9, status: "valid" },
];

/** The same file after the owner fixed rows 4, 5 and 8 in Excel. */
const ROWS_CLEAN: readonly PreviewRow[] = ROWS_WITH_ERRORS.map((row) => {
  if (row.rowNumber === 4) return { ...row, birthYear: 2013, errors: [], name: "Nguyễn Văn Khang", status: "valid" };
  if (row.rowNumber === 5) return { ...row, errors: [], phone: "0912345678", status: "valid" };
  if (row.rowNumber === 8) return { ...row, errors: [], exactDuplicate: false, name: "Bùi Khánh Linh", status: "warning" };
  return row;
});

const HEADERS = [
  "Họ và tên học viên *",
  "Năm sinh *",
  "Khối hiện tại *",
  "Họ và tên phụ huynh *",
  "Số điện thoại phụ huynh *",
  "Quan hệ với học viên *",
  "Hình thức học",
] as const;

function buildWorkbook(rows: readonly PreviewRow[], sha: string, phoneHeader: string = HEADERS[4]): StudentImportParsedWorkbook {
  const headers = HEADERS.map((header, index) => (index === 4 ? phoneHeader : header));
  const columns: StudentImportWorkbookColumn[] = headers.map((header, index) => ({
    columnIndex: index + 1,
    columnKey: String.fromCharCode(65 + index),
    sourceHeader: header,
  }));
  return {
    columns,
    rowCount: rows.length,
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      values: { A: row.name, B: row.birthYear, C: row.grade, D: row.guardian, E: row.phone, F: row.relationship, G: row.mode },
    })),
    sheetName: "HocSinh",
    sourceFilename: STUDENT_IMPORT_PREVIEW_FILENAME,
    sourceSha256: sha,
  };
}

function normalized(row: PreviewRow): StudentImportNormalizedData {
  const birthYear = typeof row.birthYear === "number" && row.birthYear >= 1990 && row.birthYear <= 2100 ? row.birthYear : null;
  return {
    birth_year: birthYear,
    current_grade: row.grade,
    guardian_email: null,
    guardian_full_name: row.guardian,
    guardian_notes: null,
    guardian_phone: row.phone,
    guardian_relationship: row.relationship,
    guardian_zalo: null,
    internal_notes: null,
    learning_goal: null,
    learning_level: null,
    nickname: null,
    province_city: null,
    registered_mode: row.mode,
    student_full_name: row.name,
  };
}

function buildValidation(rows: readonly PreviewRow[]): StudentImportValidationResult {
  const validationRows: StudentImportValidationRow[] = rows.map((row) => ({
    errors: row.errors ?? [],
    exact_student_duplicate: row.exactDuplicate ?? false,
    existing_guardian_id: row.warnings?.length ? `guardian-${row.rowNumber}` : null,
    guardian_reused: Boolean(row.warnings?.length),
    normalized_data: normalized(row),
    row_number: row.rowNumber,
    status: row.status,
    warnings: row.warnings ?? [],
  }));
  return {
    invalid_count: validationRows.filter((row) => row.status === "invalid").length,
    row_count: validationRows.length,
    rows: validationRows,
    valid_count: validationRows.filter((row) => row.status === "valid").length,
    warning_count: validationRows.filter((row) => row.status === "warning").length,
  };
}

/** `state=mapping`: the guardian phone column is headed "Điện thoại", which no alias matches. */
export const studentPreviewWorkbookUnmapped = buildWorkbook(ROWS_WITH_ERRORS, SHA_WITH_ERRORS, "Điện thoại");
export const studentPreviewWorkbookWithErrors = buildWorkbook(ROWS_WITH_ERRORS, SHA_WITH_ERRORS);
export const studentPreviewWorkbookClean = buildWorkbook(ROWS_CLEAN, SHA_CLEAN);
export const studentPreviewValidationWithErrors = buildValidation(ROWS_WITH_ERRORS);
export const studentPreviewValidationClean = buildValidation(ROWS_CLEAN);

/** `state=done`: the clean file committed at 10:15 Vietnam time on the fixed date. */
export const studentPreviewCommitResult: StudentImportCommitResult = {
  batch_id: "0c4b6a52-5d1e-4c8b-9a3f-2e7d6b1a9c40",
  committed_at: `${IMPORTS_PREVIEW_TODAY}T03:15:00.000Z`,
  committed_by: "dev-user",
  guardian_created_count: 5,
  guardian_reused_count: 3,
  row_count: 8,
  source_filename: STUDENT_IMPORT_PREVIEW_FILENAME,
  source_sha256: SHA_CLEAN,
  student_count: 8,
  students: ROWS_CLEAN.map((row, index) => ({
    guardian_id: `guardian-${row.rowNumber}`,
    guardian_reused: row.status === "warning",
    row_number: row.rowNumber,
    student_id: `student-preview-${row.rowNumber}`,
    student_public_code: `TV-2026-${String(201 + index).padStart(5, "0")}`,
  })),
};
