import type { CSSProperties } from "react";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ImportSummaryTone = "default" | "success" | "warning" | "danger" | "muted";

export interface ImportSummaryCell {
  /** Says what the number counts, e.g. "Lỗi (phải sửa trong file)"; the tone never replaces it. */
  label: string;
  value: number;
  tone?: ImportSummaryTone;
}

const toneClassName: Record<ImportSummaryTone, string> = {
  danger: "text-danger",
  default: "text-text-strong",
  muted: "text-text-muted",
  success: "text-success",
  warning: "text-warning",
};

/**
 * Import summary strip (design 17c, §4.5): one white card (radius 12, panel
 * shadow) of 4–5 count cells, 12px 16px each with a row-colour rule between
 * them; label 13px muted, value 20/28 semibold tabular in the tone colour.
 * On a container narrower than 640px the cells wrap to two columns. The
 * feature computes the counts; the strip only formats them.
 */
export function ImportSummaryStrip({ cells, label }: { cells: readonly ImportSummaryCell[]; label: string }) {
  return (
    <div className="@container min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <dl
        aria-label={label}
        // The -1px offsets hide the outer edge of each cell's top/left rule, so
        // only the rules between cells show at any column count.
        className="-ml-px -mt-px grid grid-cols-2 @min-[640px]:grid-cols-[repeat(var(--import-summary-cells),minmax(0,1fr))]"
        style={{ "--import-summary-cells": Math.max(cells.length, 1) } as CSSProperties}
      >
        {cells.map((cell) => (
          <div className="min-w-0 border-l border-t border-border-row px-4 py-3" key={cell.label}>
            <dt className="text-secondary text-text-muted">{cell.label}</dt>
            <dd className={cn("text-[20px]/[28px] font-semibold tabular-nums", toneClassName[cell.tone ?? "default"])}>
              {formatNumber(cell.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
