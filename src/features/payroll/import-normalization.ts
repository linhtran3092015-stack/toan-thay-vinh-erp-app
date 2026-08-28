import type { CreatePayrollImportBatchInput } from "@/features/payroll/forms/payroll-action-types";

export type PayrollImportDatasetType = CreatePayrollImportBatchInput["datasetType"];
export type PayrollImportRow = CreatePayrollImportBatchInput["rows"][number];

export const payrollImportTemplateHeaders: Record<PayrollImportDatasetType, readonly string[]> = {
  grading: ["source_key", "event_date", "staff_id", "student_id", "quantity", "evidence_url"],
  new_enrollment_orders: ["source_key", "event_date", "staff_id", "student_id", "grade", "amount_vnd", "source_code", "evidence_url"],
  renewal_orders: ["source_key", "event_date", "student_id", "grade", "amount_vnd", "evidence_url"],
  timekeeping: ["source_key", "event_date", "staff_id", "work_minutes", "work_mode", "evidence_url"],
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePayrollImportRow(
  datasetType: PayrollImportDatasetType,
  headers: readonly string[],
  source: readonly unknown[],
  rowNumber: number,
): PayrollImportRow {
  const rawPayload = Object.fromEntries(headers.map((header, index) => [header, serializeCell(source[index])]));
  const errors: string[] = [];
  const sourceKey = String(rawPayload.source_key ?? "").trim();
  const eventDate = normalizeDate(rawPayload.event_date);
  const staffId = stringOrNull(rawPayload.staff_id);
  const studentId = stringOrNull(rawPayload.student_id);
  const grade = numberOrNull(rawPayload.grade);
  const amountVnd = numberOrNull(rawPayload.amount_vnd);
  const quantity = datasetType === "timekeeping" ? numberOrNull(rawPayload.work_minutes) : numberOrNull(rawPayload.quantity);
  const sourceCode = stringOrNull(rawPayload.source_code);

  if (!sourceKey) errors.push("thiếu source_key");
  if (!eventDate) errors.push("event_date không hợp lệ");
  if ((datasetType === "timekeeping" || datasetType === "grading" || datasetType === "new_enrollment_orders") && (!staffId || !uuidPattern.test(staffId))) errors.push("staff_id không hợp lệ");
  if (studentId && !uuidPattern.test(studentId)) errors.push("student_id không hợp lệ");
  if ((datasetType === "renewal_orders" || datasetType === "new_enrollment_orders") && (grade === null || grade < 2 || grade > 12)) errors.push("grade phải từ 2 đến 12");
  if ((datasetType === "renewal_orders" || datasetType === "new_enrollment_orders") && (amountVnd === null || amountVnd < 0)) errors.push("amount_vnd không hợp lệ");
  if ((datasetType === "grading" || datasetType === "timekeeping") && (quantity === null || quantity <= 0)) errors.push(datasetType === "grading" ? "quantity không hợp lệ" : "work_minutes không hợp lệ");
  if (datasetType === "new_enrollment_orders" && !sourceCode) errors.push("thiếu source_code");

  const workMode = stringOrNull(rawPayload.work_mode);
  if (datasetType === "timekeeping" && workMode !== "offline" && workMode !== "online") errors.push("work_mode phải là offline hoặc online");

  return {
    conflictPayload: null,
    normalizedPayload: {
      amount_vnd: amountVnd,
      event_date: eventDate,
      grade,
      metadata: { evidence_url: stringOrNull(rawPayload.evidence_url), work_minutes: quantity, work_mode: workMode },
      quantity,
      source_code: sourceCode,
      staff_id: staffId,
      student_id: studentId,
    },
    rawPayload,
    rowNumber,
    sourceKey,
    validationErrors: errors,
    validationStatus: errors.length ? "error" : "valid",
  };
}

function serializeCell(value: unknown): string | number | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "string") return value;
  return value === null || value === undefined ? null : String(value);
}

function normalizeDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00`).getTime())) return null;
  return text;
}

function stringOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === "" || value === undefined) return null;
  const parsed = Number(String(value).replaceAll(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
