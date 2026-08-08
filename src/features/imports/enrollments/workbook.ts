"use client";

import readExcelFile from "read-excel-file/browser";

import type { EnrollmentImportRawRow } from "./types";
import { autoMapEnrollmentHeaders } from "./mapping";

export const ENROLLMENT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ENROLLMENT_IMPORT_MAX_ROWS = 1000;

export type EnrollmentWorkbookErrorCode =
  | "corrupt_workbook"
  | "empty_file"
  | "file_too_large"
  | "missing_columns"
  | "missing_data_rows"
  | "invalid_worksheet"
  | "too_many_rows";

export class EnrollmentWorkbookError extends Error {
  readonly code: EnrollmentWorkbookErrorCode;

  constructor(code: EnrollmentWorkbookErrorCode, message: string) {
    super(message);
    this.name = "EnrollmentWorkbookError";
    this.code = code;
  }
}

export interface ParsedEnrollmentWorkbook {
  sheetName: string;
  totalRows: number;
  headers: string[];
  mapping: Record<string, string>;
  rows: EnrollmentImportRawRow[];
}

export async function parseEnrollmentWorkbook(
  file: File
): Promise<ParsedEnrollmentWorkbook> {
  if (!file || file.size === 0) {
    throw new EnrollmentWorkbookError("empty_file", "File tải lên bị rỗng.");
  }

  if (file.size > ENROLLMENT_IMPORT_MAX_FILE_BYTES) {
    throw new EnrollmentWorkbookError(
      "file_too_large",
      "Kích thước file vượt quá giới hạn 5MB."
    );
  }

  const bytes = await file.arrayBuffer();

  let sheets: { sheet: string; data: unknown[][] }[];
  try {
    sheets = (await readExcelFile(bytes)) as unknown as { sheet: string; data: unknown[][] }[];
  } catch {
    throw new EnrollmentWorkbookError(
      "corrupt_workbook",
      "Không thể đọc file Excel. File có thể bị hỏng hoặc sai định dạng."
    );
  }

  if (!sheets || sheets.length === 0) {
    throw new EnrollmentWorkbookError("empty_file", "File Excel không có trang tính.");
  }

  const targetSheetObj = sheets.find(
    (s) => s && s.sheet && s.sheet.trim().toLowerCase() === "enrollments"
  );
  if (!targetSheetObj) {
    throw new EnrollmentWorkbookError(
      "invalid_worksheet",
      `File phải chứa trang tính "Enrollments". Tìm thấy: ${sheets.map((s) => s.sheet).join(", ")}.`
    );
  }

  const rawRows = targetSheetObj.data || [];
  if (!rawRows || rawRows.length <= 1) {
    throw new EnrollmentWorkbookError(
      "missing_data_rows",
      "File Excel không có dòng dữ liệu nào."
    );
  }

  const dataRowsCount = rawRows.length - 1;
  if (dataRowsCount > ENROLLMENT_IMPORT_MAX_ROWS) {
    throw new EnrollmentWorkbookError(
      "too_many_rows",
      `Số lượng dòng dữ liệu (${dataRowsCount}) vượt quá giới hạn tối đa ${ENROLLMENT_IMPORT_MAX_ROWS} dòng.`
    );
  }

  const rawHeaders = (rawRows[0] || []).map((h) => String(h || "").trim());
  const mapping = autoMapEnrollmentHeaders(rawHeaders);

  const studentCodeHeader = mapping["student_public_code"];
  const classCodeHeader = mapping["class_code"];
  const registeredModeHeader = mapping["registered_mode"];
  const effectiveFromHeader = mapping["effective_from"];

  if (!studentCodeHeader || !classCodeHeader || !registeredModeHeader || !effectiveFromHeader) {
    const missing: string[] = [];
    if (!studentCodeHeader) missing.push("Mã học viên *");
    if (!classCodeHeader) missing.push("Mã lớp *");
    if (!registeredModeHeader) missing.push("Hình thức *");
    if (!effectiveFromHeader) missing.push("Hiệu lực từ *");

    throw new EnrollmentWorkbookError(
      "missing_columns",
      `Thiếu các cột bắt buộc: ${missing.join(", ")}.`
    );
  }

  const studentCodeIdx = rawHeaders.indexOf(studentCodeHeader);
  const classCodeIdx = rawHeaders.indexOf(classCodeHeader);
  const registeredModeIdx = rawHeaders.indexOf(registeredModeHeader);
  const effectiveFromIdx = rawHeaders.indexOf(effectiveFromHeader);

  const parsedRows: EnrollmentImportRawRow[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const sourceRow = i + 1; // 1-indexed row number in Excel

    const rawStudentCode = row[studentCodeIdx];
    const rawClassCode = row[classCodeIdx];
    const rawMode = row[registeredModeIdx];
    const rawEffFrom = row[effectiveFromIdx];

    let effectiveFromStr = "";
    if (rawEffFrom instanceof Date) {
      effectiveFromStr = rawEffFrom.toISOString().slice(0, 10);
    } else if (rawEffFrom !== null && rawEffFrom !== undefined) {
      effectiveFromStr = String(rawEffFrom).trim();
    }

    parsedRows.push({
      source_row: sourceRow,
      student_public_code: String(rawStudentCode || "").trim(),
      class_code: String(rawClassCode || "").trim(),
      registered_mode: String(rawMode || "").trim().toLowerCase(),
      effective_from: effectiveFromStr,
    });
  }

  return {
    sheetName: targetSheetObj.sheet,
    totalRows: parsedRows.length,
    headers: rawHeaders,
    mapping,
    rows: parsedRows,
  };
}
