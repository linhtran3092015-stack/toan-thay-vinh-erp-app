"use client";

import readExcelFile from "read-excel-file/browser";

import type {
  StudentImportCellValue,
  StudentImportParsedWorkbook,
  StudentImportWorkbookColumn,
  StudentImportWorkbookRow,
} from "@/features/imports/students/types";

export const STUDENT_IMPORT_MAX_FILE_BYTES =
  5 * 1024 * 1024;

export const STUDENT_IMPORT_MAX_ROWS = 500;

export const STUDENT_IMPORT_TEMPLATE_FILENAME =
  "mau-import-hoc-vien.xlsx";

export type StudentImportWorkbookErrorCode =
  | "corrupt_workbook"
  | "empty_file"
  | "filename_too_long"
  | "file_too_large"
  | "invalid_extension"
  | "missing_columns"
  | "missing_data_rows"
  | "multiple_worksheets"
  | "too_many_rows";

export class StudentImportWorkbookError extends Error {
  readonly code: StudentImportWorkbookErrorCode;

  constructor(
    code: StudentImportWorkbookErrorCode,
    message: string,
  ) {
    super(message);

    this.name = "StudentImportWorkbookError";
    this.code = code;
  }
}

function getExcelColumnKey(
  columnIndex: number,
): string {
  let remaining = columnIndex;
  let result = "";

  while (remaining > 0) {
    const remainder =
      (remaining - 1) % 26;

    result =
      String.fromCharCode(
        65 + remainder,
      ) + result;

    remaining = Math.floor(
      (remaining - 1) / 26,
    );
  }

  return result;
}

function normalizeDate(
  value: Date,
): string | null {
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value
    .toISOString()
    .slice(0, 10);
}

function normalizeCellValue(
  value: unknown,
): StudentImportCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    return normalized.length > 0
      ? normalized
      : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (typeof value === "boolean") {
    return value
      ? "TRUE"
      : "FALSE";
  }

  if (value instanceof Date) {
    return normalizeDate(value);
  }

  return null;
}

function normalizeHeader(
  value: unknown,
): string | null {
  const normalized =
    normalizeCellValue(value);

  if (normalized === null) {
    return null;
  }

  const header =
    String(normalized).trim();

  return header.length > 0
    ? header
    : null;
}

async function createSha256(
  bytes: ArrayBuffer,
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new StudentImportWorkbookError(
      "corrupt_workbook",
      "Trình duyệt hiện tại không hỗ trợ xác minh SHA-256.",
    );
  }

  const digest =
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      bytes,
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map((value) =>
      value
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

export async function parseStudentImportWorkbook(
  file: File,
): Promise<StudentImportParsedWorkbook> {
  const sourceFilename =
    file.name.trim();

  if (sourceFilename.length === 0) {
    throw new StudentImportWorkbookError(
      "invalid_extension",
      "File import không có tên hợp lệ.",
    );
  }

  if (sourceFilename.length > 255) {
    throw new StudentImportWorkbookError(
      "filename_too_long",
      "Tên file import không được vượt quá 255 ký tự.",
    );
  }

  if (!/\.xlsx$/i.test(sourceFilename)) {
    throw new StudentImportWorkbookError(
      "invalid_extension",
      "Import học viên v1 chỉ nhận file .xlsx.",
    );
  }

  if (file.size === 0) {
    throw new StudentImportWorkbookError(
      "empty_file",
      "File import đang trống.",
    );
  }

  if (
    file.size >
    STUDENT_IMPORT_MAX_FILE_BYTES
  ) {
    throw new StudentImportWorkbookError(
      "file_too_large",
      "File import không được vượt quá 5 MB.",
    );
  }

  const bytes = await file.arrayBuffer();

  let sheets: Awaited<
    ReturnType<typeof readExcelFile>
  >;

  try {
    sheets = await readExcelFile(bytes);
  } catch {
    throw new StudentImportWorkbookError(
      "corrupt_workbook",
      "Không thể đọc file Excel. File có thể bị lỗi hoặc không đúng định dạng .xlsx.",
    );
  }

  if (sheets.length !== 1) {
    throw new StudentImportWorkbookError(
      "multiple_worksheets",
      "File import phải có đúng một worksheet.",
    );
  }

  const worksheet = sheets[0];

  if (
    !worksheet ||
    !Array.isArray(worksheet.data) ||
    worksheet.data.length === 0
  ) {
    throw new StudentImportWorkbookError(
      "missing_columns",
      "Worksheet không có dòng tiêu đề.",
    );
  }

  const columnCount =
    worksheet.data.reduce(
      (maximum, row) =>
        Math.max(
          maximum,
          Array.isArray(row)
            ? row.length
            : 0,
        ),
      0,
    );

  if (columnCount === 0) {
    throw new StudentImportWorkbookError(
      "missing_columns",
      "Worksheet không có cột dữ liệu.",
    );
  }

  const headerRow =
    worksheet.data[0] ?? [];

  const columns: StudentImportWorkbookColumn[] =
    Array.from(
      {
        length: columnCount,
      },
      (_, zeroBasedIndex) => {
        const columnIndex =
          zeroBasedIndex + 1;

        return {
          columnIndex,
          columnKey:
            getExcelColumnKey(
              columnIndex,
            ),
          sourceHeader:
            normalizeHeader(
              headerRow[
                zeroBasedIndex
              ],
            ),
        };
      },
    );

  if (
    columns.every(
      (column) =>
        column.sourceHeader === null,
    )
  ) {
    throw new StudentImportWorkbookError(
      "missing_columns",
      "Dòng đầu tiên phải chứa tiêu đề cột.",
    );
  }

  const rows: StudentImportWorkbookRow[] = [];

  for (
    let dataIndex = 1;
    dataIndex < worksheet.data.length;
    dataIndex += 1
  ) {
    const sourceRow =
      worksheet.data[dataIndex] ?? [];

    const values: Record<
      string,
      StudentImportCellValue
    > = {};

    let hasValue = false;

    for (const column of columns) {
      const value = normalizeCellValue(
        sourceRow[
          column.columnIndex - 1
        ],
      );

      values[column.columnKey] = value;

      if (value !== null) {
        hasValue = true;
      }
    }

    if (!hasValue) {
      continue;
    }

    rows.push({
      rowNumber: dataIndex + 1,
      values,
    });

    if (
      rows.length >
      STUDENT_IMPORT_MAX_ROWS
    ) {
      throw new StudentImportWorkbookError(
        "too_many_rows",
        "Mỗi lần chỉ được import tối đa 500 dòng dữ liệu.",
      );
    }
  }

  if (rows.length === 0) {
    throw new StudentImportWorkbookError(
      "missing_data_rows",
      "File import không có dòng dữ liệu học viên.",
    );
  }

  const sourceSha256 =
    await createSha256(bytes);

  return {
    columns,
    rowCount: rows.length,
    rows,
    sheetName: worksheet.sheet,
    sourceFilename,
    sourceSha256,
  };
}
