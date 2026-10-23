"use client";

import readExcelFile from "read-excel-file/browser";

import type {
  ClassScheduleImportCellValue,
  ClassScheduleImportParsedSheet,
  ClassScheduleImportParsedWorkbook,
  ClassScheduleImportWorkbookColumn,
  ClassScheduleImportWorkbookRow,
} from "./types";

export const CLASS_SCHEDULE_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CLASS_IMPORT_MAX_ROWS = 500;
export const SCHEDULE_IMPORT_MAX_ROWS = 2000;

export type ClassScheduleWorkbookErrorCode =
  | "corrupt_workbook"
  | "empty_file"
  | "file_too_large"
  | "invalid_extension"
  | "missing_classes_sheet"
  | "missing_schedules_sheet"
  | "missing_data_rows"
  | "too_many_class_rows"
  | "too_many_schedule_rows";

export class ClassScheduleWorkbookError extends Error {
  readonly code: ClassScheduleWorkbookErrorCode;

  constructor(code: ClassScheduleWorkbookErrorCode, message: string) {
    super(message);
    this.name = "ClassScheduleWorkbookError";
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

/** A short code ("T2", "CN") standing on its own in the cell, not inside a longer word. */
function hasCode(text: string, code: string): boolean {
  return new RegExp(`(^|[^A-Z0-9])${code}([^A-Z0-9]|$)`).test(text);
}

/** The spellings each ISO weekday (1 = Thứ Hai … 7 = Chủ nhật) is read from, on NFC upper-case text. */
const WEEKDAY_SPELLINGS: ReadonlyArray<{ iso: number; matches: (text: string) => boolean }> = [
  { iso: 1, matches: (text) => hasCode(text, "T2") || text.includes("THỨ 2") || text.includes("THỨ HAI") || text.includes("MON") },
  { iso: 2, matches: (text) => hasCode(text, "T3") || text.includes("THỨ 3") || text.includes("THỨ BA") || text.includes("TUE") },
  { iso: 3, matches: (text) => hasCode(text, "T4") || text.includes("THỨ 4") || text.includes("THỨ TƯ") || text.includes("WED") },
  { iso: 4, matches: (text) => hasCode(text, "T5") || text.includes("THỨ 5") || text.includes("THỨ NĂM") || text.includes("THU") },
  { iso: 5, matches: (text) => hasCode(text, "T6") || text.includes("THỨ 6") || text.includes("THỨ SÁU") || text.includes("FRI") },
  { iso: 6, matches: (text) => hasCode(text, "T7") || text.includes("THỨ 7") || text.includes("THỨ BẢY") || text.includes("SAT") },
  { iso: 7, matches: (text) => hasCode(text, "CN") || text.includes("CHỦ NHẬT") || text.includes("SUN") },
];

/**
 * The ISO weekday of a "Thứ" cell, or null when the cell does not name exactly
 * one day: a fraction, a number outside 1–7, an unknown spelling, or a cell
 * naming two days ("Thứ 2, Thứ 4") is never rounded or guessed onto a day.
 */
export function parseWeekdayValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= 7 ? value : null;
  }

  if (typeof value === "string") {
    // NFC first: decomposed Vietnamese ("ư" typed as "u" + combining marks) would otherwise read "THỨ" as English "THU".
    const str = value.normalize("NFC").trim().toUpperCase();
    if (/^[1-7]$/.test(str)) return parseInt(str, 10);

    const days = new Set(WEEKDAY_SPELLINGS.filter((day) => day.matches(str)).map((day) => day.iso));
    return days.size === 1 ? [...days][0] : null;
  }

  return null;
}

export function parseTimeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const str = value.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      const parts = str.split(":");
      const hh = parts[0].padStart(2, "0");
      const mm = parts[1].padStart(2, "0");
      const ss = parts[2] ? parts[2].padStart(2, "0") : "00";
      return `${hh}:${mm}:${ss}`;
    }
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    const hh = value.getHours().toString().padStart(2, "0");
    const mm = value.getMinutes().toString().padStart(2, "0");
    const ss = value.getSeconds().toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  if (typeof value === "number" && value >= 0 && value < 1) {
    const totalSeconds = Math.round(value * 86400);
    const hh = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
    const mm = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
    const ss = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  return null;
}

export function parseDateValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const str = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      const yyyy = dateObj.getFullYear();
      const mm = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const dd = dateObj.getDate().toString().padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = (value.getMonth() + 1).toString().padStart(2, "0");
    const dd = value.getDate().toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function normalizeCellValue(value: unknown): ClassScheduleImportCellValue {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return parseDateValue(value);
  }

  return String(value);
}

export async function calculateFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseSheetRows(
  rawRows: unknown[][],
  sheetName: string
): ClassScheduleImportParsedSheet {
  if (!rawRows || rawRows.length === 0) {
    return {
      columns: [],
      rowCount: 0,
      rows: [],
      sheetName,
    };
  }

  const headerRow = rawRows[0] || [];
  const columns: ClassScheduleImportWorkbookColumn[] = headerRow.map((headerCell, index) => {
    const columnIndex = index + 1;
    const rawText = typeof headerCell === "string" ? headerCell.trim() : headerCell ? String(headerCell).trim() : null;
    return {
      columnIndex,
      columnKey: getExcelColumnKey(columnIndex),
      sourceHeader: rawText && rawText.length > 0 ? rawText : null,
    };
  });

  const rows: ClassScheduleImportWorkbookRow[] = [];

  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const rawRow = rawRows[rowIndex];
    if (!rawRow || rawRow.length === 0) continue;

    const values: Record<string, ClassScheduleImportCellValue> = {};
    let hasNonEmptyCell = false;

    columns.forEach((col, colIdx) => {
      const cellVal = normalizeCellValue(rawRow[colIdx]);
      values[col.columnKey] = cellVal;
      if (cellVal !== null) {
        hasNonEmptyCell = true;
      }
    });

    if (hasNonEmptyCell) {
      rows.push({
        rowNumber: rowIndex + 1,
        values,
      });
    }
  }

  return {
    columns,
    rowCount: rows.length,
    rows,
    sheetName,
  };
}

export async function parseClassScheduleImportWorkbook(
  file: File
): Promise<ClassScheduleImportParsedWorkbook> {
  if (!file) {
    throw new ClassScheduleWorkbookError("empty_file", "File tải lên không được để trống.");
  }

  if (file.size > CLASS_SCHEDULE_IMPORT_MAX_FILE_BYTES) {
    throw new ClassScheduleWorkbookError(
      "file_too_large",
      "Kích thước file vượt quá giới hạn tối đa 5 MB."
    );
  }

  const lowerFilename = file.name.toLowerCase();
  if (!lowerFilename.endsWith(".xlsx") && !lowerFilename.endsWith(".xls")) {
    throw new ClassScheduleWorkbookError(
      "invalid_extension",
      "Chỉ hỗ trợ file định dạng Excel (.xlsx hoặc .xls)."
    );
  }

  const bytes = await file.arrayBuffer();

  let sheets: { sheet: string; data: unknown[][] }[];
  try {
    sheets = (await readExcelFile(bytes)) as unknown as { sheet: string; data: unknown[][] }[];
  } catch (err) {
    throw new ClassScheduleWorkbookError(
      "corrupt_workbook",
      `Không thể đọc cấu trúc file Excel: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const classesSheetObj = sheets.find(
    (s) => s && s.sheet && s.sheet.trim().toLowerCase() === "classes"
  );
  const schedulesSheetObj = sheets.find(
    (s) => s && s.sheet && s.sheet.trim().toLowerCase() === "schedules"
  );

  if (!classesSheetObj) {
    throw new ClassScheduleWorkbookError(
      "missing_classes_sheet",
      'File Excel thiếu sheet "Classes". File mẫu yêu cầu đúng 2 worksheet: "Classes" và "Schedules".'
    );
  }

  if (!schedulesSheetObj) {
    throw new ClassScheduleWorkbookError(
      "missing_schedules_sheet",
      'File Excel thiếu sheet "Schedules". File mẫu yêu cầu đúng 2 worksheet: "Classes" và "Schedules".'
    );
  }

  const sha256 = await calculateFileSha256(file);
  const classesSheet = parseSheetRows(classesSheetObj.data || [], classesSheetObj.sheet);
  const schedulesSheet = parseSheetRows(schedulesSheetObj.data || [], schedulesSheetObj.sheet);

  if (classesSheet.rowCount === 0) {
    throw new ClassScheduleWorkbookError(
      "missing_data_rows",
      'Sheet "Classes" không có dữ liệu lớp học nào.'
    );
  }

  if (classesSheet.rowCount > CLASS_IMPORT_MAX_ROWS) {
    throw new ClassScheduleWorkbookError(
      "too_many_class_rows",
      `Sheet "Classes" chứa ${classesSheet.rowCount} dòng, vượt quá số lượng tối đa ${CLASS_IMPORT_MAX_ROWS} dòng.`
    );
  }

  if (schedulesSheet.rowCount > SCHEDULE_IMPORT_MAX_ROWS) {
    throw new ClassScheduleWorkbookError(
      "too_many_schedule_rows",
      `Sheet "Schedules" chứa ${schedulesSheet.rowCount} dòng, vượt quá số lượng tối đa ${SCHEDULE_IMPORT_MAX_ROWS} dòng.`
    );
  }

  return {
    classesSheet,
    schedulesSheet,
    sourceFilename: file.name,
    sourceSha256: sha256,
  };
}
