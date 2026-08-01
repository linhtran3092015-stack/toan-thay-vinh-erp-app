import "server-only";

import writeExcelFile from "write-excel-file/node";

import { STUDENT_IMPORT_FIELD_DEFINITIONS } from "@/features/imports/students/fields";

const REQUIRED_HEADER_BACKGROUND =
  "#D9EAF7";

const OPTIONAL_HEADER_BACKGROUND =
  "#F2F4F7";

export async function buildStudentImportTemplateWorkbook(): Promise<Buffer> {
  const headerRow =
    STUDENT_IMPORT_FIELD_DEFINITIONS.map(
      (definition) => ({
        align: "center" as const,
        alignVertical: "center" as const,
        backgroundColor:
          definition.required
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

  const columns =
    STUDENT_IMPORT_FIELD_DEFINITIONS.map(
      (definition) => ({
        width: definition.width,
      }),
    );

  return writeExcelFile(
    [
      headerRow,
    ],
    {
      columns,
      orientation: "landscape",
      sheet: "Hoc_vien",
      showGridLines: true,
      stickyRowsCount: 1,
      zoomScale: 0.9,
    },
    {
      fontFamily: "Arial",
      fontSize: 11,
    },
  ).toBuffer();
}
