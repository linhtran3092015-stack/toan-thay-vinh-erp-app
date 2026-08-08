"use client";

import readExcelFile from "read-excel-file/browser";

import type {
  SessionBalanceImportCellValue,
  SessionBalanceImportParsedWorkbook,
  SessionBalanceImportWorkbookColumn,
  SessionBalanceImportWorkbookRow,
} from "@/features/imports/session-balances/types";

export const SESSION_BALANCE_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const SESSION_BALANCE_IMPORT_MAX_ROWS = 5000;
export const SESSION_BALANCE_IMPORT_TEMPLATE_FILENAME =
  "mau-import-so-du-buoi.xlsx";

export type SessionBalanceImportWorkbookErrorCode =
  | "corrupt_workbook"
  | "empty_file"
  | "filename_too_long"
  | "file_too_large"
  | "invalid_extension"
  | "missing_columns"
  | "missing_data_rows"
  | "multiple_worksheets"
  | "too_many_rows";

export class SessionBalanceImportWorkbookError extends Error {
  readonly code: SessionBalanceImportWorkbookErrorCode;

  constructor(
    code: SessionBalanceImportWorkbookErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionBalanceImportWorkbookError";
    this.code = code;
  }
}

function getExcelColumnKey(columnIndex: number): string {
  let remaining = columnIndex;
  let result = "";

  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return result;
}

function normalizeCellValue(value: unknown): SessionBalanceImportCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number") {
    // Preserve numbers exactly (e.g. 7.5 stays 7.5; NEVER round/truncate)
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeHeader(value: unknown): string | null {
  const normalized = normalizeCellValue(value);
  if (normalized === null) {
    return null;
  }
  const header = String(normalized).trim();
  return header.length > 0 ? header : null;
}

async function createSha256(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new SessionBalanceImportWorkbookError(
      "corrupt_workbook",
      "Trình duyệt hiện tại không hỗ trợ xác minh SHA-256.",
    );
  }

  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function parseSessionBalanceImportWorkbook(
  file: File,
): Promise<SessionBalanceImportParsedWorkbook> {
  const sourceFilename = file.name.trim();

  if (sourceFilename.length === 0) {
    throw new SessionBalanceImportWorkbookError(
      "invalid_extension",
      "File import không có tên hợp lệ.",
    );
  }

  if (sourceFilename.length > 255) {
    throw new SessionBalanceImportWorkbookError(
      "filename_too_long",
      "Tên file import không được vượt quá 255 ký tự.",
    );
  }

  if (!/\.xlsx$/i.test(sourceFilename)) {
    throw new SessionBalanceImportWorkbookError(
      "invalid_extension",
      "Import số dư buổi chỉ nhận file .xlsx.",
    );
  }

  if (file.size === 0) {
    throw new SessionBalanceImportWorkbookError(
      "empty_file",
      "File import đang trống.",
    );
  }

  if (file.size > SESSION_BALANCE_IMPORT_MAX_FILE_BYTES) {
    throw new SessionBalanceImportWorkbookError(
      "file_too_large",
      "File import không được vượt quá 5 MB.",
    );
  }

  const bytes = await file.arrayBuffer();

  let sheets: Awaited<ReturnType<typeof readExcelFile>>;

  try {
    sheets = await readExcelFile(bytes);
  } catch {
    throw new SessionBalanceImportWorkbookError(
      "corrupt_workbook",
      "Không thể đọc file Excel. File có thể bị lỗi hoặc không đúng định dạng .xlsx.",
    );
  }

  if (sheets.length !== 1) {
    throw new SessionBalanceImportWorkbookError(
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
    throw new SessionBalanceImportWorkbookError(
      "missing_columns",
      "Worksheet không có dòng tiêu đề.",
    );
  }

  const columnCount = worksheet.data.reduce(
    (maximum, row) =>
      Math.max(maximum, Array.isArray(row) ? row.length : 0),
    0,
  );

  if (columnCount === 0) {
    throw new SessionBalanceImportWorkbookError(
      "missing_columns",
      "Worksheet không có cột dữ liệu.",
    );
  }

  const headerRow = worksheet.data[0] ?? [];

  const columns: SessionBalanceImportWorkbookColumn[] = Array.from(
    { length: columnCount },
    (_, zeroBasedIndex) => {
      const columnIndex = zeroBasedIndex + 1;
      return {
        columnIndex,
        columnKey: getExcelColumnKey(columnIndex),
        sourceHeader: normalizeHeader(headerRow[zeroBasedIndex]),
      };
    },
  );

  if (columns.every((column) => column.sourceHeader === null)) {
    throw new SessionBalanceImportWorkbookError(
      "missing_columns",
      "Dòng đầu tiên phải chứa tiêu đề cột.",
    );
  }

  const rows: SessionBalanceImportWorkbookRow[] = [];

  for (
    let dataIndex = 1;
    dataIndex < worksheet.data.length;
    dataIndex += 1
  ) {
    const sourceRow = worksheet.data[dataIndex] ?? [];
    const values: Record<string, SessionBalanceImportCellValue> = {};
    let hasValue = false;

    for (const column of columns) {
      const value = normalizeCellValue(sourceRow[column.columnIndex - 1]);
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

    if (rows.length > SESSION_BALANCE_IMPORT_MAX_ROWS) {
      throw new SessionBalanceImportWorkbookError(
        "too_many_rows",
        "Mỗi lần chỉ được import tối đa 5.000 dòng dữ liệu.",
      );
    }
  }

  if (rows.length === 0) {
    throw new SessionBalanceImportWorkbookError(
      "missing_data_rows",
      "File import không có dòng dữ liệu số dư buổi.",
    );
  }

  const sourceSha256 = await createSha256(bytes);

  return {
    columns,
    rowCount: rows.length,
    rows,
    sheetName: worksheet.sheet ?? "So_du_buoi",
    sourceFilename,
    sourceSha256,
  };
}
