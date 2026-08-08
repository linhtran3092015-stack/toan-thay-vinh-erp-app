import { ENROLLMENT_IMPORT_FIELDS } from "./fields";

export interface EnrollmentFieldMapping {
  [fieldKey: string]: string; // fieldKey -> headerName
}

export function autoMapEnrollmentHeaders(headers: string[]): EnrollmentFieldMapping {
  const mapping: EnrollmentFieldMapping = {};

  for (const field of ENROLLMENT_IMPORT_FIELDS) {
    const matchedHeader = headers.find((h) => {
      const trimmed = h.trim().toLowerCase();
      return field.aliases.some((alias) => alias.toLowerCase() === trimmed);
    });

    if (matchedHeader) {
      mapping[field.key] = matchedHeader;
    }
  }

  return mapping;
}
