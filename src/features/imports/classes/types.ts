import type { Json } from "@/types/database.generated";

export type ClassScheduleImportCellValue = string | number | boolean | null;

export type ClassImportFieldKey =
  | "academic_year_code"
  | "class_code"
  | "class_name"
  | "grade"
  | "level"
  | "weekly_session_count"
  | "default_learning_mode"
  | "status";

export type ScheduleImportFieldKey =
  | "class_code"
  | "component_code"
  | "weekday"
  | "start_time"
  | "end_time"
  | "learning_mode"
  | "room_name"
  | "meeting_url"
  | "effective_from"
  | "effective_to";

export interface ClassImportFieldDefinition {
  key: ClassImportFieldKey;
  label: string;
  required: boolean;
  templateHeader: string;
  width: number;
}

export interface ScheduleImportFieldDefinition {
  key: ScheduleImportFieldKey;
  label: string;
  required: boolean;
  templateHeader: string;
  width: number;
}

export interface ClassScheduleImportWorkbookColumn {
  columnIndex: number;
  columnKey: string;
  sourceHeader: string | null;
}

export interface ClassScheduleImportWorkbookRow {
  rowNumber: number;
  values: Record<string, ClassScheduleImportCellValue>;
}

export interface ClassScheduleImportParsedSheet {
  columns: ClassScheduleImportWorkbookColumn[];
  rowCount: number;
  rows: ClassScheduleImportWorkbookRow[];
  sheetName: string;
}

export interface ClassScheduleImportParsedWorkbook {
  classesSheet: ClassScheduleImportParsedSheet;
  schedulesSheet: ClassScheduleImportParsedSheet;
  sourceFilename: string;
  sourceSha256: string;
}

export type ClassImportColumnMapping = {
  [Key in ClassImportFieldKey]?: string | null;
};

export type ScheduleImportColumnMapping = {
  [Key in ScheduleImportFieldKey]?: string | null;
};

export interface ClassImportAutomaticMapping {
  ambiguousFields: ClassImportFieldKey[];
  mapping: ClassImportColumnMapping;
  unmatchedColumns: string[];
}

export interface ScheduleImportAutomaticMapping {
  ambiguousFields: ScheduleImportFieldKey[];
  mapping: ScheduleImportColumnMapping;
  unmatchedColumns: string[];
}

export type ClassScheduleImportMappingIssueCode =
  | "duplicate_source_column"
  | "missing_required_field"
  | "unknown_source_column"
  | "unknown_target_field";

export interface ClassScheduleImportMappingIssue {
  code: ClassScheduleImportMappingIssueCode;
  columnKey?: string;
  fieldKey?: string;
  message: string;
}

export interface ClassScheduleImportMappingValidation {
  isValid: boolean;
  issues: ClassScheduleImportMappingIssue[];
  missingRequiredFields: string[];
}

// Input schemas for dry-run RPC
export interface ClassImportRowInput {
  academic_year_code?: ClassScheduleImportCellValue;
  class_code?: ClassScheduleImportCellValue;
  class_name?: ClassScheduleImportCellValue;
  default_learning_mode?: ClassScheduleImportCellValue;
  grade?: ClassScheduleImportCellValue;
  level?: ClassScheduleImportCellValue;
  source_row_number?: number;
  status?: ClassScheduleImportCellValue;
  weekly_session_count?: ClassScheduleImportCellValue;
}

export interface ScheduleImportRowInput {
  class_code?: ClassScheduleImportCellValue;
  component_code?: ClassScheduleImportCellValue;
  effective_from?: ClassScheduleImportCellValue;
  effective_to?: ClassScheduleImportCellValue;
  end_time?: ClassScheduleImportCellValue;
  learning_mode?: ClassScheduleImportCellValue;
  meeting_url?: ClassScheduleImportCellValue;
  room_name?: ClassScheduleImportCellValue;
  source_row_number?: number;
  start_time?: ClassScheduleImportCellValue;
  weekday?: ClassScheduleImportCellValue;
}

export interface DryRunClassScheduleImportInput {
  academic_year_code: string;
  classes: ClassImportRowInput[];
  schedules: ScheduleImportRowInput[];
}

export interface CreateClassScheduleImportBatchInput {
  academic_year_code: string;
  classes: ClassImportRowInput[];
  explicit_confirmation: boolean;
  reason: string;
  schedules: ScheduleImportRowInput[];
  source_filename: string;
  source_sha256: string;
}

export interface CommitClassScheduleImportBatchInput {
  batch_id: string;
  confirmation_checked: boolean;
  confirmation_text: string;
  reason: string;
}

export type ClassScheduleImportRowClassification =
  | "new"
  | "existing_matching"
  | "existing_conflict"
  | "invalid"
  | "committed";

export interface DryRunClassResultRow {
  academic_year_code: string;
  class_code: string;
  class_name: string;
  classification: ClassScheduleImportRowClassification;
  default_learning_mode: string;
  grade: number;
  level: string;
  resolved_academic_year_id: string | null;
  resolved_class_id: string | null;
  source_row_number: number;
  status: string;
  validation_code: string | null;
  validation_message: string | null;
  weekly_session_count: number;
}

export interface DryRunScheduleResultRow {
  class_code: string;
  classification: ClassScheduleImportRowClassification;
  component_code: string;
  effective_from: string;
  effective_to: string | null;
  end_time: string;
  learning_mode: string;
  meeting_url: string | null;
  resolved_class_id: string | null;
  resolved_schedule_template_id: string | null;
  room_name: string | null;
  source_row_number: number;
  start_time: string;
  validation_code: string | null;
  validation_message: string | null;
  weekday: number;
}

export interface ClassScheduleImportSummaryCount {
  existing_conflict: number;
  existing_matching: number;
  invalid: number;
  new: number;
  total: number;
}

export interface AcademicYearResolutionSummary {
  code: string;
  id: string;
  name: string;
  status: string;
}

export interface DryRunClassScheduleImportResult {
  academic_year: AcademicYearResolutionSummary;
  class_rows: DryRunClassResultRow[];
  class_summary: ClassScheduleImportSummaryCount;
  schedule_rows: DryRunScheduleResultRow[];
  schedule_summary: ClassScheduleImportSummaryCount;
}

export type ClassScheduleImportBatchStatus =
  | "previewed"
  | "ready_to_commit"
  | "committed"
  | "rejected";

export interface ClassScheduleImportBatchRecord {
  academic_year_code: string;
  academic_year_id: string | null;
  class_conflict_count: number;
  class_invalid_count: number;
  class_matching_count: number;
  class_new_count: number;
  class_row_count: number;
  committed_at: string | null;
  committed_by: string | null;
  created_at: string;
  created_by: string | null;
  id: string;
  metadata: Json;
  reason: string;
  schedule_conflict_count: number;
  schedule_invalid_count: number;
  schedule_matching_count: number;
  schedule_new_count: number;
  schedule_row_count: number;
  source_filename: string;
  source_sha256: string;
  status: ClassScheduleImportBatchStatus;
}

export interface ClassScheduleImportClassRowRecord {
  academic_year_code: string;
  batch_id: string;
  class_code: string;
  class_name: string;
  classification: ClassScheduleImportRowClassification;
  created_at: string;
  default_learning_mode: string;
  grade: number;
  id: string;
  level: string;
  resolved_academic_year_id: string | null;
  resolved_class_id: string | null;
  source_row_number: number;
  status: string;
  validation_code: string | null;
  validation_message: string | null;
  weekly_session_count: number;
}

export interface ClassScheduleImportScheduleRowRecord {
  batch_id: string;
  class_code: string;
  classification: ClassScheduleImportRowClassification;
  component_code: string;
  created_at: string;
  effective_from: string;
  effective_to: string | null;
  end_time: string;
  id: string;
  learning_mode: string;
  meeting_url: string | null;
  resolved_class_id: string | null;
  resolved_schedule_template_id: string | null;
  room_name: string | null;
  source_row_number: number;
  start_time: string;
  validation_code: string | null;
  validation_message: string | null;
  weekday: number;
}

export interface ClassScheduleImportBatchDetail {
  batch: ClassScheduleImportBatchRecord;
  classRows: ClassScheduleImportClassRowRecord[];
  scheduleRows: ClassScheduleImportScheduleRowRecord[];
}

export type ClassScheduleImportActionErrorCode =
  | "session_required"
  | "forbidden"
  | "invalid_request"
  | "invalid_response"
  | "conflict"
  | "database_error";

export interface ClassScheduleImportActionFailure {
  code: ClassScheduleImportActionErrorCode;
  existingBatchId?: string;
  fieldErrors?: Record<string, string[]>;
  message: string;
  ok: false;
}

export type ClassScheduleImportActionResult<T> =
  | { data: T; ok: true }
  | ClassScheduleImportActionFailure;
