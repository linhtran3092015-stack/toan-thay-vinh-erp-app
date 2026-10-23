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

/**
 * Spellings (regex fragments) standing as whole words on NFC upper-case text: a
 * letter or digit on either side means part of another word ("THU" in "LÝ THUYẾT",
 * "SUN" in "BỔ SUNG", "T2" in "T2B"). No lookbehind, so older Safari still parses it.
 */
function wholeWord(spellings: readonly string[]): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${spellings.join("|")})(?=[^\\p{L}\\p{N}]|$)`, "u");
}

/**
 * The spellings each ISO weekday (1 = Thứ Hai … 7 = Chủ nhật) is read from: the Vietnamese
 * ones first, the English names only when no Vietnamese spelling is in the cell (so a
 * teacher named Thu in "Thứ 2 (cô Thu)" is not read as Thursday).
 */
const VIETNAMESE_WEEKDAYS: ReadonlyArray<{ iso: number; pattern: RegExp }> = [
  { iso: 1, pattern: wholeWord(["T2", "THỨ ?2", "THỨ HAI"]) },
  { iso: 2, pattern: wholeWord(["T3", "THỨ ?3", "THỨ BA"]) },
  { iso: 3, pattern: wholeWord(["T4", "THỨ ?4", "THỨ TƯ"]) },
  { iso: 4, pattern: wholeWord(["T5", "THỨ ?5", "THỨ NĂM"]) },
  { iso: 5, pattern: wholeWord(["T6", "THỨ ?6", "THỨ SÁU"]) },
  { iso: 6, pattern: wholeWord(["T7", "THỨ ?7", "THỨ BẢY", "THỨ BẨY"]) },
  { iso: 7, pattern: wholeWord(["CN", "CHỦ NHẬT"]) },
];

const ENGLISH_WEEKDAYS: ReadonlyArray<{ iso: number; pattern: RegExp }> = [
  { iso: 1, pattern: wholeWord(["MON", "MONDAY"]) },
  { iso: 2, pattern: wholeWord(["TUE", "TUES", "TUESDAY"]) },
  { iso: 3, pattern: wholeWord(["WED", "WEDNESDAY"]) },
  { iso: 4, pattern: wholeWord(["THU", "THUR", "THURS", "THURSDAY"]) },
  { iso: 5, pattern: wholeWord(["FRI", "FRIDAY"]) },
  { iso: 6, pattern: wholeWord(["SAT", "SATURDAY"]) },
  { iso: 7, pattern: wholeWord(["SUN", "SUNDAY"]) },
];

/** The one day the spellings name in `text`, null for two or more, undefined for none. */
function namedDay(text: string, spellings: ReadonlyArray<{ iso: number; pattern: RegExp }>): number | null | undefined {
  const days = spellings.filter((day) => day.pattern.test(text));
  if (days.length === 0) return undefined;
  return days.length === 1 ? days[0].iso : null;
}

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
    // Any run of spaces (non-breaking ones pasted from Word, tabs, doubles) counts as one.
    const str = value.normalize("NFC").replace(/\s+/gu, " ").trim().toUpperCase();
    // A number typed as text ("3", "03", "3.0") reads as that number would.
    if (/^\+?\d+(\.\d+)?$/.test(str)) return parseWeekdayValue(Number(str));

    const vietnamese = namedDay(str, VIETNAMESE_WEEKDAYS);
    if (vietnamese !== undefined) return vietnamese;
    return namedDay(str, ENGLISH_WEEKDAYS) ?? null;
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
