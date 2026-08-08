"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  createClassScheduleImportBatchAction,
  dryRunClassScheduleImportAction,
} from "./actions";
import { CLASS_IMPORT_FIELDS, SCHEDULE_IMPORT_FIELDS } from "./fields";
import {
  autoMapClassesSheet,
  autoMapSchedulesSheet,
  validateClassesMapping,
  validateSchedulesMapping,
} from "./mapping";
import { downloadClassScheduleImportTemplate } from "./template-browser";
import type {
  ClassImportColumnMapping,
  ClassImportRowInput,
  ClassScheduleImportParsedWorkbook,
  DryRunClassResultRow,
  DryRunClassScheduleImportResult,
  DryRunScheduleResultRow,
  ScheduleImportColumnMapping,
  ScheduleImportRowInput,
} from "./types";
import {
  parseClassScheduleImportWorkbook,
  parseDateValue,
  parseTimeValue,
  parseWeekdayValue,
} from "./workbook";

interface LastDryRunState {
  academicYearCode: string;
  classesCount: number;
  classesMapping: ClassImportColumnMapping;
  schedulesCount: number;
  schedulesMapping: ScheduleImportColumnMapping;
  sha256: string;
}

export function ClassScheduleImportPage() {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPendingDryRun, startTransitionDryRun] = useTransition();
  const [isPendingBatch, startTransitionBatch] = useTransition();

  // Workflow steps: 1 = Upload, 2 = Mapping, 3 = Preview & Dry-Run
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Workbook state
  const [workbook, setWorkbook] = useState<ClassScheduleImportParsedWorkbook | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Mappings
  const [classesMapping, setClassesMapping] = useState<ClassImportColumnMapping>({});
  const [schedulesMapping, setSchedulesMapping] = useState<ScheduleImportColumnMapping>({});

  // Tab selection
  const [activeTab, setActiveTab] = useState<"classes" | "schedules">("classes");

  // Dry-run result & state tracking
  const [dryRunResult, setDryRunResult] = useState<DryRunClassScheduleImportResult | null>(null);
  const [lastDryRunState, setLastDryRunState] = useState<LastDryRunState | null>(null);

  // Create batch form state
  const [reason, setReason] = useState("Pilot Data Import Readiness - lớp và lịch học 2026-2027");
  const [confirmationChecked, setConfirmationChecked] = useState(false);

  // Errors
  const [actionError, setActionError] = useState<string | null>(null);
  const [existingBatchId, setExistingBatchId] = useState<string | null>(null);

  // Download template handler
  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      await downloadClassScheduleImportTemplate();
    } catch (err) {
      alert(`Không thể tải file mẫu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setActionError(null);
    setExistingBatchId(null);
    setDryRunResult(null);
    setLastDryRunState(null);

    try {
      const parsed = await parseClassScheduleImportWorkbook(file);
      setWorkbook(parsed);

      // Auto map columns
      const classAuto = autoMapClassesSheet(parsed.classesSheet);
      const scheduleAuto = autoMapSchedulesSheet(parsed.schedulesSheet);

      setClassesMapping(classAuto.mapping);
      setSchedulesMapping(scheduleAuto.mapping);

      setStep(2);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err));
      setWorkbook(null);
    }
  };

  // Reset file handler
  const handleReset = () => {
    setWorkbook(null);
    setFileError(null);
    setActionError(null);
    setExistingBatchId(null);
    setClassesMapping({});
    setSchedulesMapping({});
    setDryRunResult(null);
    setLastDryRunState(null);
    setConfirmationChecked(false);
    setStep(1);
  };

  // Validations
  const classesMappingValidation = useMemo(
    () => validateClassesMapping(classesMapping),
    [classesMapping]
  );

  const schedulesMappingValidation = useMemo(
    () => validateSchedulesMapping(schedulesMapping),
    [schedulesMapping]
  );

  const isMappingValid = classesMappingValidation.isValid && schedulesMappingValidation.isValid;

  // Prepare RPC payloads
  const preparedClassInputs = useMemo((): { academicYearCode: string; rows: ClassImportRowInput[] } => {
    if (!workbook) return { academicYearCode: "", rows: [] };

    let targetYearCode = "";
    const rows: ClassImportRowInput[] = workbook.classesSheet.rows.map((row) => {
      const yearCodeVal = classesMapping.academic_year_code
        ? String(row.values[classesMapping.academic_year_code] ?? "").trim()
        : "";
      if (yearCodeVal && !targetYearCode) {
        targetYearCode = yearCodeVal;
      }

      return {
        academic_year_code: yearCodeVal,
        class_code: classesMapping.class_code
          ? String(row.values[classesMapping.class_code] ?? "").trim()
          : "",
        class_name: classesMapping.class_name
          ? String(row.values[classesMapping.class_name] ?? "").trim()
          : "",
        default_learning_mode: classesMapping.default_learning_mode
          ? String(row.values[classesMapping.default_learning_mode] ?? "").trim().toLowerCase()
          : "hybrid",
        grade: classesMapping.grade ? Number(row.values[classesMapping.grade]) : undefined,
        level: classesMapping.level
          ? String(row.values[classesMapping.level] ?? "").trim().toUpperCase()
          : "",
        source_row_number: row.rowNumber,
        status: classesMapping.status
          ? String(row.values[classesMapping.status] ?? "").trim().toLowerCase()
          : "active",
        weekly_session_count: classesMapping.weekly_session_count
          ? Number(row.values[classesMapping.weekly_session_count])
          : 2,
      };
    });

    return { academicYearCode: targetYearCode || "2026-2027", rows };
  }, [workbook, classesMapping]);

  const preparedScheduleInputs = useMemo((): ScheduleImportRowInput[] => {
    if (!workbook) return [];

    return workbook.schedulesSheet.rows.map((row) => {
      const rawWeekday = schedulesMapping.weekday ? row.values[schedulesMapping.weekday] : null;
      const parsedWeekday = parseWeekdayValue(rawWeekday);

      const rawStartTime = schedulesMapping.start_time ? row.values[schedulesMapping.start_time] : null;
      const parsedStartTime = parseTimeValue(rawStartTime) || String(rawStartTime || "");

      const rawEndTime = schedulesMapping.end_time ? row.values[schedulesMapping.end_time] : null;
      const parsedEndTime = parseTimeValue(rawEndTime) || String(rawEndTime || "");

      const rawFrom = schedulesMapping.effective_from ? row.values[schedulesMapping.effective_from] : null;
      const parsedFrom = parseDateValue(rawFrom) || String(rawFrom || "");

      const rawTo = schedulesMapping.effective_to ? row.values[schedulesMapping.effective_to] : null;
      const parsedTo = parseDateValue(rawTo);

      return {
        class_code: schedulesMapping.class_code
          ? String(row.values[schedulesMapping.class_code] ?? "").trim()
          : "",
        component_code: schedulesMapping.component_code
          ? String(row.values[schedulesMapping.component_code] ?? "").trim()
          : "",
        effective_from: parsedFrom,
        effective_to: parsedTo,
        end_time: parsedEndTime,
        learning_mode: schedulesMapping.learning_mode
          ? String(row.values[schedulesMapping.learning_mode] ?? "").trim().toLowerCase()
          : "hybrid",
        meeting_url: schedulesMapping.meeting_url
          ? String(row.values[schedulesMapping.meeting_url] ?? "").trim()
          : null,
        room_name: schedulesMapping.room_name
          ? String(row.values[schedulesMapping.room_name] ?? "").trim()
          : null,
        source_row_number: row.rowNumber,
        start_time: parsedStartTime,
        weekday: parsedWeekday ?? (Number(rawWeekday) || 1),
      };
    });
  }, [workbook, schedulesMapping]);

  // Check if current data state is stale compared to last dry-run
  const isStale = useMemo(() => {
    if (!lastDryRunState || !workbook) return false;

    if (lastDryRunState.sha256 !== workbook.sourceSha256) return true;
    if (lastDryRunState.academicYearCode !== preparedClassInputs.academicYearCode) return true;
    if (lastDryRunState.classesCount !== preparedClassInputs.rows.length) return true;
    if (lastDryRunState.schedulesCount !== preparedScheduleInputs.length) return true;

    if (JSON.stringify(lastDryRunState.classesMapping) !== JSON.stringify(classesMapping)) return true;
    if (JSON.stringify(lastDryRunState.schedulesMapping) !== JSON.stringify(schedulesMapping)) return true;

    return false;
  }, [
    lastDryRunState,
    workbook,
    preparedClassInputs,
    preparedScheduleInputs,
    classesMapping,
    schedulesMapping,
  ]);

  // Execute dry-run action
  const handleExecuteDryRun = () => {
    if (!isMappingValid || !workbook) return;

    setActionError(null);
    setExistingBatchId(null);
    setDryRunResult(null);

    startTransitionDryRun(async () => {
      const res = await dryRunClassScheduleImportAction({
        academic_year_code: preparedClassInputs.academicYearCode,
        classes: preparedClassInputs.rows,
        schedules: preparedScheduleInputs,
      });

      if (!res.ok) {
        setActionError(res.message);
      } else {
        setDryRunResult(res.data);
        setLastDryRunState({
          academicYearCode: preparedClassInputs.academicYearCode,
          classesCount: preparedClassInputs.rows.length,
          classesMapping: { ...classesMapping },
          schedulesCount: preparedScheduleInputs.length,
          schedulesMapping: { ...schedulesMapping },
          sha256: workbook.sourceSha256,
        });
        setConfirmationChecked(false);
        setStep(3);
      }
    });
  };

  // Execute create batch action
  const handleCreateBatch = () => {
    if (!workbook || !dryRunResult || isStale || !confirmationChecked || !reason.trim()) return;

    setActionError(null);
    setExistingBatchId(null);

    startTransitionBatch(async () => {
      const res = await createClassScheduleImportBatchAction({
        academic_year_code: preparedClassInputs.academicYearCode,
        classes: preparedClassInputs.rows,
        explicit_confirmation: true,
        reason: reason.trim(),
        schedules: preparedScheduleInputs,
        source_filename: workbook.sourceFilename,
        source_sha256: workbook.sourceSha256,
      });

      if (!res.ok) {
        setActionError(res.message);
        if (res.existingBatchId) {
          setExistingBatchId(res.existingBatchId);
        }
      } else {
        router.push(`/imports/classes/${res.data.id}`);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Import hàng loạt Lớp học & Lịch học
          </h1>
          <p className="text-sm text-slate-500">
            Tải file Excel, gán cột dữ liệu và đối soát dry-run cho năm học 2026-2027.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleDownloadTemplate}
          disabled={isDownloading}
          className="gap-2"
        >
          {isDownloading ? "Đang tải mẫu..." : "Tải file mẫu Excel (.xlsx)"}
        </Button>
      </div>

      {/* Stepper Header */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white p-2 text-center text-sm font-medium shadow-sm">
        <div
          className={`flex items-center justify-center gap-2 rounded-md py-2 ${
            step === 1 ? "bg-slate-900 text-white" : "text-slate-600"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">
            1
          </span>
          <span>Tải file Excel</span>
        </div>
        <div
          className={`flex items-center justify-center gap-2 rounded-md py-2 ${
            step === 2 ? "bg-slate-900 text-white" : "text-slate-600"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">
            2
          </span>
          <span>Gán cột & Xem trước</span>
        </div>
        <div
          className={`flex items-center justify-center gap-2 rounded-md py-2 ${
            step === 3 ? "bg-slate-900 text-white" : "text-slate-600"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">
            3
          </span>
          <span>Kết quả Dry-Run & Tạo Batch</span>
        </div>
      </div>

      {/* STEP 1: UPLOAD FILE */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Chọn file Excel dữ liệu Import</CardTitle>
            <p className="text-xs text-slate-500">
              File phải chứa 2 worksheet đúng chuẩn: <strong>Classes</strong> (Lớp học) và{" "}
              <strong>Schedules</strong> (Lịch học). Kích thước tối đa 5 MB.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-slate-400">
              <label htmlFor="excel-file-upload" className="cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                Nhấn để chọn file Excel hoặc kéo thả vào đây
              </label>
              <p className="mt-1 text-xs text-slate-500">Định dạng .xlsx hoặc .xls (Tối đa 500 lớp và 2,000 lịch học)</p>
              <input
                id="excel-file-upload"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </div>

            {fileError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700">
                <div className="flex items-center gap-2 font-bold">
                  Lỗi cấu trúc File
                </div>
                <p className="mt-1">{fileError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: MAPPING & PREVIEW */}
      {step === 2 && workbook && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Thông tin File đã tải</CardTitle>
                <p className="text-xs text-slate-500">
                  Tên file: <strong>{workbook.sourceFilename}</strong> | SHA-256:{" "}
                  <code className="rounded bg-slate-100 px-1 font-mono">{workbook.sourceSha256.slice(0, 16)}...</code>
                </p>
              </div>
              <Button variant="ghost" className="gap-1 text-xs" onClick={handleReset}>
                Chọn file khác
              </Button>
            </CardHeader>
          </Card>

          {/* Sub Tab Navigation */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("classes")}
              className={`border-b-2 px-4 py-2 text-xs font-bold ${
                activeTab === "classes"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Sheet Classes ({workbook.classesSheet.rowCount} lớp)
            </button>
            <button
              onClick={() => setActiveTab("schedules")}
              className={`border-b-2 px-4 py-2 text-xs font-bold ${
                activeTab === "schedules"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Sheet Schedules ({workbook.schedulesSheet.rowCount} lịch học)
            </button>
          </div>

          {/* TAB: CLASSES MAPPING */}
          {activeTab === "classes" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Gán cột dữ liệu Lớp học (Sheet Classes)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {CLASS_IMPORT_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <select
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                          value={classesMapping[field.key] || "unassigned"}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            const val = e.target.value;
                            setClassesMapping((prev) => ({
                              ...prev,
                              [field.key]: val === "unassigned" ? null : val,
                            }));
                          }}
                        >
                          <option value="unassigned">-- Bỏ qua --</option>
                          {workbook.classesSheet.columns.map((col) => (
                            <option key={col.columnKey} value={col.columnKey}>
                              Cột {col.columnKey} ({col.sourceHeader || "Chưa có tiêu đề"})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {!classesMappingValidation.isValid && (
                    <div className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-700">
                      {classesMappingValidation.issues.map((issue, idx) => (
                        <p key={idx}>• {issue.message}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Preview Classes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Xem trước 20 dòng Lớp học từ File</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-slate-50 font-semibold text-slate-700">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Mã năm học</th>
                          <th className="px-3 py-2">Mã lớp</th>
                          <th className="px-3 py-2">Tên lớp</th>
                          <th className="px-3 py-2">Khối</th>
                          <th className="px-3 py-2">Trình độ</th>
                          <th className="px-3 py-2">Số buổi/tuần</th>
                          <th className="px-3 py-2">Hình thức</th>
                          <th className="px-3 py-2">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {workbook.classesSheet.rows.slice(0, 20).map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-slate-500">{row.rowNumber}</td>
                            <td className="px-3 py-2 font-semibold">
                              {classesMapping.academic_year_code
                                ? String(row.values[classesMapping.academic_year_code] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-slate-800">
                              {classesMapping.class_code
                                ? String(row.values[classesMapping.class_code] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {classesMapping.class_name
                                ? String(row.values[classesMapping.class_name] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {classesMapping.grade ? String(row.values[classesMapping.grade] ?? "-") : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {classesMapping.level ? String(row.values[classesMapping.level] ?? "-") : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {classesMapping.weekly_session_count
                                ? String(row.values[classesMapping.weekly_session_count] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {classesMapping.default_learning_mode
                                ? String(row.values[classesMapping.default_learning_mode] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {classesMapping.status ? String(row.values[classesMapping.status] ?? "-") : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB: SCHEDULES MAPPING */}
          {activeTab === "schedules" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Gán cột dữ liệu Lịch học (Sheet Schedules)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {SCHEDULE_IMPORT_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <select
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                          value={schedulesMapping[field.key] || "unassigned"}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            const val = e.target.value;
                            setSchedulesMapping((prev) => ({
                              ...prev,
                              [field.key]: val === "unassigned" ? null : val,
                            }));
                          }}
                        >
                          <option value="unassigned">-- Bỏ qua --</option>
                          {workbook.schedulesSheet.columns.map((col) => (
                            <option key={col.columnKey} value={col.columnKey}>
                              Cột {col.columnKey} ({col.sourceHeader || "Chưa có tiêu đề"})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {!schedulesMappingValidation.isValid && (
                    <div className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-700">
                      {schedulesMappingValidation.issues.map((issue, idx) => (
                        <p key={idx}>• {issue.message}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Preview Schedules */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Xem trước 30 dòng Lịch học từ File</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-slate-50 font-semibold text-slate-700">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Mã lớp</th>
                          <th className="px-3 py-2">Mã TP</th>
                          <th className="px-3 py-2">Thứ</th>
                          <th className="px-3 py-2">Giờ học</th>
                          <th className="px-3 py-2">Hình thức</th>
                          <th className="px-3 py-2">Phòng học</th>
                          <th className="px-3 py-2">Hiệu lực từ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {workbook.schedulesSheet.rows.slice(0, 30).map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-slate-500">{row.rowNumber}</td>
                            <td className="px-3 py-2 font-mono font-bold text-slate-800">
                              {schedulesMapping.class_code
                                ? String(row.values[schedulesMapping.class_code] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              {schedulesMapping.component_code
                                ? String(row.values[schedulesMapping.component_code] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {schedulesMapping.weekday
                                ? parseWeekdayValue(row.values[schedulesMapping.weekday]) || "-"
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {schedulesMapping.start_time
                                ? parseTimeValue(row.values[schedulesMapping.start_time]) || "-"
                                : "-"}{" "}
                              –{" "}
                              {schedulesMapping.end_time
                                ? parseTimeValue(row.values[schedulesMapping.end_time]) || "-"
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {schedulesMapping.learning_mode
                                ? String(row.values[schedulesMapping.learning_mode] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {schedulesMapping.room_name
                                ? String(row.values[schedulesMapping.room_name] ?? "-")
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {schedulesMapping.effective_from
                                ? parseDateValue(row.values[schedulesMapping.effective_from]) || "-"
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Action Error Alert */}
          {actionError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                Lỗi Kiểm tra Dry-Run
              </div>
              <p>{actionError}</p>
            </div>
          )}

          {/* Dry Run Execute Button */}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleReset}>
              Hủy
            </Button>
            <Button
              onClick={handleExecuteDryRun}
              disabled={!isMappingValid || isPendingDryRun}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPendingDryRun ? "Đang kiểm tra dry-run..." : "Kiểm tra Dry-Run dữ liệu"}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: DRY RUN RESULTS SUMMARY & CREATE BATCH */}
      {step === 3 && dryRunResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Kết quả Dry-Run Import Lớp & Lịch học</CardTitle>
                <p className="text-xs text-slate-500">
                  Năm học đối soát: <strong>{dryRunResult.academic_year.code}</strong> ({dryRunResult.academic_year.name})
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                Sửa gán cột
              </Button>
            </CardHeader>
          </Card>

          {/* Stale Protection Alert */}
          {isStale && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800">
              <div className="font-bold flex items-center gap-2">
                Dữ liệu đã thay đổi sau lần Dry-run gần nhất
              </div>
              <p className="mt-1">
                Bạn đã thay đổi file, năm học hoặc gán cột. Vui lòng nhấn nút &quot;Chạy lại Dry-Run&quot; bên dưới để đối soát dữ liệu mới trước khi tạo batch.
              </p>
            </div>
          )}

          {/* Classes Summary Cards */}
          <div>
            <h3 className="mb-3 text-sm font-bold tracking-tight text-slate-800">1. Tổng quan Lớp học (Classes)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Card className="p-3">
                <p className="text-xs text-slate-500">Tổng số lớp</p>
                <p className="text-xl font-bold text-slate-900">{dryRunResult.class_summary.total}</p>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/40 p-3">
                <p className="text-xs text-emerald-700">Tạo mới</p>
                <p className="text-xl font-bold text-emerald-800">{dryRunResult.class_summary.new}</p>
              </Card>
              <Card className="border-blue-200 bg-blue-50/40 p-3">
                <p className="text-xs text-blue-700">Đã tồn tại & Khớp</p>
                <p className="text-xl font-bold text-blue-800">{dryRunResult.class_summary.existing_matching}</p>
              </Card>
              <Card className="border-amber-200 bg-amber-50/40 p-3">
                <p className="text-xs text-amber-700">Xung đột</p>
                <p className="text-xl font-bold text-amber-800">{dryRunResult.class_summary.existing_conflict}</p>
              </Card>
              <Card className="border-red-200 bg-red-50/40 p-3">
                <p className="text-xs text-red-700">Không hợp lệ</p>
                <p className="text-xl font-bold text-red-800">{dryRunResult.class_summary.invalid}</p>
              </Card>
            </div>
          </div>

          {/* Schedules Summary Cards */}
          <div>
            <h3 className="mb-3 text-sm font-bold tracking-tight text-slate-800">2. Tổng quan Lịch học (Schedules)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Card className="p-3">
                <p className="text-xs text-slate-500">Tổng số lịch</p>
                <p className="text-xl font-bold text-slate-900">{dryRunResult.schedule_summary.total}</p>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/40 p-3">
                <p className="text-xs text-emerald-700">Tạo mới</p>
                <p className="text-xl font-bold text-emerald-800">{dryRunResult.schedule_summary.new}</p>
              </Card>
              <Card className="border-blue-200 bg-blue-50/40 p-3">
                <p className="text-xs text-blue-700">Đã tồn tại & Khớp</p>
                <p className="text-xl font-bold text-blue-800">{dryRunResult.schedule_summary.existing_matching}</p>
              </Card>
              <Card className="border-amber-200 bg-amber-50/40 p-3">
                <p className="text-xs text-amber-700">Xung đột</p>
                <p className="text-xl font-bold text-amber-800">{dryRunResult.schedule_summary.existing_conflict}</p>
              </Card>
              <Card className="border-red-200 bg-red-50/40 p-3">
                <p className="text-xs text-red-700">Không hợp lệ</p>
                <p className="text-xl font-bold text-red-800">{dryRunResult.schedule_summary.invalid}</p>
              </Card>
            </div>
          </div>

          {/* Result Sub Tab Navigation */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("classes")}
              className={`border-b-2 px-4 py-2 text-xs font-bold ${
                activeTab === "classes"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Chi tiết Lớp học ({dryRunResult.class_rows.length})
            </button>
            <button
              onClick={() => setActiveTab("schedules")}
              className={`border-b-2 px-4 py-2 text-xs font-bold ${
                activeTab === "schedules"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Chi tiết Lịch học ({dryRunResult.schedule_rows.length})
            </button>
          </div>

          {/* CLASSES RESULT TABLE */}
          {activeTab === "classes" && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-slate-50 font-semibold text-slate-700">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Mã lớp</th>
                        <th className="px-3 py-2">Tên lớp</th>
                        <th className="px-3 py-2">Khối/Trình độ</th>
                        <th className="px-3 py-2">Số buổi</th>
                        <th className="px-3 py-2">Hình thức</th>
                        <th className="px-3 py-2">Phân loại</th>
                        <th className="px-3 py-2">Thông báo kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dryRunResult.class_rows.map((row: DryRunClassResultRow) => (
                        <tr
                          key={row.source_row_number}
                          className={
                            row.classification === "existing_conflict"
                              ? "bg-amber-50/50"
                              : row.classification === "invalid"
                              ? "bg-red-50/50"
                              : "hover:bg-slate-50"
                          }
                        >
                          <td className="px-3 py-2 font-mono text-slate-500">{row.source_row_number}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-800">{row.class_code}</td>
                          <td className="px-3 py-2">{row.class_name}</td>
                          <td className="px-3 py-2">
                            Khối {row.grade} ({row.level})
                          </td>
                          <td className="px-3 py-2">{row.weekly_session_count} buổi/tuần</td>
                          <td className="px-3 py-2">{row.default_learning_mode}</td>
                          <td className="px-3 py-2">
                            {row.classification === "new" && <Badge tone="success">Tạo mới</Badge>}
                            {row.classification === "existing_matching" && <Badge tone="info">Đã tồn tại & Khớp</Badge>}
                            {row.classification === "existing_conflict" && <Badge tone="warning">Xung đột</Badge>}
                            {row.classification === "invalid" && <Badge tone="danger">Không hợp lệ</Badge>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.validation_message || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SCHEDULES RESULT TABLE */}
          {activeTab === "schedules" && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-slate-50 font-semibold text-slate-700">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Mã lớp</th>
                        <th className="px-3 py-2">Thành phần</th>
                        <th className="px-3 py-2">Thứ</th>
                        <th className="px-3 py-2">Giờ học</th>
                        <th className="px-3 py-2">Hình thức</th>
                        <th className="px-3 py-2">Hiệu lực từ</th>
                        <th className="px-3 py-2">Phân loại</th>
                        <th className="px-3 py-2">Thông báo kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dryRunResult.schedule_rows.map((row: DryRunScheduleResultRow) => (
                        <tr
                          key={row.source_row_number}
                          className={
                            row.classification === "existing_conflict"
                              ? "bg-amber-50/50"
                              : row.classification === "invalid"
                              ? "bg-red-50/50"
                              : "hover:bg-slate-50"
                          }
                        >
                          <td className="px-3 py-2 font-mono text-slate-500">{row.source_row_number}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-800">{row.class_code}</td>
                          <td className="px-3 py-2 font-semibold">{row.component_code}</td>
                          <td className="px-3 py-2">Thứ {row.weekday}</td>
                          <td className="px-3 py-2">
                            {row.start_time} – {row.end_time}
                          </td>
                          <td className="px-3 py-2">{row.learning_mode}</td>
                          <td className="px-3 py-2">{row.effective_from}</td>
                          <td className="px-3 py-2">
                            {row.classification === "new" && <Badge tone="success">Tạo mới</Badge>}
                            {row.classification === "existing_matching" && <Badge tone="info">Đã tồn tại & Khớp</Badge>}
                            {row.classification === "existing_conflict" && <Badge tone="warning">Xung đột</Badge>}
                            {row.classification === "invalid" && <Badge tone="danger">Không hợp lệ</Badge>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.validation_message || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CREATE BATCH FORM PANEL */}
          <Card className="border-slate-300 bg-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Lưu thông tin thành Batch chuẩn bị Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reason input */}
              <div className="space-y-1.5">
                <label htmlFor="import-reason-input" className="text-xs font-medium text-slate-700">
                  Lý do tạo batch <span className="text-red-500">*</span>
                </label>
                <input
                  id="import-reason-input"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập lý do tạo batch (ví dụ: Pilot Data Import Readiness - lớp và lịch học 2026-2027)..."
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              {/* Explicit Confirmation Checkbox */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  id="explicit-confirmation-checkbox"
                  type="checkbox"
                  checked={confirmationChecked}
                  onChange={(e) => setConfirmationChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label
                  htmlFor="explicit-confirmation-checkbox"
                  className="cursor-pointer text-xs font-medium text-slate-700 select-none"
                >
                  Tôi xác nhận kết quả Dry-run đã được kiểm tra và muốn lưu dữ liệu này thành batch để chuẩn bị import.
                </label>
              </div>

              {/* Action Error Alert */}
              {actionError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
                  <div className="font-bold flex items-center gap-2">Lỗi tạo Batch</div>
                  <p>{actionError}</p>
                  {existingBatchId && (
                    <div className="pt-1 font-semibold">
                      <Link
                        href={`/imports/classes/${existingBatchId}`}
                        className="underline hover:text-red-900"
                      >
                        → Bấm vào đây để xem batch đã tồn tại ({existingBatchId})
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Submit / Re-run Buttons */}
              <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
                {isStale ? (
                  <Button
                    onClick={handleExecuteDryRun}
                    disabled={isPendingDryRun}
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white gap-2"
                  >
                    {isPendingDryRun ? "Đang chạy lại..." : "Chạy lại Dry-Run đối soát"}
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <Button variant="ghost" onClick={handleReset}>
                    Hủy
                  </Button>
                  <Button
                    onClick={handleCreateBatch}
                    disabled={
                      !dryRunResult ||
                      isStale ||
                      !confirmationChecked ||
                      !reason.trim() ||
                      isPendingBatch
                    }
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    {isPendingBatch ? "Đang tạo batch..." : "Tạo Batch Import"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
