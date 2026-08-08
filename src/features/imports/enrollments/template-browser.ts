"use client";

import writeExcelFile from "write-excel-file/browser";

export const ENROLLMENT_IMPORT_TEMPLATE_FILENAME = "mau-import-ghi-danh-hoc-vien.xlsx";

const REQUIRED_HEADER_BG = "#D9EAF7";

export async function downloadEnrollmentImportTemplate(): Promise<void> {
  const headerRow = [
    {
      value: "Mã học viên *",
      fontWeight: "bold" as const,
      backgroundColor: REQUIRED_HEADER_BG,
      borderColor: "#AAB2BD",
      borderStyle: "thin" as const,
      align: "center" as const,
      alignVertical: "center" as const,
      height: 30,
      wrap: true,
      type: String,
    },
    {
      value: "Mã lớp *",
      fontWeight: "bold" as const,
      backgroundColor: REQUIRED_HEADER_BG,
      borderColor: "#AAB2BD",
      borderStyle: "thin" as const,
      align: "center" as const,
      alignVertical: "center" as const,
      height: 30,
      wrap: true,
      type: String,
    },
    {
      value: "Hình thức *",
      fontWeight: "bold" as const,
      backgroundColor: REQUIRED_HEADER_BG,
      borderColor: "#AAB2BD",
      borderStyle: "thin" as const,
      align: "center" as const,
      alignVertical: "center" as const,
      height: 30,
      wrap: true,
      type: String,
    },
    {
      value: "Hiệu lực từ *",
      fontWeight: "bold" as const,
      backgroundColor: REQUIRED_HEADER_BG,
      borderColor: "#AAB2BD",
      borderStyle: "thin" as const,
      align: "center" as const,
      alignVertical: "center" as const,
      height: 30,
      wrap: true,
      type: String,
    },
  ];

  const sampleRow1 = [
    { type: String, value: "TV-2026-00012" },
    { type: String, value: "12B1" },
    { type: String, value: "online" },
    { type: String, value: "2026-08-08" },
  ];

  const columns = [
    { width: 22 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
  ];

  const enrollmentsSheet = {
    columns,
    data: [headerRow, sampleRow1],
    sheet: "Enrollments",
  };

  const multiSheetFn = writeExcelFile as unknown as (
    sheets: unknown[],
    globalOptions?: unknown
  ) => { toFile: (filename: string) => Promise<void> };

  await multiSheetFn([enrollmentsSheet], {
    fontFamily: "Arial",
    fontSize: 11,
  }).toFile(ENROLLMENT_IMPORT_TEMPLATE_FILENAME);
}
