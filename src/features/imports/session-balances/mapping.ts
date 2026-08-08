import {
  SESSION_BALANCE_IMPORT_FIELD_KEYS,
  SESSION_BALANCE_IMPORT_REQUIRED_FIELD_KEYS,
} from "@/features/imports/session-balances/fields";
import type {
  SessionBalanceImportAutomaticMapping,
  SessionBalanceImportColumnMapping,
  SessionBalanceImportFieldKey,
  SessionBalanceImportMappingIssue,
  SessionBalanceImportMappingValidation,
  SessionBalanceImportParsedWorkbook,
  SessionBalanceImportRowInput,
  SessionBalanceImportWorkbookColumn,
} from "@/features/imports/session-balances/types";

const SESSION_BALANCE_IMPORT_HEADER_ALIASES: Record<
  SessionBalanceImportFieldKey,
  readonly string[]
> = {
  student_public_code: [
    "student_public_code",
    "ma hoc vien",
    "ma hv",
    "student code",
    "public code",
  ],
  source_student_name: [
    "source_student_name",
    "ho va ten hoc vien",
    "ho ten hoc vien",
    "ten hoc vien",
    "ho ten",
    "student name",
    "full name",
  ],
  source_balance: [
    "source_balance",
    "so du buoi",
    "so buoi",
    "balance",
    "session balance",
  ],
};

export class SessionBalanceImportMappingError extends Error {
  readonly issues: SessionBalanceImportMappingIssue[];

  constructor(issues: SessionBalanceImportMappingIssue[]) {
    super("Ánh xạ cột import chưa hợp lệ.");
    this.name = "SessionBalanceImportMappingError";
    this.issues = issues;
  }
}

export function normalizeSessionBalanceImportHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_*]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNormalizedAliases(
  fieldKey: SessionBalanceImportFieldKey,
): Set<string> {
  return new Set(
    SESSION_BALANCE_IMPORT_HEADER_ALIASES[fieldKey].map(
      normalizeSessionBalanceImportHeader,
    ),
  );
}

export function buildSessionBalanceImportAutomaticMapping(
  columns: SessionBalanceImportWorkbookColumn[],
): SessionBalanceImportAutomaticMapping {
  const candidateColumnsByField = new Map<
    SessionBalanceImportFieldKey,
    string[]
  >();

  const candidateFieldsByColumn = new Map<
    string,
    SessionBalanceImportFieldKey[]
  >();

  for (const fieldKey of SESSION_BALANCE_IMPORT_FIELD_KEYS) {
    const aliases = getNormalizedAliases(fieldKey);

    const candidates = columns
      .filter((column) => {
        if (!column.sourceHeader) {
          return false;
        }

        return aliases.has(
          normalizeSessionBalanceImportHeader(column.sourceHeader),
        );
      })
      .map((column) => column.columnKey);

    candidateColumnsByField.set(fieldKey, candidates);

    for (const columnKey of candidates) {
      const current = candidateFieldsByColumn.get(columnKey) ?? [];
      current.push(fieldKey);
      candidateFieldsByColumn.set(columnKey, current);
    }
  }

  const mapping: SessionBalanceImportColumnMapping = {};
  const ambiguousFields: SessionBalanceImportFieldKey[] = [];
  const assignedColumns = new Set<string>();

  for (const fieldKey of SESSION_BALANCE_IMPORT_FIELD_KEYS) {
    const candidates = candidateColumnsByField.get(fieldKey) ?? [];

    if (candidates.length === 0) {
      continue;
    }

    if (candidates.length !== 1) {
      ambiguousFields.push(fieldKey);
      continue;
    }

    const columnKey = candidates[0];

    if (!columnKey) {
      continue;
    }

    const candidateFields = candidateFieldsByColumn.get(columnKey) ?? [];

    if (candidateFields.length !== 1) {
      ambiguousFields.push(fieldKey);
      continue;
    }

    mapping[fieldKey] = columnKey;
    assignedColumns.add(columnKey);
  }

  return {
    ambiguousFields,
    mapping,
    unmatchedColumns: columns
      .map((column) => column.columnKey)
      .filter((columnKey) => !assignedColumns.has(columnKey)),
  };
}

export function validateSessionBalanceImportColumnMapping(
  columns: SessionBalanceImportWorkbookColumn[],
  mapping: SessionBalanceImportColumnMapping,
): SessionBalanceImportMappingValidation {
  const issues: SessionBalanceImportMappingIssue[] = [];

  const knownFields = new Set<string>(SESSION_BALANCE_IMPORT_FIELD_KEYS);

  const knownColumns = new Set(
    columns.map((column) => column.columnKey),
  );

  const usedColumns = new Map<string, SessionBalanceImportFieldKey>();

  for (const [rawFieldKey, rawColumnKey] of Object.entries(mapping)) {
    if (!knownFields.has(rawFieldKey)) {
      issues.push({
        code: "unknown_target_field",
        message: `Trường đích không hợp lệ: ${rawFieldKey}.`,
      });
      continue;
    }

    const fieldKey = rawFieldKey as SessionBalanceImportFieldKey;

    if (
      rawColumnKey === null ||
      rawColumnKey === undefined ||
      rawColumnKey.trim().length === 0
    ) {
      continue;
    }

    const columnKey = rawColumnKey.trim();

    if (!knownColumns.has(columnKey)) {
      issues.push({
        code: "unknown_source_column",
        columnKey,
        fieldKey,
        message: `Không tìm thấy cột nguồn ${columnKey}.`,
      });
      continue;
    }

    const existingField = usedColumns.get(columnKey);

    if (existingField) {
      issues.push({
        code: "duplicate_source_column",
        columnKey,
        fieldKey,
        message: `Cột ${columnKey} đang được dùng cho cả ${existingField} và ${fieldKey}.`,
      });
      continue;
    }

    usedColumns.set(columnKey, fieldKey);
  }

  const missingRequiredFields =
    SESSION_BALANCE_IMPORT_REQUIRED_FIELD_KEYS.filter((fieldKey) => {
      const columnKey = mapping[fieldKey];

      return (
        typeof columnKey !== "string" ||
        columnKey.trim().length === 0 ||
        !knownColumns.has(columnKey.trim())
      );
    });

  for (const fieldKey of missingRequiredFields) {
    issues.push({
      code: "missing_required_field",
      fieldKey,
      message: `Chưa ánh xạ trường bắt buộc ${fieldKey}.`,
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
    missingRequiredFields: [...missingRequiredFields],
  };
}

export function mapSessionBalanceImportWorkbookRows(
  workbook: SessionBalanceImportParsedWorkbook,
  mapping: SessionBalanceImportColumnMapping,
): SessionBalanceImportRowInput[] {
  const validation = validateSessionBalanceImportColumnMapping(
    workbook.columns,
    mapping,
  );

  if (!validation.isValid) {
    throw new SessionBalanceImportMappingError(validation.issues);
  }

  return workbook.rows.map((sourceRow) => {
    const targetRow: SessionBalanceImportRowInput = {
      row_number: sourceRow.rowNumber,
    };

    for (const fieldKey of SESSION_BALANCE_IMPORT_FIELD_KEYS) {
      const sourceColumnKey = mapping[fieldKey];

      if (
        typeof sourceColumnKey !== "string" ||
        sourceColumnKey.trim().length === 0
      ) {
        continue;
      }

      targetRow[fieldKey] =
        sourceRow.values[sourceColumnKey.trim()] ?? null;
    }

    return targetRow;
  });
}
