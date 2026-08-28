"use client";

import {
  ArrowLeft,
  Check,
  Eye,
  History,
  Loader2,
  Save,
  Send,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";

interface EditorToolbarProps {
  hasUnsavedChanges: boolean;
  isDraft: boolean;
  isSaving: boolean;
  onOpenHistory: () => void;
  onOpenPresets: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onZoomChange: (zoom: number) => void;
  templateName: string;
  versionNumber: number;
  zoom: number;
}

export function EditorToolbar({
  hasUnsavedChanges,
  isDraft,
  isSaving,
  onOpenHistory,
  onOpenPresets,
  onPublish,
  onSaveDraft,
  onZoomChange,
  templateName,
  versionNumber,
  zoom,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-base px-4 py-3 shadow-xs">
      {/* Left: Back & Template Info */}
      <div className="flex items-center gap-3">
        <Link
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
          href="/payroll/settings/payslip-templates"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Danh sách mẫu</span>
        </Link>
        <div className="h-4 w-px bg-hairline" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-ink">{templateName}</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
              {isDraft ? `Bản nháp v${versionNumber}` : `Đã xuất bản v${versionNumber}`}
            </span>
            {hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                Chưa lưu
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Center: Zoom controls */}
      <div className="flex items-center gap-1 rounded-xl border border-hairline bg-surface-subtle p-1">
        <button
          className="rounded-lg p-1 text-ink-muted hover:bg-surface-base hover:text-ink cursor-pointer disabled:opacity-40"
          disabled={zoom <= 75}
          onClick={() => onZoomChange(Math.max(75, zoom - 25))}
          title="Thu nhỏ"
          type="button"
        >
          <ZoomOut className="size-3.5" />
        </button>
        <span className="px-2 text-xs font-semibold text-ink min-w-[42px] text-center">
          {zoom}%
        </span>
        <button
          className="rounded-lg p-1 text-ink-muted hover:bg-surface-base hover:text-ink cursor-pointer disabled:opacity-40"
          disabled={zoom >= 125}
          onClick={() => onZoomChange(Math.min(125, zoom + 25))}
          title="Phóng to"
          type="button"
        >
          <ZoomIn className="size-3.5" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-base px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
          onClick={onOpenPresets}
          title="Áp dụng mẫu có sẵn"
          type="button"
        >
          <Sparkles className="size-3.5 text-amber-500" />
          <span className="hidden md:inline">Mẫu có sẵn</span>
        </button>

        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-base px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
          onClick={onOpenHistory}
          title="Lịch sử phiên bản"
          type="button"
        >
          <History className="size-3.5 text-ink-muted" />
          <span className="hidden md:inline">Lịch sử phiên bản</span>
        </button>

        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-base px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-subtle transition-colors cursor-pointer disabled:opacity-50"
          disabled={isSaving}
          onClick={onSaveDraft}
          type="button"
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5 text-ink-muted" />
          )}
          Lưu nháp
        </button>

        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-hover transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          disabled={isSaving}
          onClick={onPublish}
          type="button"
        >
          <Send className="size-3.5" />
          Xuất bản
        </button>
      </div>
    </div>
  );
}
