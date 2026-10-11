"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  executeBulkStudentStatusTransitionAction,
  previewBulkStudentStatusTransitionAction,
} from "@/features/students/bulk-status-actions";
import { studentStatusOptions } from "@/features/students/student-filters";
import { bulkTransitionStatuses } from "@/features/students/bulk-status-types";

const bulkStatusOptions = studentStatusOptions.filter((opt) =>
  (bulkTransitionStatuses as readonly string[]).includes(opt.value),
);
import type { StudentLifecycleStatus } from "@/types/domain";

interface BulkStatusTransitionDialogProps {
  initialSourceStatus?: StudentLifecycleStatus | "all";
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (affectedCount: number) => void;
  selectedStudentIds?: string[];
}

function getStatusLabel(status: string): string {
  const found = studentStatusOptions.find((opt) => opt.value === status);
  return found ? found.label : status;
}

export function BulkStatusTransitionDialog({
  initialSourceStatus = "interested",
  isOpen,
  onClose,
  onSuccess,
  selectedStudentIds = [],
}: BulkStatusTransitionDialogProps) {
  const defaultSource: StudentLifecycleStatus =
    initialSourceStatus !== "all" ? initialSourceStatus : "interested";

  const [sourceStatus, setSourceStatus] =
    useState<StudentLifecycleStatus>(defaultSource);
  const [targetStatus, setTargetStatus] = useState<StudentLifecycleStatus>(
    defaultSource === "interested" ? "trial_booked" : "interested",
  );
  const [reason, setReason] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const isSpecificSelection = selectedStudentIds.length > 0;

  const validTargetOptions = useMemo(
    () => bulkStatusOptions.filter((opt) => opt.value !== sourceStatus),
    [sourceStatus],
  );

  function resetState(): void {
    setPreviewCount(null);
    setActionError(null);
    setSuccessMessage(null);
    setReason("");
  }

  function handleSourceChange(newSource: StudentLifecycleStatus): void {
    setSourceStatus(newSource);
    if (targetStatus === newSource) {
      const fallback = studentStatusOptions.find(
        (opt) => opt.value !== newSource,
      );
      if (fallback) setTargetStatus(fallback.value);
    }
    resetState();
  }

  function handleTargetChange(newTarget: StudentLifecycleStatus): void {
    setTargetStatus(newTarget);
    resetState();
  }

  async function handlePreview(): Promise<void> {
    setActionError(null);
    setSuccessMessage(null);
    setIsPreviewing(true);

    try {
      const res = await previewBulkStudentStatusTransitionAction({
        sourceStatus,
        studentIds: isSpecificSelection ? selectedStudentIds : undefined,
      });

      if (!res.ok) {
        setActionError(res.message);
        setPreviewCount(null);
        return;
      }

      setPreviewCount(res.data.count);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Không thể tải thông tin xem trước. Vui lòng thử lại.";
      setActionError(msg);
      setPreviewCount(null);
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleExecute(): Promise<void> {
    if (previewCount === null || previewCount < 0) {
      setActionError("Vui lòng thực hiện Preview trước khi xác nhận.");
      return;
    }

    setActionError(null);
    setSuccessMessage(null);
    setIsExecuting(true);

    try {
      const res = await executeBulkStudentStatusTransitionAction({
        expectedCount: previewCount,
        reason: reason.trim() || undefined,
        sourceStatus,
        studentIds: isSpecificSelection ? selectedStudentIds : undefined,
        targetStatus,
      });

      if (!res.ok) {
        setActionError(res.message);
        return;
      }

      setSuccessMessage(
        `Đã chuyển thành công ${res.data.affectedCount} học sinh sang "${getStatusLabel(res.data.targetStatus)}".`,
      );

      if (onSuccess) {
        onSuccess(res.data.affectedCount);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Không thể thực thi chuyển trạng thái. Vui lòng thử lại.";
      setActionError(msg);
    } finally {
      setIsExecuting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface-1 p-6 shadow-xl space-y-5">
        <header className="space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-ink">
              Chuyển trạng thái học viên hàng loạt
            </h2>
            <button
              className="text-ink-subtle hover:text-ink transition-colors p-1 rounded-md"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-ink-subtle">
            Chỉ cập nhật trạng thái vòng đời học viên (`student_status`). Đảm bảo an toàn giao dịch All-or-Nothing.
          </p>
        </header>

        {successMessage ? (
          <div className="rounded-md border border-success/30 bg-success/5 p-4 text-sm text-success font-medium space-y-3">
            <p>✅ {successMessage}</p>
            <div className="flex justify-end">
              <Button onClick={onClose} size="sm" variant="primary">
                Hoàn tất
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Range selection info */}
            <div className="rounded-md border border-info/20 bg-info/5 p-3 text-xs text-ink space-y-1">
              <p className="font-semibold text-info">Phạm vi áp dụng:</p>
              {isSpecificSelection ? (
                <p>• Đã chọn cụ thể: <strong>{selectedStudentIds.length}</strong> học sinh.</p>
              ) : (
                <p>• Áp dụng cho: <strong>Tất cả học sinh</strong> ở trạng thái nguồn bên dưới.</p>
              )}
            </div>

            {/* Source and Target Status selectors */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink" htmlFor="source-status-select">
                  Trạng thái hiện tại (Nguồn) <span className="text-danger">*</span>
                </label>
                <select
                  className="h-9 w-full rounded-md border border-hairline bg-surface-1 px-3 text-xs text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  id="source-status-select"
                  onChange={(e) =>
                    handleSourceChange(e.target.value as StudentLifecycleStatus)
                  }
                  value={sourceStatus}
                >
                  {bulkStatusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink" htmlFor="target-status-select">
                  Trạng thái đích (Chuyển sang) <span className="text-danger">*</span>
                </label>
                <select
                  className="h-9 w-full rounded-md border border-hairline bg-surface-1 px-3 text-xs text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  id="target-status-select"
                  onChange={(e) =>
                    handleTargetChange(e.target.value as StudentLifecycleStatus)
                  }
                  value={targetStatus}
                >
                  {validTargetOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview trigger & Summary display */}
            <div className="rounded-md border border-hairline bg-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">
                  Bước 1: Tải số lượng xem trước (Read-Only)
                </span>
                <Button
                  disabled={isPreviewing || isExecuting}
                  isLoading={isPreviewing}
                  onClick={handlePreview}
                  size="sm"
                  variant="secondary"
                >
                  Preview chuyển trạng thái
                </Button>
              </div>

              {previewCount !== null ? (
                <div className="rounded border border-primary/30 bg-surface-1 p-3 text-xs text-ink space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Kết quả Preview:</span>
                    <Badge tone="info">{previewCount} học sinh</Badge>
                  </div>
                  <p className="text-ink-subtle">
                    Có <strong>{previewCount}</strong> học sinh đang ở trạng thái{" "}
                    <span className="font-semibold text-ink">&quot;{getStatusLabel(sourceStatus)}&quot;</span>.
                    Bạn đang chuẩn bị chuyển toàn bộ sang{" "}
                    <span className="font-semibold text-primary">&quot;{getStatusLabel(targetStatus)}&quot;</span>.
                  </p>
                  <p className="text-xs text-warning font-medium">
                    🔒 Không tạo lớp, enrollment, học phí, lịch học hoặc dữ liệu nghiệp vụ khác.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Reason input */}
            {previewCount !== null ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink" htmlFor="bulk-reason-input">
                  Ghi chú / Lý do chuyển (Audit Trail)
                </label>
                <input
                  className="h-9 w-full rounded-md border border-hairline bg-surface-1 px-3 text-xs text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  id="bulk-reason-input"
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập ghi chú lý do thực hiện batch này..."
                  type="text"
                  value={reason}
                />
              </div>
            ) : null}

            {actionError ? (
              <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-xs text-danger font-medium space-y-1">
                <p className="font-bold">❌ Thao tác không thành công:</p>
                <p>{actionError}</p>
              </div>
            ) : null}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
              <Button disabled={isExecuting} onClick={onClose} size="sm" variant="outline">
                Hủy bỏ
              </Button>
              <Button
                disabled={
                  isExecuting ||
                  previewCount === null ||
                  previewCount === 0 ||
                  isPreviewing
                }
                isLoading={isExecuting}
                onClick={handleExecute}
                size="sm"
                variant="primary"
              >
                {previewCount !== null
                  ? `Xác nhận chuyển ${previewCount} học sinh`
                  : "Xác nhận chuyển"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
