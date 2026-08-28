"use client";

import { CheckCircle2, Clock, History, RotateCcw, X } from "lucide-react";

import type { PayslipTemplateVersionSummary } from "@/features/payroll/payslip-template/types";
import { formatDate } from "@/features/payroll/payroll-presentation";

interface TemplateVersionHistoryProps {
  currentVersionNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectVersion: (versionNumber: number) => void;
  templateName: string;
  versions: PayslipTemplateVersionSummary[];
}

export function TemplateVersionHistoryDialog({
  currentVersionNumber,
  isOpen,
  onClose,
  onSelectVersion,
  templateName,
  versions,
}: TemplateVersionHistoryProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-hairline bg-surface-base p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-ink">
                Lịch sử phiên bản
              </h3>
              <p className="text-xs text-ink-muted">
                Mẫu: &ldquo;{templateName}&rdquo;
              </p>
            </div>
          </div>
          <button
            className="text-ink-muted hover:text-ink cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          Các phiên bản đã xuất bản là bất biến (immutable) để đảm bảo tính chính xác cho các phiếu lương đã chốt trong quá khứ.
        </p>

        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {versions.map((v) => {
            const isCurrent = v.versionNumber === currentVersionNumber;

            return (
              <div
                className={`flex items-center justify-between rounded-xl border p-3.5 transition-colors ${
                  isCurrent
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-hairline bg-surface-subtle/40 hover:bg-surface-subtle"
                }`}
                key={v.id}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">
                      Phiên bản v{v.versionNumber}
                    </span>
                    {v.status === "published" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="size-2.5" />
                        Đã xuất bản
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                        <Clock className="size-2.5" />
                        Bản nháp
                      </span>
                    )}
                    {isCurrent ? (
                      <span className="text-[10px] font-semibold text-primary">
                        (Đang mở)
                      </span>
                    ) : null}
                  </div>

                  <p className="text-[11px] text-ink-muted">
                    Tạo bởi {v.createdByName || v.createdByEmail || "Hệ thống"} vào{" "}
                    {formatDate(v.createdAt)}
                    {v.publishedAt ? ` • Xuất bản lúc ${formatDate(v.publishedAt)}` : ""}
                  </p>
                </div>

                {!isCurrent ? (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-base px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
                    onClick={() => {
                      onSelectVersion(v.versionNumber);
                      onClose();
                    }}
                    type="button"
                  >
                    <RotateCcw className="size-3 text-ink-muted" />
                    Xem / Khôi phục
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-hairline">
          <button
            className="rounded-xl border border-hairline bg-surface-base px-4 py-2 text-xs font-medium text-ink hover:bg-surface-subtle cursor-pointer"
            onClick={onClose}
            type="button"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
