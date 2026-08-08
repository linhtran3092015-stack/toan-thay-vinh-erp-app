import {
  CLASS_ALIAS_MAP,
  CLASS_IMPORT_FIELDS,
  SCHEDULE_ALIAS_MAP,
  SCHEDULE_IMPORT_FIELDS,
} from "./fields";

import type {
  ClassImportAutomaticMapping,
  ClassImportColumnMapping,
  ClassImportFieldKey,
  ClassScheduleImportMappingIssue,
  ClassScheduleImportMappingValidation,
  ClassScheduleImportParsedSheet,
  ScheduleImportAutomaticMapping,
  ScheduleImportColumnMapping,
  ScheduleImportFieldKey,
} from "./types";

function normalizeHeaderString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s*_/-]+/g, " ")
    .trim();
}

export function autoMapClassesSheet(
  sheet: ClassScheduleImportParsedSheet
): ClassImportAutomaticMapping {
  const mapping: ClassImportColumnMapping = {};
  const ambiguousFields: ClassImportFieldKey[] = [];
  const matchedColumns = new Set<string>();

  CLASS_IMPORT_FIELDS.forEach((field) => {
    const aliases = CLASS_ALIAS_MAP[field.key];
    const candidateColumns = sheet.columns.filter((col) => {
      if (!col.sourceHeader) return false;
      const normalizedHeader = normalizeHeaderString(col.sourceHeader);
      return aliases.some((alias) => normalizeHeaderString(alias) === normalizedHeader);
    });

    if (candidateColumns.length === 1) {
      const matchedCol = candidateColumns[0];
      mapping[field.key] = matchedCol.columnKey;
      matchedColumns.add(matchedCol.columnKey);
    } else if (candidateColumns.length > 1) {
      ambiguousFields.push(field.key);
      mapping[field.key] = null;
    } else {
      mapping[field.key] = null;
    }
  });

  const unmatchedColumns = sheet.columns
    .filter((col) => !matchedColumns.has(col.columnKey))
    .map((col) => col.columnKey);

  return {
    ambiguousFields,
    mapping,
    unmatchedColumns,
  };
}

export function autoMapSchedulesSheet(
  sheet: ClassScheduleImportParsedSheet
): ScheduleImportAutomaticMapping {
  const mapping: ScheduleImportColumnMapping = {};
  const ambiguousFields: ScheduleImportFieldKey[] = [];
  const matchedColumns = new Set<string>();

  SCHEDULE_IMPORT_FIELDS.forEach((field) => {
    const aliases = SCHEDULE_ALIAS_MAP[field.key];
    const candidateColumns = sheet.columns.filter((col) => {
      if (!col.sourceHeader) return false;
      const normalizedHeader = normalizeHeaderString(col.sourceHeader);
      return aliases.some((alias) => normalizeHeaderString(alias) === normalizedHeader);
    });

    if (candidateColumns.length === 1) {
      const matchedCol = candidateColumns[0];
      mapping[field.key] = matchedCol.columnKey;
      matchedColumns.add(matchedCol.columnKey);
    } else if (candidateColumns.length > 1) {
      ambiguousFields.push(field.key);
      mapping[field.key] = null;
    } else {
      mapping[field.key] = null;
    }
  });

  const unmatchedColumns = sheet.columns
    .filter((col) => !matchedColumns.has(col.columnKey))
    .map((col) => col.columnKey);

  return {
    ambiguousFields,
    mapping,
    unmatchedColumns,
  };
}

export function validateClassesMapping(
  mapping: ClassImportColumnMapping
): ClassScheduleImportMappingValidation {
  const issues: ClassScheduleImportMappingIssue[] = [];
  const missingRequiredFields: string[] = [];
  const columnToFieldMap = new Map<string, ClassImportFieldKey>();

  CLASS_IMPORT_FIELDS.forEach((field) => {
    const colKey = mapping[field.key];
    if (!colKey) {
      if (field.required) {
        missingRequiredFields.push(field.label);
        issues.push({
          code: "missing_required_field",
          fieldKey: field.key,
          message: `Trường bắt buộc "${field.label}" chưa được gán cột.`,
        });
      }
    } else {
      if (columnToFieldMap.has(colKey)) {
        const existingFieldKey = columnToFieldMap.get(colKey)!;
        const existingField = CLASS_IMPORT_FIELDS.find((f) => f.key === existingFieldKey);
        issues.push({
          code: "duplicate_source_column",
          columnKey: colKey,
          message: `Cột "${colKey}" đang được gán trùng cho 2 trường "${existingField?.label}" và "${field.label}".`,
        });
      } else {
        columnToFieldMap.set(colKey, field.key);
      }
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
    missingRequiredFields,
  };
}

export function validateSchedulesMapping(
  mapping: ScheduleImportColumnMapping
): ClassScheduleImportMappingValidation {
  const issues: ClassScheduleImportMappingIssue[] = [];
  const missingRequiredFields: string[] = [];
  const columnToFieldMap = new Map<string, ScheduleImportFieldKey>();

  SCHEDULE_IMPORT_FIELDS.forEach((field) => {
    const colKey = mapping[field.key];
    if (!colKey) {
      if (field.required) {
        missingRequiredFields.push(field.label);
        issues.push({
          code: "missing_required_field",
          fieldKey: field.key,
          message: `Trường bắt buộc "${field.label}" chưa được gán cột.`,
        });
      }
    } else {
      if (columnToFieldMap.has(colKey)) {
        const existingFieldKey = columnToFieldMap.get(colKey)!;
        const existingField = SCHEDULE_IMPORT_FIELDS.find((f) => f.key === existingFieldKey);
        issues.push({
          code: "duplicate_source_column",
          columnKey: colKey,
          message: `Cột "${colKey}" đang được gán trùng cho 2 trường "${existingField?.label}" và "${field.label}".`,
        });
      } else {
        columnToFieldMap.set(colKey, field.key);
      }
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
    missingRequiredFields,
  };
}
