"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { getButtonClassName } from "@/components/ui/button";
import { setTuitionPeriodRatesAction, setTuitionPeriodSourcesAction } from "./actions";
import { tuitionBlockerLabels } from "./readiness";
import { downloadTuitionRateExcel, downloadTuitionSourceExcel } from "./tuition-template-browser";
import type { TuitionLeadSourceItem, TuitionStudentDetail } from "./data";

export interface StudentReadiness {
  studentId: string;
  sessions: number;
  missingRateFrom: string | null;
  issues: string[];
}

export interface TuitionReadinessTableProps {
  canManageRates: boolean;
  canManageSources?: boolean;
  periodId: string;
  students: StudentReadiness[];
  labels: Record<string, string>;
  studentDetails?: Record<string, TuitionStudentDetail>;
  leadSources?: TuitionLeadSourceItem[];
  /** Defaults to the real server actions; the /dev preview passes inert stubs. */
  setRatesAction?: typeof setTuitionPeriodRatesAction;
  setSourcesAction?: typeof setTuitionPeriodSourcesAction;
}

export function TuitionReadinessTable({
  canManageRates,
  canManageSources = false,
  periodId,
  students,
  labels,
  studentDetails = {},
  leadSources = [],
  setRatesAction = setTuitionPeriodRatesAction,
  setSourcesAction = setTuitionPeriodSourcesAction,
}: TuitionReadinessTableProps) {
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "missing_rate" | "missing_source" | "ready">("missing_rate");
  const [downloading, setDownloading] = useState<string | null>(null);

  const rateFormRef = useRef<HTMLFormElement>(null);
  const sourceFormRef = useRef<HTMLFormElement>(null);
  const searchInputId = useId();

  // Filter students based on query and filterMode
  const visible = students.filter(student => {
    const label = labels[student.studentId] ?? student.studentId;
    const matchesQuery = label.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"));
    if (!matchesQuery) return false;

    if (filterMode === "missing_rate") return student.missingRateFrom !== null;
    if (filterMode === "missing_source") return student.issues.includes("MISSING_ACQUISITION_SOURCE");
    if (filterMode === "ready") return student.issues.length === 0;
    return true;
  });

  const studentsMissingRate = students.filter(s => s.missingRateFrom !== null);
  const studentsMissingSource = students.filter(s => s.issues.includes("MISSING_ACQUISITION_SOURCE"));

  const visibleMissingRate = visible.filter(s => s.missingRateFrom !== null);
  const allVisibleRateSelected = visibleMissingRate.length > 0 && visibleMissingRate.every(s => selectedRateIds.includes(s.studentId));

  const earliestRateDate = students
    .filter(s => selectedRateIds.includes(s.studentId))
    .map(s => s.missingRateFrom)
    .filter((d): d is string => d !== null)
    .sort()[0];

  const handleToggleSelectAllVisibleRates = () => {
    if (allVisibleRateSelected) {
      const visibleIds = new Set(visibleMissingRate.map(s => s.studentId));
      setSelectedRateIds(prev => prev.filter(id => !visibleIds.has(id)));
    } else {
      const next = new Set([...selectedRateIds, ...visibleMissingRate.map(s => s.studentId)]);
      setSelectedRateIds([...next]);
    }
  };

  const handleSelectAllMissingRates = () => {
    setSelectedRateIds(studentsMissingRate.map(s => s.studentId));
  };

  const handleClearRateSelection = () => {
    setSelectedRateIds([]);
  };

  // Download generic template
  const handleDownloadBlankRateTemplate = async () => {
    setDownloading("rate_blank");
    try {
      await downloadTuitionRateExcel();
    } finally {
      setDownloading(null);
    }
  };

  // Download pre-filled missing rates
  const handleDownloadMissingRatesExcel = async () => {
    setDownloading("rate_missing");
    try {
      const rows = studentsMissingRate.map(s => {
        const detail = studentDetails[s.studentId];
        return {
          publicCode: detail?.publicCode ?? s.studentId,
          fullName: detail?.fullName ?? labels[s.studentId] ?? "Học viên",
          effectiveFrom: s.missingRateFrom ?? "",
          reason: "Học phí khóa hiện tại",
        };
      });
      await downloadTuitionRateExcel(rows);
    } finally {
      setDownloading(null);
    }
  };

  // Download source template
  const handleDownloadSourceTemplate = async () => {
    setDownloading("source_blank");
    try {
      const rows = studentsMissingSource.map(s => {
        const detail = studentDetails[s.studentId];
        return {
          publicCode: detail?.publicCode ?? s.studentId,
          fullName: detail?.fullName ?? labels[s.studentId] ?? "Học viên",
          reason: "Khởi tạo dữ liệu ban đầu",
        };
      });
      await downloadTuitionSourceExcel(leadSources, rows.length > 0 ? rows : undefined);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section aria-label="Kiểm tra học phí từng học viên" className="grid min-w-0 gap-4">
      {/* Action header with Excel download tools */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-raised p-4">
        <div>
          <h2 className="text-base font-semibold text-text-strong">Công cụ File mẫu &amp; Dữ liệu ban đầu</h2>
          <p className="text-xs text-text-muted">
            Tải file mẫu Excel chuẩn để nhập hàng loạt hoặc xuất danh sách học viên đang thiếu dữ liệu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-xs font-medium hover:bg-surface-raised disabled:opacity-50"
            disabled={downloading !== null}
            onClick={handleDownloadBlankRateTemplate}
            type="button"
          >
            {downloading === "rate_blank" ? "Đang tạo..." : "📥 File mẫu đơn giá (.xlsx)"}
          </button>
          {studentsMissingRate.length > 0 ? (
            <button
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
              disabled={downloading !== null}
              onClick={handleDownloadMissingRatesExcel}
              type="button"
            >
              {downloading === "rate_missing"
                ? "Đang xuất..."
                : `📊 Xuất ${studentsMissingRate.length} học viên thiếu giá (.xlsx)`}
            </button>
          ) : null}
          <button
            className="rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-xs font-medium hover:bg-surface-raised disabled:opacity-50"
            disabled={downloading !== null}
            onClick={handleDownloadSourceTemplate}
            type="button"
          >
            {downloading === "source_blank" ? "Đang tạo..." : "📥 File mẫu nguồn (.xlsx)"}
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterMode === "missing_rate"
                ? "bg-primary text-text-on-primary font-semibold"
                : "bg-surface-raised text-text-muted hover:bg-surface-base border border-border-subtle"
            }`}
            onClick={() => setFilterMode("missing_rate")}
            type="button"
          >
            Thiếu đơn giá ({studentsMissingRate.length})
          </button>
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterMode === "missing_source"
                ? "bg-primary text-text-on-primary font-semibold"
                : "bg-surface-raised text-text-muted hover:bg-surface-base border border-border-subtle"
            }`}
            onClick={() => setFilterMode("missing_source")}
            type="button"
          >
            Thiếu nguồn ({studentsMissingSource.length})
          </button>
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterMode === "all"
                ? "bg-primary text-text-on-primary font-semibold"
                : "bg-surface-raised text-text-muted hover:bg-surface-base border border-border-subtle"
            }`}
            onClick={() => setFilterMode("all")}
            type="button"
          >
            Tất cả ({students.length})
          </button>
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterMode === "ready"
                ? "bg-primary text-text-on-primary font-semibold"
                : "bg-surface-raised text-text-muted hover:bg-surface-base border border-border-subtle"
            }`}
            onClick={() => setFilterMode("ready")}
            type="button"
          >
            Đủ dữ liệu ({students.filter(student => student.issues.length === 0).length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted" htmlFor={searchInputId}>Tìm kiếm:</label>
          <input
            className="min-h-9 rounded-md border border-border-subtle bg-surface-base px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            id={searchInputId}
            onChange={event => setQuery(event.target.value)}
            placeholder="Tên hoặc mã học viên..."
            value={query}
          />
        </div>
      </div>

      {/* Bulk Rate Assignment Form */}
      {canManageRates && studentsMissingRate.length > 0 ? (
        <form
          action={form =>
            startTransition(async () => {
              setStatusMessage(null);
              try {
                const unitPrice = Number(form.get("unitPrice"));
                const reason = String(form.get("reason") ?? "").trim();
                const result = await setRatesAction({
                  periodId,
                  studentIds: selectedRateIds,
                  unitPriceVnd: unitPrice,
                  reason,
                });
                setStatusMessage({
                  text: result.message,
                  type: result.status === "success" ? "success" : "error",
                });
                if (result.status === "success") {
                  setSelectedRateIds([]);
                  rateFormRef.current?.reset();
                }
              } catch {
                setStatusMessage({
                  text: "Không thể kết nối. Chưa xác nhận lưu đơn giá; vui lòng tải lại để kiểm tra.",
                  type: "error",
                });
              }
            })
          }
          className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4"
          ref={rateFormRef}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-text-strong">
              Bổ sung đơn giá ({selectedRateIds.length} học viên đang chọn)
            </h3>
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-action-link hover:underline"
                onClick={handleSelectAllMissingRates}
                type="button"
              >
                Chọn tất cả {studentsMissingRate.length} học viên thiếu giá
              </button>
              {selectedRateIds.length > 0 ? (
                <>
                  <span className="text-text-muted">•</span>
                  <button
                    className="text-xs text-danger hover:underline"
                    onClick={handleClearRateSelection}
                    type="button"
                  >
                    Bỏ chọn ({selectedRateIds.length})
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Mức phí sẽ được áp dụng từ ngày học đầu tiên còn thiếu giá của từng học viên. Các mức giá đã có và phiếu đã phát hành được giữ nguyên.
          </p>
          {earliestRateDate ? (
            <p className="text-xs text-ink font-medium">
              Ngày hiệu lực sớm nhất trong lựa chọn: <strong>{earliestRateDate}</strong>
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-text-muted">
              Học phí mỗi buổi (VND) *
              <input
                className="min-h-10 rounded border border-border-subtle bg-surface-raised px-3 text-sm"
                disabled={pending}
                min="1"
                name="unitPrice"
                required
                step="1"
                type="number"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-text-muted">
              Căn cứ áp dụng *
              <input
                className="min-h-10 rounded border border-border-subtle bg-surface-raised px-3 text-sm"
                disabled={pending}
                name="reason"
                placeholder="Ví dụ: Học phí khóa tháng 8-11"
                required
              />
            </label>
            <button
              className={getButtonClassName({ className: "self-end max-md:h-11", variant: "secondary" })}
              disabled={pending || selectedRateIds.length === 0}
              type="submit"
            >
              {pending ? "Đang lưu..." : `Lưu đơn giá cho ${selectedRateIds.length} học viên`}
            </button>
          </div>
        </form>
      ) : null}

      {/* Bulk Source Assignment Form */}
      {canManageSources && studentsMissingSource.length > 0 && leadSources.length > 0 ? (
        <form
          action={form =>
            startTransition(async () => {
              setStatusMessage(null);
              try {
                const leadSourceId = String(form.get("leadSourceId"));
                const reason = String(form.get("reason") ?? "").trim();
                const result = await setSourcesAction({
                  periodId,
                  studentIds: selectedSourceIds,
                  leadSourceId,
                  reason,
                });
                setStatusMessage({
                  text: result.message,
                  type: result.status === "success" ? "success" : "error",
                });
                if (result.status === "success") {
                  setSelectedSourceIds([]);
                  sourceFormRef.current?.reset();
                }
              } catch {
                setStatusMessage({
                  text: "Lỗi kết nối khi cập nhật nguồn học viên.",
                  type: "error",
                });
              }
            })
          }
          className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4"
          ref={sourceFormRef}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-text-strong">
              Gán nguồn tuyển sinh ({selectedSourceIds.length} học viên đang chọn)
            </h3>
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-action-link hover:underline"
                onClick={() => setSelectedSourceIds(studentsMissingSource.map(s => s.studentId))}
                type="button"
              >
                Chọn tất cả {studentsMissingSource.length} học viên thiếu nguồn
              </button>
              {selectedSourceIds.length > 0 ? (
                <>
                  <span className="text-text-muted">•</span>
                  <button
                    className="text-xs text-danger hover:underline"
                    onClick={() => setSelectedSourceIds([])}
                    type="button"
                  >
                    Bỏ chọn
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-text-muted">
              Nguồn tuyển sinh *
              <select
                className="min-h-10 rounded border border-border-subtle bg-surface-raised px-3 text-sm"
                disabled={pending}
                defaultValue=""
                name="leadSourceId"
                required
              >
                <option disabled value="">Chọn nguồn đã xác minh</option>
                {leadSources.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-text-muted">
              Lý do gán *
              <input
                className="min-h-10 rounded border border-border-subtle bg-surface-raised px-3 text-sm"
                defaultValue="Khởi tạo dữ liệu ban đầu kỳ thu"
                disabled={pending}
                name="reason"
                required
              />
            </label>
            <button
              className={getButtonClassName({ className: "self-end max-md:h-11", variant: "secondary" })}
              disabled={pending || selectedSourceIds.length === 0}
              type="submit"
            >
              {pending ? "Đang lưu..." : `Lưu nguồn cho ${selectedSourceIds.length} học viên`}
            </button>
          </div>
        </form>
      ) : null}

      {/* Styled Status Alert */}
      {statusMessage ? (
        <div
          aria-live="polite"
          className={`rounded-md p-3 text-sm font-medium ${
            statusMessage.type === "success"
              ? "border border-success-border bg-success-bg text-success"
              : "border border-danger-border bg-danger-bg text-danger"
          }`}
          role="status"
        >
          {statusMessage.text}
        </div>
      ) : null}

      {/* Students Table */}
      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-base">
        <table className="w-full text-left text-sm text-text-muted">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-raised text-xs font-semibold uppercase text-text-muted">
              <th className="p-3">
                {canManageRates && filterMode !== "missing_source" && visibleMissingRate.length > 0 ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      aria-label="Chọn tất cả học viên thiếu đơn giá đang hiển thị"
                      checked={allVisibleRateSelected}
                      disabled={pending}
                      onChange={handleToggleSelectAllVisibleRates}
                      type="checkbox"
                    />
                    <span>Học viên ({visible.length})</span>
                  </label>
                ) : (
                  <span>Học viên ({visible.length})</span>
                )}
              </th>
              <th className="p-3 text-center">Số buổi</th>
              <th className="p-3">Vấn đề cần bổ sung</th>
              <th className="p-3">Ngày đầu thiếu giá</th>
              <th className="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {visible.map(student => {
              const isMissingRate = student.missingRateFrom !== null;
              const isMissingSource = student.issues.includes("MISSING_ACQUISITION_SOURCE");
              const isRateSelected = selectedRateIds.includes(student.studentId);
              const isSourceSelected = selectedSourceIds.includes(student.studentId);

              return (
                <tr className="hover:bg-surface-raised/50 transition-colors" key={student.studentId}>
                  <td className="p-3">
                    <label className="flex items-center gap-2">
                      {canManageRates && filterMode !== "missing_source" && isMissingRate ? (
                        <input
                          aria-label={`Chọn đơn giá ${labels[student.studentId] ?? student.studentId}`}
                          checked={isRateSelected}
                          disabled={pending}
                          onChange={event =>
                            setSelectedRateIds(prev =>
                              event.target.checked
                                ? [...prev, student.studentId]
                                : prev.filter(id => id !== student.studentId)
                            )
                          }
                          type="checkbox"
                        />
                      ) : canManageSources && isMissingSource ? (
                        <input
                          aria-label={`Chọn nguồn ${labels[student.studentId] ?? student.studentId}`}
                          checked={isSourceSelected}
                          disabled={pending}
                          onChange={event =>
                            setSelectedSourceIds(prev =>
                              event.target.checked
                                ? [...prev, student.studentId]
                                : prev.filter(id => id !== student.studentId)
                            )
                          }
                          type="checkbox"
                        />
                      ) : (
                        <span className="w-4 inline-block" />
                      )}
                      <span className="font-medium text-text-strong">
                        {labels[student.studentId] ?? `Học viên ${student.studentId}`}
                      </span>
                    </label>
                  </td>
                  <td className="p-3 text-center font-mono">{student.sessions}</td>
                  <td className="p-3">
                    {student.issues.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {student.issues.map(issue => (
                          <span className="text-xs text-danger font-medium" key={issue}>
                            • {tuitionBlockerLabels[issue] ?? issue}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-success font-medium">✓ Đủ điều kiện</span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {student.missingRateFrom ? (
                      <span className="text-danger font-semibold">{student.missingRateFrom}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      className="text-xs font-semibold text-action-link hover:underline"
                      href={`/students/${student.studentId}`}
                      target="_blank"
                    >
                      Mở hồ sơ ↗
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-muted">Không tìm thấy học viên phù hợp với bộ lọc hiện tại.</p>
        ) : null}
      </div>
    </section>
  );
}
