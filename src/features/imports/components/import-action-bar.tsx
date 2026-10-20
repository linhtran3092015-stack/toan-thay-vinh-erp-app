import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export interface ImportActionBarBack {
  /** Name of the previous step, e.g. "Ánh xạ cột"; shown as "← Ánh xạ cột". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

type ImportActionBarReason =
  | {
      /**
       * Why the primary is disabled, as the design places it: 12px muted,
       * right-aligned under the bar. The caller gives its primary
       * `aria-describedby={reasonId}` (and renders this only while disabled).
       */
      reason: string;
      reasonId: string;
    }
  | { reason?: undefined; reasonId?: undefined };

export type ImportActionBarProps = ImportActionBarReason & {
  /** Consequence of the step in words (13px), e.g. "Còn 2 lỗi. Sửa file Excel rồi chọn lại file." */
  text: ReactNode;
  back?: ImportActionBarBack;
  /** The step's single primary (usually a `Button`); the feature decides availability. */
  primary: ReactNode;
};

/**
 * Wizard action bar (design 17c, §4.7): a static white card with the
 * consequence text, "← {previous step}" (secondary; accessible name
 * "Quay lại bước {label}") and the step's one primary.
 *
 * Disabled reason, two ways: pass the primary as a `Button` with
 * `disabledReason` (the button shows and wires its own reason under itself),
 * or pass `reason` + `reasonId` here for the design's placement under the
 * bar and set `aria-describedby={reasonId}` on the primary.
 */
export function ImportActionBar({ back, primary, reason, reasonId, text }: ImportActionBarProps) {
  return (
    <div className="@container min-w-0">
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)] @min-[640px]:flex-row @min-[640px]:items-center">
        <div className="min-w-0 flex-1 text-secondary text-text-default">{text}</div>
        {/* 44px touch targets on phones for the back button and whichever primary the feature passes. */}
        <div className="flex flex-wrap items-center gap-2 max-md:[&_a]:h-11 max-md:[&_button]:h-11 @min-[640px]:shrink-0 @min-[640px]:justify-end">
          {back ? (
            <Button disabled={back.disabled} onClick={back.onClick} variant="secondary">
              <span aria-hidden="true">←</span>
              <span>
                <span className="sr-only">Quay lại bước</span> {back.label}
              </span>
            </Button>
          ) : null}
          {primary}
        </div>
      </div>
      {reason ? (
        <p className="mt-1.5 text-caption text-text-muted @min-[640px]:text-right" id={reasonId}>
          {reason}
        </p>
      ) : null}
    </div>
  );
}
