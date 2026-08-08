"use client";

import { useState, useTransition, useMemo } from "react";

import { downloadEnrollmentImportTemplate } from "./template-browser";
import { parseEnrollmentWorkbook, EnrollmentWorkbookError, type ParsedEnrollmentWorkbook } from "./workbook";
import { dryRunStudentEnrollmentImportAction } from "./actions";
import type { EnrollmentImportDryRunResult } from "./types";

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function SpreadsheetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function AlertIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

export function EnrollmentImportPage() {
  const [academicYearCode, setAcademicYearCode] = useState("2026-2027");
  const [file, setFile] = useState<File | null>(null);
  const [fileSha256, setFileSha256] = useState<string | null>(null);
  const [parsedWorkbook, setParsedWorkbook] = useState<ParsedEnrollmentWorkbook | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [dryRunResult, setDryRunResult] = useState<EnrollmentImportDryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const [filterClassification, setFilterClassification] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Handle File Upload & SHA-256 Calculation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError(null);
    setDryRunResult(null);
    setDryRunError(null);
    setIsStale(false);

    try {
      // Calculate SHA-256
      const arrayBuffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256Hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      setFileSha256(sha256Hex);

      // Parse Workbook
      const parsed = await parseEnrollmentWorkbook(selectedFile);
      setParsedWorkbook(parsed);
    } catch (err) {
      setParsedWorkbook(null);
      setFileSha256(null);
      if (err instanceof EnrollmentWorkbookError) {
        setParseError(err.message);
      } else if (err instanceof Error) {
        setParseError(err.message);
      } else {
        setParseError("Lỗi đọc file Excel.");
      }
    }
  };

  const handleAcademicYearChange = (newYear: string) => {
    setAcademicYearCode(newYear);
    if (dryRunResult) {
      setIsStale(true);
    }
  };

  // Run Dry-Run Action
  const handleRunDryRun = () => {
    if (!parsedWorkbook || !academicYearCode) return;

    setDryRunError(null);
    setIsStale(false);

    startTransition(async () => {
      const res = await dryRunStudentEnrollmentImportAction(academicYearCode, parsedWorkbook.rows);
      if (res.success && res.data) {
        setDryRunResult(res.data);
      } else {
        setDryRunError(res.error || "Giao dịch kiểm tra Dry-Run thất bại.");
      }
    });
  };

  // Filtered Rows for Detail Table
  const filteredRows = useMemo(() => {
    if (!dryRunResult) return [];
    if (filterClassification === "all") return dryRunResult.rows;
    return dryRunResult.rows.filter((r) => r.classification === filterClassification);
  }, [dryRunResult, filterClassification]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Import Ghi Danh Học Viên
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kiểm tra và ghi danh hàng loạt học viên vào các lớp học theo năm học chính thức.
          </p>
        </div>
        <button
          onClick={() => downloadEnrollmentImportTemplate()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <DownloadIcon className="w-4 h-4" />
          Tải Mẫu Excel Import
        </button>
      </div>

      {/* Control Panel: Year & Upload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        {/* Academic Year Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Năm học chọn Import <span className="text-red-500">*</span>
          </label>
          <select
            value={academicYearCode}
            onChange={(e) => handleAcademicYearChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
          >
            <option value="2026-2027">2026-2027 (Năm học chính thức)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Mã lớp sẽ được kiểm tra thuộc năm học được chọn.
          </p>
        </div>

        {/* File Upload */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Chọn File Excel (.xlsx) <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
              <SpreadsheetIcon className="w-4 h-4 text-emerald-600" />
              {file ? file.name : "Chọn file Excel..."}
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {file && (
              <span className="text-xs text-gray-500 truncate max-w-xs font-mono">
                SHA: {fileSha256 ? `${fileSha256.slice(0, 16)}...` : "Đang tính..."}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Parse Error Alert */}
      {parseError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
          <AlertIcon className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Lỗi đọc file Excel</h4>
            <p className="text-sm mt-0.5">{parseError}</p>
          </div>
        </div>
      )}

      {/* Parsed Workbook Preview */}
      {parsedWorkbook && !parseError && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-emerald-600" />
                Đã đọc thành công: {parsedWorkbook.totalRows} dòng dữ liệu
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">
                Trang tính: {parsedWorkbook.sheetName} | Cột: {parsedWorkbook.headers.join(", ")}
              </p>
            </div>
            <button
              onClick={handleRunDryRun}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isPending ? (
                <>
                  <RefreshIcon className="w-4 h-4 animate-spin" />
                  Đang kiểm tra Dry-Run...
                </>
              ) : (
                <>Kiểm tra Dry-Run</>
              )}
            </button>
          </div>

          {/* Stale Warning */}
          {isStale && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-sm">
              <AlertIcon className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Dữ liệu hoặc năm học đã thay đổi sau lần Dry-run gần nhất. Vui lòng bấm &quot;Kiểm tra Dry-Run&quot; lại.</span>
            </div>
          )}

          {/* Dry Run Execution Error */}
          {dryRunError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              <strong>Lỗi kiểm tra Dry-Run:</strong> {dryRunError}
            </div>
          )}

          {/* Sample Rows Preview Table */}
          {!dryRunResult && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Xem trước 5 dòng dữ liệu đầu tiên
              </h4>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Dòng</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Mã học viên</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Mã lớp</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Hình thức</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Hiệu lực từ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white font-mono text-xs">
                    {parsedWorkbook.rows.slice(0, 5).map((r) => (
                      <tr key={r.source_row} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{r.source_row}</td>
                        <td className="px-3 py-2 text-blue-600">{r.student_public_code}</td>
                        <td className="px-3 py-2 text-gray-800">{r.class_code}</td>
                        <td className="px-3 py-2 text-gray-600">{r.registered_mode}</td>
                        <td className="px-3 py-2 text-gray-600">{r.effective_from}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dry-Run Result Summary Cards & Detailed Table */}
      {dryRunResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-medium text-gray-500">Tổng số dòng</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{dryRunResult.row_count}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-sm">
              <span className="text-xs font-semibold text-emerald-800">Mới (Tạo mới)</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{dryRunResult.new_count}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm">
              <span className="text-xs font-semibold text-blue-800">Đã tồn tại & khớp</span>
              <p className="text-2xl font-bold text-blue-700 mt-1">{dryRunResult.matching_count}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-sm">
              <span className="text-xs font-semibold text-amber-800">Xung đột</span>
              <p className="text-2xl font-bold text-amber-700 mt-1">{dryRunResult.conflict_count}</p>
            </div>
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm">
              <span className="text-xs font-semibold text-red-800">Không hợp lệ</span>
              <p className="text-2xl font-bold text-red-700 mt-1">{dryRunResult.invalid_count}</p>
            </div>
          </div>

          {/* Action Bar (Disabled Batch Creation) */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <InfoIcon className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Năm học: <strong className="font-semibold text-gray-900">{dryRunResult.academic_year_code}</strong> |
                Kiểm tra: <strong className="font-semibold text-emerald-600">{dryRunResult.new_count} Mới</strong>,
                <strong className="font-semibold text-blue-600"> {dryRunResult.matching_count} Đã tồn tại & khớp</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled
                className="px-5 py-2.5 bg-gray-200 text-gray-400 font-medium text-sm rounded-lg cursor-not-allowed shadow-none"
                title="Chức năng tạo batch sẽ được nghiệm thu ở bước tiếp theo."
              >
                Tạo Batch Import (Bước Tiếp Theo)
              </button>
            </div>
          </div>

          {/* Filter Bar & Detailed Results Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="font-bold text-gray-900 text-base">
                Chi tiết kết quả kiểm tra Dry-Run ({filteredRows.length} / {dryRunResult.row_count} dòng)
              </h3>
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="text-gray-500">Lọc trạng thái:</span>
                <select
                  value={filterClassification}
                  onChange={(e) => setFilterClassification(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tất cả ({dryRunResult.row_count})</option>
                  <option value="new">Mới ({dryRunResult.new_count})</option>
                  <option value="existing_matching">Đã tồn tại & khớp ({dryRunResult.matching_count})</option>
                  <option value="existing_conflict">Xung đột ({dryRunResult.conflict_count})</option>
                  <option value="invalid">Không hợp lệ ({dryRunResult.invalid_count})</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200 text-xs font-mono">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">Dòng</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">Mã học viên</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">Mã lớp</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">Hình thức</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">Hiệu lực từ</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">Phân loại</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">Chi tiết / Thông báo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredRows.map((r) => {
                    let badgeBg = "bg-gray-100 text-gray-700";
                    let badgeLabel: string = r.classification;

                    if (r.classification === "new") {
                      badgeBg = "bg-emerald-100 text-emerald-800 border border-emerald-200";
                      badgeLabel = "Mới";
                    } else if (r.classification === "existing_matching") {
                      badgeBg = "bg-blue-100 text-blue-800 border border-blue-200";
                      badgeLabel = "Đã tồn tại & khớp";
                    } else if (r.classification === "existing_conflict") {
                      badgeBg = "bg-amber-100 text-amber-800 border border-amber-200";
                      badgeLabel = "Xung đột";
                    } else if (r.classification === "invalid") {
                      badgeBg = "bg-red-100 text-red-800 border border-red-200";
                      badgeLabel = "Không hợp lệ";
                    }

                    return (
                      <tr key={r.source_row} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-bold text-gray-900">{r.source_row}</td>
                        <td className="px-3 py-2 text-blue-600 font-semibold">{r.student_public_code}</td>
                        <td className="px-3 py-2 text-gray-900 font-semibold">{r.class_code}</td>
                        <td className="px-3 py-2 text-gray-700">{r.registered_mode}</td>
                        <td className="px-3 py-2 text-gray-700">{r.effective_from}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] ${badgeBg}`}>
                            {badgeLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-md truncate">
                          {r.validation_message ? (
                            <span className="text-red-600 font-sans">{r.validation_message}</span>
                          ) : (
                            <span className="text-gray-400 font-sans italic">Hợp lệ</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
