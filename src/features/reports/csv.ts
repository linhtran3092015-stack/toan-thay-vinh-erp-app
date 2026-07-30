export type CsvCell =
  | boolean
  | number
  | string
  | null
  | undefined;

const formulaPrefixPattern =
  /^[=+\-@\t\r]/;

function toCsvText(value: CsvCell): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

export function protectCsvFormula(
  value: CsvCell,
): string {
  const text = toCsvText(value);

  return formulaPrefixPattern.test(text)
    ? `'${text}`
    : text;
}

export function escapeCsvCell(
  value: CsvCell,
): string {
  const protectedText =
    protectCsvFormula(value);

  if (!/[",\r\n]/.test(protectedText)) {
    return protectedText;
  }

  return `"${protectedText.replaceAll(
    '"',
    '""',
  )}"`;
}

export function createCsvDocument(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  for (const row of rows) {
    if (row.length !== headers.length) {
      throw new Error(
        "CSV row length does not match header length.",
      );
    }
  }

  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) =>
      row.map(escapeCsvCell).join(","),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
