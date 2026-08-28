"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import readXlsxFile from "read-excel-file/browser";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createPayrollImportBatchAction } from "@/features/payroll/actions/payroll-actions";
import {
  normalizePayrollImportRow,
  payrollImportTemplateHeaders,
  type PayrollImportDatasetType,
} from "@/features/payroll/import-normalization";
import type { CreatePayrollImportBatchInput, PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

type ImportRow = CreatePayrollImportBatchInput["rows"][number];

const datasetLabels: Record<PayrollImportDatasetType, string> = {
  grading: "Phiếu chấm bài",
  new_enrollment_orders: "Đơn tuyển sinh mới",
  renewal_orders: "Đơn tái phí",
  timekeeping: "Bảng công",
};

const inputClassName = "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring";

export function PayrollImportDialog() {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [datasetType, setDatasetType] = useState<PayrollImportDatasetType>("timekeeping");
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
      const sheets = await readXlsxFile(bytes);
      const sheet = sheets[0]?.data ?? [];
      const expected = payrollImportTemplateHeaders[datasetType];
      const actual = (sheet[0] ?? []).map((cell) => String(cell ?? "").trim());
      if (expected.some((header, index) => actual[index] !== header)) {
        setParseError(`Sai cấu trúc cột. Hãy tải đúng tệp mẫu ${datasetLabels[datasetType]}.`);
        return;
      }
      setRows(
        sheet
          .slice(1)
          .filter((source) =>
            source.some((cell) => cell !== null && String(cell).trim() !== ""),
          )
          .map((source, index) =>
            normalizePayrollImportRow(datasetType, expected, source, index + 2),
          ),
      );
    } catch {
      setParseError("Không thể đọc tệp Excel. Hãy dùng tệp .xlsx theo mẫu.");
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
          <label className="grid gap-1.5 text-label"><span>Loại dữ liệu</span><select className={inputClassName} disabled={isPending} onChange={(event) => { const value = event.target.value as PayrollImportDatasetType; setDatasetType(value); setFile(null); setRows([]); }} value={datasetType}>{Object.entries(datasetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
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

async function sha256(file: File): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function downloadTemplate(datasetType: PayrollImportDatasetType): Promise<void> {
  const writeExcelFile = (await import("write-excel-file/browser")).default;
  const headers = payrollImportTemplateHeaders[datasetType];
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
    const val = exampleValue(header, datasetType);
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
function exampleValue(header: string, datasetType: PayrollImportDatasetType): string | number {
  if (header === "student_id" && datasetType === "new_enrollment_orders") return "";
  const values: Record<string, string | number> = { amount_vnd: 2000000, event_date: "2026-07-15", evidence_url: "https://example.com/bang-chung", grade: 10, quantity: 1, source_code: "school_telesale", source_key: "DU-LIEU-001", staff_id: "00000000-0000-4000-8000-000000000001", student_id: "00000000-0000-4000-8000-000000000002", work_minutes: 540, work_mode: "offline" };
  return values[header] ?? "";
}
