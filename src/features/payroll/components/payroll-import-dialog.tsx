"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import readXlsxFile from "read-excel-file/browser";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createPayrollImportBatchAction } from "@/features/payroll/actions/payroll-actions";
import type { CreatePayrollImportBatchInput, PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

type DatasetType = CreatePayrollImportBatchInput["datasetType"];
type ImportRow = CreatePayrollImportBatchInput["rows"][number];

const datasetLabels: Record<DatasetType, string> = {
  grading: "Phiếu chấm bài",
  new_enrollment_orders: "Đơn tuyển sinh mới",
  renewal_orders: "Đơn tái phí",
  timekeeping: "Bảng công",
};

const templateHeaders: Record<DatasetType, readonly string[]> = {
  grading: ["source_key", "event_date", "staff_id", "student_id", "quantity", "evidence_url"],
  new_enrollment_orders: ["source_key", "event_date", "staff_id", "student_id", "grade", "amount_vnd", "source_code", "evidence_url"],
  renewal_orders: ["source_key", "event_date", "student_id", "grade", "amount_vnd", "evidence_url"],
  timekeeping: ["source_key", "event_date", "staff_id", "work_minutes", "work_mode", "evidence_url"],
};

const inputClassName = "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PayrollImportDialog() {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [datasetType, setDatasetType] = useState<DatasetType>("timekeeping");
  const [periodMonth, setPeriodMonth] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [state, setState] = useState<PayrollActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorRows = rows.filter((row) => row.validationStatus === "error").length;

  const parseFile = async (nextFile: File | null) => {
    setFile(nextFile);
    setRows([]);
    setParseError(null);
    if (!nextFile) return;
    try {
      const bytes = await nextFile.arrayBuffer();
      const sheets = await readXlsxFile(bytes, { trim: false });
      const sheet = Array.isArray(sheets[0]?.data)
        ? sheets[0].data
        : Array.isArray(sheets)
        ? (sheets as unknown as unknown[][])
        : [];
      const expected = templateHeaders[datasetType];
      const actual = (sheet[0] ?? []).map((cell) => String(cell ?? "").trim().toLowerCase());
      if (expected.some((header, index) => actual[index] !== header.toLowerCase())) {
        setParseError(`Sai cấu trúc cột. Hãy tải đúng tệp mẫu ${datasetLabels[datasetType]}.`);
        return;
      }
      setRows(
        sheet
          .slice(1)
          .filter((source) =>
            source.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""),
          )
          .map((source, index) =>
            normalizeRow(datasetType, expected, source, index + 2),
          ),
      );
    } catch (err) {
      const detail = err instanceof Error ? `: ${err.message}` : "";
      setParseError(`Không thể đọc tệp Excel. Hãy dùng tệp .xlsx theo mẫu.${detail}`);
    }
  };

  const submit = () => startTransition(async () => {
    if (!file || !periodMonth || !rows.length || errorRows) return;
    const fileSha256 = await sha256(file);
    const result = await createPayrollImportBatchAction({ datasetType, fileName: file.name, fileSha256, periodMonth: `${periodMonth}-01`, rows });
    setState(result);
    if (result.status === "success") { setIsOpen(false); router.refresh(); }
  });

  return <>
    <Button onClick={() => setIsOpen(true)} ref={triggerRef} type="button" variant="secondary">Nhập Excel</Button>
    <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-3xl" initialFocusRef={fileRef} isOpen={isOpen} onClose={() => { if (!isPending) setIsOpen(false); }} returnFocusRef={triggerRef}>
      <div className="grid max-h-[88vh] gap-4 overflow-y-auto p-4 sm:p-5">
        <div><h2 className="text-section-title text-text-strong" id={titleId}>Nhập dữ liệu dự phòng từ Excel</h2><p className="mt-1 text-secondary text-text-muted" id={descriptionId}>Hệ thống kiểm tra cấu trúc và từng dòng trước khi chuyển cho người khác duyệt; dữ liệu không tự ghi đè nguồn hệ thống.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-label"><span>Loại dữ liệu</span><select className={inputClassName} disabled={isPending} onChange={(event) => { const value = event.target.value as DatasetType; setDatasetType(value); setFile(null); setRows([]); }} value={datasetType}>{Object.entries(datasetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1.5 text-label"><span>Kỳ lương</span><input className={inputClassName} disabled={isPending} onChange={(event) => setPeriodMonth(event.target.value)} type="month" value={periodMonth} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-2"><Button onClick={() => downloadTemplate(datasetType)} type="button" variant="ghost">Tải tệp mẫu</Button><span className="text-caption text-text-muted">Tối đa 5.000 dòng · chỉ nhận .xlsx</span></div>
        <label className="grid gap-1.5 text-label"><span>Tệp Excel</span><input accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={isPending} onChange={(event) => void parseFile(event.target.files?.[0] ?? null)} ref={fileRef} type="file" /></label>
        {parseError ? <ResultBanner description={parseError} title="Không thể đọc tệp" tone="error" /> : null}
        {rows.length ? <div className="rounded-lg border border-border-subtle bg-surface-raised p-3"><p className="font-semibold text-text-strong">Xem trước: {rows.length} dòng</p><p className="mt-1 text-secondary text-text-muted">{rows.length - errorRows} hợp lệ · {errorRows} lỗi</p>{errorRows ? <ul className="mt-2 grid gap-1 text-caption text-danger">{rows.filter((row) => row.validationStatus === "error").slice(0, 8).map((row) => <li key={row.rowNumber}>Dòng {row.rowNumber}: {row.validationErrors.join("; ")}</li>)}</ul> : null}</div> : null}
        {state?.status === "error" ? <ResultBanner description={state.message} title="Không thể tải dữ liệu" tone="error" /> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={isPending} onClick={() => setIsOpen(false)} type="button" variant="ghost">Hủy</Button><Button disabled={isPending || !file || !periodMonth || !rows.length || errorRows > 0} isLoading={isPending} onClick={submit} type="button">Tải lên chờ duyệt</Button></div>
      </div>
    </Dialog>
  </>;
}

function normalizeRow(datasetType: DatasetType, headers: readonly string[], source: readonly unknown[], rowNumber: number): ImportRow {
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
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return value === null || value === undefined ? null : String(value).trim() || null;
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const d = new Date(`${text}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : text;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === "" || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replaceAll(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
async function sha256(file: File): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function downloadTemplate(datasetType: DatasetType): Promise<void> {
  const writeExcelFile = (await import("write-excel-file/browser")).default;
  const headers = templateHeaders[datasetType];
  const headerRow = headers.map((header) => ({
    align: "center" as const,
    alignVertical: "center" as const,
    backgroundColor: "#D9EAF7",
    borderColor: "#AAB2BD",
    borderStyle: "thin" as const,
    fontWeight: "bold" as const,
    height: 30,
    type: String,
    value: header,
    wrap: true,
  }));
  const sampleRow = headers.map((header) => {
    const val = exampleValue(header);
    return typeof val === "number"
      ? { type: Number, value: val }
      : { type: String, value: String(val) };
  });

  const columns = headers.map(() => ({ width: 22 }));

  await writeExcelFile(
    [headerRow, sampleRow],
    {
      columns,
      sheet: datasetType,
      stickyRowsCount: 1,
    },
    {
      fontFamily: "Arial",
      fontSize: 11,
    },
  ).toFile(`mau-${datasetType}.xlsx`);
}
function exampleValue(header: string): string | number { const values: Record<string, string | number> = { amount_vnd: 2000000, event_date: "2026-07-15", evidence_url: "https://example.com/bang-chung", grade: 10, quantity: 1, source_code: "school_telesale", source_key: "DU-LIEU-001", staff_id: "00000000-0000-4000-8000-000000000001", student_id: "00000000-0000-4000-8000-000000000002", work_minutes: 540, work_mode: "offline" }; return values[header] ?? ""; }
