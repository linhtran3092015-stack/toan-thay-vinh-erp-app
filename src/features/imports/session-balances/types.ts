export type SessionBalanceImportCellValue = string | number | null;

export type SessionBalanceImportFieldKey =
  | "student_public_code"
  | "source_student_name"
  | "source_balance";

export interface SessionBalanceImportFieldDefinition {
  key: SessionBalanceImportFieldKey;
  label: string;
  required: boolean;
  templateHeader: string;
  width: number;
}

export interface SessionBalanceImportWorkbookColumn {
  columnIndex: number;
  columnKey: string;
  sourceHeader: string | null;
}

export interface SessionBalanceImportWorkbookRow {
  rowNumber: number;
  values: Record<string, SessionBalanceImportCellValue>;
}

export interface SessionBalanceImportParsedWorkbook {
  columns: SessionBalanceImportWorkbookColumn[];
  rowCount: number;
  rows: SessionBalanceImportWorkbookRow[];
  sheetName: string;
  sourceFilename: string;
  sourceSha256: string;
}

export type SessionBalanceImportColumnMapping = {
  [Key in SessionBalanceImportFieldKey]?: string | null;
};

export interface SessionBalanceImportAutomaticMapping {
  ambiguousFields: SessionBalanceImportFieldKey[];
  mapping: SessionBalanceImportColumnMapping;
  unmatchedColumns: string[];
}

export type SessionBalanceImportMappingIssueCode =
  | "duplicate_source_column"
  | "missing_required_field"
  | "unknown_source_column"
  | "unknown_target_field";

export interface SessionBalanceImportMappingIssue {
  code: SessionBalanceImportMappingIssueCode;
  columnKey?: string;
  fieldKey?: SessionBalanceImportFieldKey;
  message: string;
}

export interface SessionBalanceImportMappingValidation {
  isValid: boolean;
  issues: SessionBalanceImportMappingIssue[];
  missingRequiredFields: SessionBalanceImportFieldKey[];
}

export interface SessionBalanceImportRowInput {
  row_number?: number;
  student_public_code?: SessionBalanceImportCellValue;
  source_student_name?: SessionBalanceImportCellValue;
  source_balance?: SessionBalanceImportCellValue;
}

export interface ValidateSessionBalanceImportInput {
  effective_on: string;
  rows: SessionBalanceImportRowInput[];
}

export type SessionBalanceImportValidationStatus =
  | "valid"
  | "review"
  | "invalid"
  | "no_change";

export type SessionBalanceImportBatchStatus =
  | "draft"
  | "previewed"
  | "awaiting_reconciliation"
  | "awaiting_approval"
  | "approved"
  | "posted"
  | "rejected";

export type SessionBalanceImportRowStatus =
  | "valid"
  | "review"
  | "invalid"
  | "no_change"
  | "excluded"
  | "posted";

export interface SessionBalanceImportRowResult {
  current_balance_before: number | null;
  delta_sessions: number | null;
  expected_balance_after: number | null;
  source_balance: number | null;
  source_row_number: number;
  source_student_name: string | null;
  student_enrollment_id: string | null;
  student_id: string | null;
  student_public_code: string | null;
  validation_code: string | null;
  validation_message: string | null;
  validation_status: SessionBalanceImportValidationStatus;
}

export interface SessionBalanceImportSummary {
  invalid: number;
  no_change: number;
  review: number;
  total: number;
  valid: number;
}

export interface SessionBalanceImportDryRunResult {
  rows: SessionBalanceImportRowResult[];
  summary: SessionBalanceImportSummary;
}

export interface CreateSessionBalanceImportBatchInput {
  effectiveOn: string;
  reason: string;
  rows: SessionBalanceImportRowInput[];
  sourceFilename: string;
  sourceSha256: string;
}

export interface ExcludeSessionBalanceImportRowInput {
  excludedReason: string;
  rowId: string;
}

export interface ReconcileSessionBalanceImportBatchInput {
  batchId: string;
  reason: string;
}

export interface ApproveSessionBalanceImportBatchInput {
  batchId: string;
}

export interface PostSessionBalanceImportBatchInput {
  batchId: string;
  confirmationText: string;
  confirmedCheck: boolean;
}

export interface SessionBalanceImportBatchRecord {
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  created_by: string | null;
  effective_on: string;
  excluded_count: number | null;
  id: string;
  invalid_count: number | null;
  metadata: Record<string, unknown>;
  no_change_count: number | null;
  posted_at: string | null;
  posted_by: string | null;
  posted_count: number | null;
  reason: string;
  reconciled_at: string | null;
  reconciled_by: string | null;
  review_count: number | null;
  row_count: number | null;
  source_filename: string;
  source_sha256: string;
  status: SessionBalanceImportBatchStatus;
  valid_count: number | null;
}

export interface SessionBalanceImportBatchListItem {
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  created_by: string | null;
  creator_name?: string | null;
  effective_on: string;
  excluded_count: number | null;
  id: string;
  invalid_count: number | null;
  no_change_count: number | null;
  posted_at: string | null;
  posted_by: string | null;
  posted_count: number | null;
  reason: string;
  reconciled_at: string | null;
  reconciled_by: string | null;
  review_count: number | null;
  row_count: number | null;
  source_filename: string;
  source_sha256: string;
  status: SessionBalanceImportBatchStatus;
  valid_count: number | null;
}

export interface SessionBalanceImportRowRecord {
  batch_id: string;
  created_at: string;
  current_balance_before: number | null;
  delta_sessions: number | null;
  excluded_reason: string | null;
  expected_balance_after: number | null;
  id: string;
  ledger_entry_id: string | null;
  source_balance: number;
  source_row_number: number;
  source_student_name: string | null;
  student_enrollment_id: string | null;
  student_id: string | null;
  student_public_code: string;
  validation_code: string | null;
  validation_message: string | null;
  validation_status: SessionBalanceImportRowStatus;
}

export interface SessionBalanceUserProfile {
  email: string | null;
  full_name: string | null;
}

export interface SessionBalanceImportBatchDetail {
  batch: SessionBalanceImportBatchRecord;
  profiles: Record<string, SessionBalanceUserProfile>;
  rows: SessionBalanceImportRowRecord[];
}

export type SessionBalanceImportActionErrorCode =
  | "session_required"
  | "forbidden"
  | "invalid_request"
  | "invalid_response"
  | "conflict"
  | "database_error";

export interface SessionBalanceImportActionFailure {
  code: SessionBalanceImportActionErrorCode;
  fieldErrors?: Record<string, string[]>;
  message: string;
  ok: false;
}

export type SessionBalanceImportActionResult<T> =
  | { data: T; ok: true }
  | SessionBalanceImportActionFailure;
