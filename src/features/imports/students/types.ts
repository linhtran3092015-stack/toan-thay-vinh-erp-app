export type StudentImportCellValue =
  | string
  | number
  | null;

export interface StudentImportRowInput {
  birth_year?: StudentImportCellValue;
  current_grade?: StudentImportCellValue;
  guardian_email?: StudentImportCellValue;
  guardian_full_name?: StudentImportCellValue;
  guardian_notes?: StudentImportCellValue;
  guardian_phone?: StudentImportCellValue;
  guardian_relationship?: StudentImportCellValue;
  guardian_zalo?: StudentImportCellValue;
  internal_notes?: StudentImportCellValue;
  learning_goal?: StudentImportCellValue;
  learning_level?: StudentImportCellValue;
  nickname?: StudentImportCellValue;
  province_city?: StudentImportCellValue;
  registered_mode?: StudentImportCellValue;
  row_number?: StudentImportCellValue;
  student_full_name?: StudentImportCellValue;
}

export interface StudentImportNormalizedData {
  birth_year: number | null;
  current_grade: number | null;
  guardian_email: string | null;
  guardian_full_name: string | null;
  guardian_notes: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  guardian_zalo: string | null;
  internal_notes: string | null;
  learning_goal: string | null;
  learning_level: string | null;
  nickname: string | null;
  province_city: string | null;
  registered_mode: string | null;
  student_full_name: string | null;
}

export interface StudentImportIssue {
  code: string;
  field: string | null;
  message: string;
}

export type StudentImportRowStatus =
  | "valid"
  | "warning"
  | "invalid";

export interface StudentImportValidationRow {
  errors: StudentImportIssue[];
  exact_student_duplicate: boolean;
  existing_guardian_id: string | null;
  guardian_reused: boolean;
  normalized_data: StudentImportNormalizedData;
  row_number: number;
  status: StudentImportRowStatus;
  warnings: StudentImportIssue[];
}

export interface StudentImportValidationResult {
  invalid_count: number;
  row_count: number;
  rows: StudentImportValidationRow[];
  valid_count: number;
  warning_count: number;
}

export interface StudentImportCommitStudent {
  guardian_id: string;
  guardian_reused: boolean;
  row_number: number;
  student_id: string;
  student_public_code: string;
}

export interface StudentImportCommitResult {
  batch_id: string;
  committed_at: string;
  committed_by: string;
  guardian_created_count: number;
  guardian_reused_count: number;
  row_count: number;
  source_filename: string;
  source_sha256: string;
  student_count: number;
  students: StudentImportCommitStudent[];
}

export interface ValidateStudentImportInput {
  rows: StudentImportRowInput[];
}

export interface CommitStudentImportInput {
  reason: string;
  rows: StudentImportRowInput[];
  sourceFilename: string;
  sourceSha256: string;
}

export type StudentImportActionErrorCode =
  | "conflict"
  | "database_error"
  | "forbidden"
  | "invalid_request"
  | "invalid_response"
  | "session_required";

export interface StudentImportActionFailure {
  code: StudentImportActionErrorCode;
  fieldErrors?: Record<string, string[]>;
  message: string;
  ok: false;
}

export interface StudentImportActionSuccess<TData> {
  data: TData;
  ok: true;
}

export type StudentImportActionResult<TData> =
  | StudentImportActionSuccess<TData>
  | StudentImportActionFailure;
