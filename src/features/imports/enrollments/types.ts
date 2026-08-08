export type EnrollmentImportClassification =
  | "new"
  | "existing_matching"
  | "existing_conflict"
  | "invalid";

export interface EnrollmentImportRawRow {
  source_row: number;
  student_public_code: string;
  class_code: string;
  registered_mode: string;
  effective_from: string;
}

export interface EnrollmentImportDryRunRow {
  source_row: number;
  academic_year_code: string;
  student_public_code: string;
  class_code: string;
  registered_mode: string;
  effective_from: string;
  classification: EnrollmentImportClassification;
  resolved_student_id: string | null;
  resolved_class_id: string | null;
  resolved_enrollment_id: string | null;
  validation_code: string | null;
  validation_message: string | null;
}

export interface EnrollmentImportDryRunResult {
  academic_year_code: string;
  academic_year_id: string;
  row_count: number;
  new_count: number;
  matching_count: number;
  conflict_count: number;
  invalid_count: number;
  rows: EnrollmentImportDryRunRow[];
}
