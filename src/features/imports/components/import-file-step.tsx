"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";

import { Button, getButtonClassName } from "@/components/ui/button";
import { ResultBanner } from "@/components/shared/result-banner";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ImportFileFacts {
  name: string;
  /** Worksheet(s) read, e.g. "HocSinh" or "Classes · Schedules". */
  sheet?: string;
  rows: number;
  sha256?: string;
}

export interface ImportFileStepProps {
  /** Id of the real `<input type="file">`; `getByLabelText(label)` returns it. */
  inputId: string;
  /** Visible text of the label button, e.g. "Chọn file Excel". */
  label: string;
  /** The input's `accept` (a dropped file bypasses it: the feature still validates). */
  accept: string;
  /** The pipeline's real limits, e.g. "Chỉ nhận .xlsx, tối đa 5 MB và 500 dòng dữ liệu." */
  limitsText: string;
  /** Template download control, shown in the card footer. */
  templateAction?: ReactNode;
  /** Facts of the file already read; `null`/absent shows the drop zone. */
  file?: ImportFileFacts | null;
  /** Read/format error, shown inside the card (danger banner). */
  error?: string | null;
  /** The feature is reading the file: a skeleton holds the card's shape. */
  isReading?: boolean;
  onFileSelected: (file: File) => void;
  /**
   * "Chọn file khác" while a file is set: the feature clears the file and
   * every later step. Without it, "Chọn file khác" opens the picker directly.
   */
  onReset?: () => void;
}

/** First 12 hex characters, enough to tell two files apart on screen. */
function shortSha256(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

/**
 * Step "chọn file" of an import wizard (design 17c, notes "Đang đọc file:
 * skeleton", "File sai định dạng: lỗi inline ở bước 1"). One real file input
 * (visually hidden, keyboard-focusable; its visible label is a secondary
 * button that shows the focus ring), a dashed drop zone that really accepts
 * a dropped file, the file facts (Tên file, Trang tính, Số dòng, SHA-256
 * short with the full value in `title`) once read, and the error and reading
 * states inside the same card. Presentation only: the feature parses and
 * validates the file.
 */
export function ImportFileStep({
  accept,
  error,
  file,
  inputId,
  isReading = false,
  label,
  limitsText,
  onFileSelected,
  onReset,
  templateAction,
}: ImportFileStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const limitsId = `${inputId}-limits`;
  const errorId = `${inputId}-error`;
  const labelButtonClassName = getButtonClassName({
    className:
      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-focus peer-focus-visible:shadow-[0_0_0_5px_var(--focus-ring)]",
    variant: "secondary",
  });

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    // Cleared so picking the same file again (after fixing it) fires a change.
    event.target.value = "";
    if (selected) onFileSelected(selected);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Moving onto a child of the zone is not leaving it.
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  }

  // Rendered only next to its visible label (never while reading or behind
  // the "Chọn file khác" reset button), so it is never an unlabelled stop.
  const input = (
    <input
      accept={accept}
      aria-describedby={error ? `${limitsId} ${errorId}` : limitsId}
      className="peer sr-only"
      id={inputId}
      onChange={handleChange}
      type="file"
    />
  );

  return (
    <div className="@container min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <div className="grid gap-4 p-5">
        {isReading ? (
          <div aria-busy="true" className="grid gap-3 rounded-md border border-dashed border-border-strong p-3" role="status">
            <div aria-hidden="true" className="grid gap-2 motion-safe:animate-pulse">
              <div className="h-3 w-2/5 rounded-sm bg-surface-sunken" />
              <div className="h-3 w-[70%] rounded-sm bg-surface-sunken" />
              <div className="h-3 w-[55%] rounded-sm bg-surface-sunken" />
            </div>
            <p className="text-caption text-text-muted">Đang đọc file…</p>
          </div>
        ) : file ? (
          <div className="flex flex-col gap-4 @min-[720px]:flex-row @min-[720px]:items-start">
            <dl className="grid min-w-0 flex-1 gap-3 @min-[480px]:grid-cols-2 @min-[960px]:grid-cols-4">
              <FileFact label="Tên file">
                <span className="break-all">{file.name}</span>
              </FileFact>
              {file.sheet ? <FileFact label="Trang tính">{file.sheet}</FileFact> : null}
              <FileFact label="Số dòng">
                <span className="tabular-nums">{formatNumber(file.rows)}</span>
              </FileFact>
              {file.sha256 ? (
                <FileFact label="SHA-256">
                  <span className="font-mono text-secondary font-normal" title={file.sha256}>
                    {shortSha256(file.sha256)}
                  </span>
                </FileFact>
              ) : null}
            </dl>
            {onReset ? (
              <Button className="self-start" onClick={onReset} variant="secondary">
                Chọn file khác
              </Button>
            ) : (
              <div className="self-start">
                {input}
                <label className={labelButtonClassName} htmlFor={inputId}>
                  Chọn file khác
                </label>
              </div>
            )}
            <p className="sr-only" id={limitsId}>
              {limitsText}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "grid justify-items-center gap-3 rounded-md border border-dashed px-4 py-8 text-center",
              isDragging ? "border-action-primary bg-action-primary-soft" : "border-border-strong bg-surface-base",
            )}
            data-dragging={isDragging || undefined}
            data-testid={`${inputId}-dropzone`}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <FileSpreadsheet aria-hidden="true" className="text-text-muted" size={28} strokeWidth={1.75} />
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              <span className="text-body text-text-default">Kéo thả file vào khung này hoặc</span>
              <span>
                {input}
                <label className={labelButtonClassName} htmlFor={inputId}>
                  {label}
                </label>
              </span>
            </div>
            <p className="max-w-xl text-secondary text-text-muted" id={limitsId}>
              {limitsText}
            </p>
          </div>
        )}

        {error ? (
          <div id={errorId}>
            <ResultBanner description={error} title="Không dùng được file này." tone="error" />
          </div>
        ) : null}
      </div>

      {templateAction ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border-row px-4 py-2.5">{templateAction}</div>
      ) : null}
    </div>
  );
}

function FileFact({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-semibold text-text-strong">{children}</dd>
    </div>
  );
}
