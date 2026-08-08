"use client";

import writeExcelFile from "write-excel-file/browser";

import { SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS } from "@/features/imports/session-balances/fields";
import { SESSION_BALANCE_IMPORT_TEMPLATE_FILENAME } from "@/features/imports/session-balances/workbook";

const REQUIRED_HEADER_BACKGROUND = "#D9EAF7";
const OPTIONAL_HEADER_BACKGROUND = "#F2F4F7";

export async function downloadSessionBalanceImportTemplate(): Promise<void> {
  const headerRow = SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.map(
    (definition) => ({
      align: "center" as const,
      alignVertical: "center" as const,
      backgroundColor: definition.required
        ? REQUIRED_HEADER_BACKGROUND
        : OPTIONAL_HEADER_BACKGROUND,
      borderColor: "#AAB2BD",
      borderStyle: "thin" as const,
      fontWeight: "bold" as const,
      height: 34,
      type: String,
      value: definition.templateHeader,
      wrap: true,
    }),
  );

  const sampleRows = [
    [
      { type: String, value: "TV-2026-00012" },
      { type: String, value: "Nguyễn Ngọc Hà Anh" },
      { type: Number, value: 10 },
    ],
    [
      { type: String, value: "TV-2026-00013" },
      { type: String, value: "Nguyễn Ngọc Long" },
      { type: Number, value: -2 },
    ],
    [
      { type: String, value: "TV-2026-00014" },
      { type: String, value: "Nguyễn Bảo Anh" },
      { type: Number, value: 7.5 },
    ],
  ];

  const columns = SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.map(
    (definition) => ({
      width: definition.width,
    }),
  );

  await writeExcelFile(
    [headerRow, ...sampleRows],
    {
      columns,
      orientation: "landscape",
      sheet: "So_du_buoi",
      showGridLines: true,
      stickyRowsCount: 1,
      zoomScale: 0.9,
    },
    {
      fontFamily: "Arial",
      fontSize: 11,
    },
  ).toFile(SESSION_BALANCE_IMPORT_TEMPLATE_FILENAME);
}
