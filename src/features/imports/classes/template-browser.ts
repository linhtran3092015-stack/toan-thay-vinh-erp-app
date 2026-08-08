"use client";

import writeExcelFile from "write-excel-file/browser";

import {
  CLASS_IMPORT_FIELDS,
  SCHEDULE_IMPORT_FIELDS,
} from "./fields";

export const CLASS_SCHEDULE_IMPORT_TEMPLATE_FILENAME = "mau-import-lop-lich-hoc.xlsx";

const REQUIRED_HEADER_BG = "#D9EAF7";
const OPTIONAL_HEADER_BG = "#F2F4F7";

export async function downloadClassScheduleImportTemplate(): Promise<void> {
  // Sheet 1: Classes headers & sample rows
  const classesHeaderRow = CLASS_IMPORT_FIELDS.map((field) => ({
    align: "center" as const,
    alignVertical: "center" as const,
    backgroundColor: field.required ? REQUIRED_HEADER_BG : OPTIONAL_HEADER_BG,
    borderColor: "#AAB2BD",
    borderStyle: "thin" as const,
    fontWeight: "bold" as const,
    height: 30,
    type: String,
    value: field.templateHeader,
    wrap: true,
  }));

  const classesSampleRow1 = [
    { type: String, value: "2026-2027" },
    { type: String, value: "3A1" },
    { type: String, value: "Lớp 3A1" },
    { type: Number, value: 3 },
    { type: String, value: "A" },
    { type: Number, value: 2 },
    { type: String, value: "hybrid" },
    { type: String, value: "active" },
  ];

  const classesSampleRow2 = [
    { type: String, value: "2026-2027" },
    { type: String, value: "9B1" },
    { type: String, value: "Lớp 9B1" },
    { type: Number, value: 9 },
    { type: String, value: "B" },
    { type: Number, value: 2 },
    { type: String, value: "hybrid" },
    { type: String, value: "active" },
  ];

  const classesColumns = CLASS_IMPORT_FIELDS.map((field) => ({
    width: field.width,
  }));

  // Sheet 2: Schedules headers & sample rows
  const schedulesHeaderRow = SCHEDULE_IMPORT_FIELDS.map((field) => ({
    align: "center" as const,
    alignVertical: "center" as const,
    backgroundColor: field.required ? REQUIRED_HEADER_BG : OPTIONAL_HEADER_BG,
    borderColor: "#AAB2BD",
    borderStyle: "thin" as const,
    fontWeight: "bold" as const,
    height: 30,
    type: String,
    value: field.templateHeader,
    wrap: true,
  }));

  const schedulesSampleRow1 = [
    { type: String, value: "3A1" },
    { type: String, value: "MAIN1" },
    { type: Number, value: 3 },
    { type: String, value: "18:50" },
    { type: String, value: "20:20" },
    { type: String, value: "hybrid" },
    { type: String, value: "R4 Royal City" },
    { type: String, value: "" },
    { type: String, value: "2026-08-08" },
    { type: String, value: "" },
  ];

  const schedulesSampleRow2 = [
    { type: String, value: "3A1" },
    { type: String, value: "MAIN2" },
    { type: Number, value: 6 },
    { type: String, value: "13:00" },
    { type: String, value: "14:30" },
    { type: String, value: "hybrid" },
    { type: String, value: "R4 Royal City" },
    { type: String, value: "" },
    { type: String, value: "2026-08-08" },
    { type: String, value: "" },
  ];

  const schedulesColumns = SCHEDULE_IMPORT_FIELDS.map((field) => ({
    width: field.width,
  }));

  const classesSheet = {
    columns: classesColumns,
    data: [classesHeaderRow, classesSampleRow1, classesSampleRow2],
    sheet: "Classes",
  };

  const schedulesSheet = {
    columns: schedulesColumns,
    data: [schedulesHeaderRow, schedulesSampleRow1, schedulesSampleRow2],
    sheet: "Schedules",
  };

  const multiSheetFn = writeExcelFile as unknown as (
    sheets: unknown[],
    globalOptions?: unknown
  ) => { toFile: (filename: string) => Promise<void> };

  await multiSheetFn([classesSheet, schedulesSheet], {
    fontFamily: "Arial",
    fontSize: 11,
  }).toFile(CLASS_SCHEDULE_IMPORT_TEMPLATE_FILENAME);
}
