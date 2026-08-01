import type {
  StudentImportAutomaticMapping,
  StudentImportColumnMapping,
  StudentImportFieldKey,
  StudentImportMappingIssue,
  StudentImportMappingValidation,
  StudentImportParsedWorkbook,
  StudentImportRowInput,
  StudentImportWorkbookColumn,
} from "@/features/imports/students/types";

const STUDENT_IMPORT_FIELD_KEYS = [
  "student_full_name",
  "nickname",
  "birth_year",
  "province_city",
  "current_grade",
  "learning_level",
  "registered_mode",
  "learning_goal",
  "internal_notes",
  "guardian_full_name",
  "guardian_phone",
  "guardian_relationship",
  "guardian_zalo",
  "guardian_email",
  "guardian_notes",
] as const satisfies readonly StudentImportFieldKey[];

const STUDENT_IMPORT_REQUIRED_FIELD_KEYS = [
  "student_full_name",
  "birth_year",
  "current_grade",
  "guardian_full_name",
  "guardian_phone",
  "guardian_relationship",
] as const satisfies readonly StudentImportFieldKey[];

const STUDENT_IMPORT_HEADER_ALIASES: Record<
  StudentImportFieldKey,
  readonly string[]
> = {
  student_full_name: [
    "student_full_name",
    "ho va ten hoc vien",
    "ho ten hoc vien",
    "ten hoc vien",
    "hoc vien",
    "student name",
    "full name",
  ],

  nickname: [
    "nickname",
    "ten thuong goi",
    "ten goi",
    "biet danh",
  ],

  birth_year: [
    "birth_year",
    "nam sinh",
    "namsinh",
    "birth year",
    "year of birth",
  ],

  province_city: [
    "province_city",
    "tinh thanh pho",
    "tinh thanh",
    "tinh",
    "thanh pho",
    "province",
    "city",
  ],

  current_grade: [
    "current_grade",
    "khoi hien tai",
    "khoi",
    "lop hien tai",
    "grade",
    "current grade",
  ],

  learning_level: [
    "learning_level",
    "trinh do",
    "cap do",
    "level",
  ],

  registered_mode: [
    "registered_mode",
    "hinh thuc hoc",
    "hinh thuc",
    "online offline",
    "learning mode",
    "mode",
  ],

  learning_goal: [
    "learning_goal",
    "muc tieu hoc tap",
    "muc tieu",
    "learning goal",
  ],

  internal_notes: [
    "internal_notes",
    "ghi chu noi bo",
    "ghi chu hoc vien",
    "internal notes",
  ],

  guardian_full_name: [
    "guardian_full_name",
    "ho va ten phu huynh",
    "ho ten phu huynh",
    "ten phu huynh",
    "phu huynh",
    "guardian name",
    "parent name",
  ],

  guardian_phone: [
    "guardian_phone",
    "so dien thoai phu huynh",
    "sdt phu huynh",
    "dien thoai phu huynh",
    "so dt phu huynh",
    "guardian phone",
    "parent phone",
  ],

  guardian_relationship: [
    "guardian_relationship",
    "quan he voi hoc vien",
    "quan he",
    "moi quan he",
    "relationship",
  ],

  guardian_zalo: [
    "guardian_zalo",
    "zalo phu huynh",
    "tai khoan zalo phu huynh",
    "guardian zalo",
    "parent zalo",
  ],

  guardian_email: [
    "guardian_email",
    "email phu huynh",
    "guardian email",
    "parent email",
  ],

  guardian_notes: [
    "guardian_notes",
    "ghi chu phu huynh",
    "guardian notes",
    "parent notes",
  ],
};

export class StudentImportMappingError extends Error {
  readonly issues: StudentImportMappingIssue[];

  constructor(issues: StudentImportMappingIssue[]) {
    super(
      "Ánh xạ cột import chưa hợp lệ.",
    );

    this.name = "StudentImportMappingError";
    this.issues = issues;
  }
}

export function normalizeStudentImportHeader(
  value: string,
): string {
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
  fieldKey: StudentImportFieldKey,
): Set<string> {
  return new Set(
    STUDENT_IMPORT_HEADER_ALIASES[
      fieldKey
    ].map(normalizeStudentImportHeader),
  );
}

export function buildStudentImportAutomaticMapping(
  columns: StudentImportWorkbookColumn[],
): StudentImportAutomaticMapping {
  const candidateColumnsByField = new Map<
    StudentImportFieldKey,
    string[]
  >();

  const candidateFieldsByColumn = new Map<
    string,
    StudentImportFieldKey[]
  >();

  for (const fieldKey of STUDENT_IMPORT_FIELD_KEYS) {
    const aliases =
      getNormalizedAliases(fieldKey);

    const candidates = columns
      .filter((column) => {
        if (!column.sourceHeader) {
          return false;
        }

        return aliases.has(
          normalizeStudentImportHeader(
            column.sourceHeader,
          ),
        );
      })
      .map((column) => column.columnKey);

    candidateColumnsByField.set(
      fieldKey,
      candidates,
    );

    for (const columnKey of candidates) {
      const current =
        candidateFieldsByColumn.get(
          columnKey,
        ) ?? [];

      current.push(fieldKey);

      candidateFieldsByColumn.set(
        columnKey,
        current,
      );
    }
  }

  const mapping: StudentImportColumnMapping = {};
  const ambiguousFields: StudentImportFieldKey[] = [];
  const assignedColumns = new Set<string>();

  for (const fieldKey of STUDENT_IMPORT_FIELD_KEYS) {
    const candidates =
      candidateColumnsByField.get(
        fieldKey,
      ) ?? [];

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

    const candidateFields =
      candidateFieldsByColumn.get(
        columnKey,
      ) ?? [];

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
      .filter(
        (columnKey) =>
          !assignedColumns.has(columnKey),
      ),
  };
}

export function validateStudentImportColumnMapping(
  columns: StudentImportWorkbookColumn[],
  mapping: StudentImportColumnMapping,
): StudentImportMappingValidation {
  const issues: StudentImportMappingIssue[] = [];

  const knownFields = new Set<string>(
    STUDENT_IMPORT_FIELD_KEYS,
  );

  const knownColumns = new Set(
    columns.map(
      (column) => column.columnKey,
    ),
  );

  const usedColumns = new Map<
    string,
    StudentImportFieldKey
  >();

  for (
    const [rawFieldKey, rawColumnKey]
    of Object.entries(mapping)
  ) {
    if (!knownFields.has(rawFieldKey)) {
      issues.push({
        code: "unknown_target_field",
        message:
          `Trường đích không hợp lệ: ${rawFieldKey}.`,
      });

      continue;
    }

    const fieldKey =
      rawFieldKey as StudentImportFieldKey;

    if (
      rawColumnKey === null ||
      rawColumnKey === undefined ||
      rawColumnKey.trim().length === 0
    ) {
      continue;
    }

    const columnKey =
      rawColumnKey.trim();

    if (!knownColumns.has(columnKey)) {
      issues.push({
        code: "unknown_source_column",
        columnKey,
        fieldKey,
        message:
          `Không tìm thấy cột nguồn ${columnKey}.`,
      });

      continue;
    }

    const existingField =
      usedColumns.get(columnKey);

    if (existingField) {
      issues.push({
        code: "duplicate_source_column",
        columnKey,
        fieldKey,
        message:
          `Cột ${columnKey} đang được dùng cho cả ` +
          `${existingField} và ${fieldKey}.`,
      });

      continue;
    }

    usedColumns.set(
      columnKey,
      fieldKey,
    );
  }

  const missingRequiredFields =
    STUDENT_IMPORT_REQUIRED_FIELD_KEYS
      .filter((fieldKey) => {
        const columnKey =
          mapping[fieldKey];

        return (
          typeof columnKey !== "string" ||
          columnKey.trim().length === 0 ||
          !knownColumns.has(
            columnKey.trim(),
          )
        );
      });

  for (
    const fieldKey
    of missingRequiredFields
  ) {
    issues.push({
      code: "missing_required_field",
      fieldKey,
      message:
        `Chưa ánh xạ trường bắt buộc ${fieldKey}.`,
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
    missingRequiredFields: [
      ...missingRequiredFields,
    ],
  };
}

export function mapStudentImportWorkbookRows(
  workbook: StudentImportParsedWorkbook,
  mapping: StudentImportColumnMapping,
): StudentImportRowInput[] {
  const validation =
    validateStudentImportColumnMapping(
      workbook.columns,
      mapping,
    );

  if (!validation.isValid) {
    throw new StudentImportMappingError(
      validation.issues,
    );
  }

  return workbook.rows.map((sourceRow) => {
    const targetRow: StudentImportRowInput = {
      row_number: sourceRow.rowNumber,
    };

    for (
      const fieldKey
      of STUDENT_IMPORT_FIELD_KEYS
    ) {
      const sourceColumnKey =
        mapping[fieldKey];

      if (
        typeof sourceColumnKey !== "string" ||
        sourceColumnKey.trim().length === 0
      ) {
        continue;
      }

      targetRow[fieldKey] =
        sourceRow.values[
          sourceColumnKey.trim()
        ] ?? null;
    }

    return targetRow;
  });
}
