"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Space reserved before the bar is measured (or where ResizeObserver is missing, e.g. jsdom). */
const FALLBACK_RESERVED_HEIGHT = 96;

/** Same width and side padding as the app shell's <main>, so the bar's contents line up with the page. */
const CONTENT_COLUMN = "mx-auto max-w-[1600px] px-4 md:px-5 lg:px-6";

export interface StickySaveBarProps {
  /** Number of changed fields or cells. 0 = clean. */
  dirtyCount: number;
  /** Labels of the changed fields, shown muted and truncated after the count. */
  changedLabels?: readonly string[];
  /** Replaces the clean text "Chưa có thay đổi" (e.g. "Chưa lưu lần nào"). */
  cleanLabel?: string;
  saveLabel: string;
  savingLabel?: string;
  /** Click handler for `saveType="button"`. */
  onSave?: () => void;
  /** `submit` when the bar sits inside the form it saves. */
  saveType?: "button" | "submit";
  isSaving?: boolean;
  /** Defaults to "nothing changed". Features own every other blocking rule. */
  saveDisabled?: boolean;
  /**
   * Plain-language reason linked to the disabled save button. When omitted the
   * clean text ("Chưa có thay đổi") is the reason.
   */
  saveDisabledReason?: string;
  onCancel: () => void;
  /** Danger result rendered directly above the bar (a `ResultBanner`). */
  error?: ReactNode;
  /**
   * Result line after the state text (e.g. "Đã lưu cài đặt hệ thống."). The bar
   * always renders one polite live region and only its text changes, so screen
   * readers announce the result (a live region mounted together with its text
   * is often not announced). Empty = nothing visible.
   */
  statusMessage?: string;
  /**
   * A second action left of the save button (e.g. "Lưu và thêm tiếp" on a
   * create form). Rendered as a secondary button whenever the save button is,
   * and disabled while saving; the feature owns its other disabled rules and
   * what it does (for a submit bar, typically `form.requestSubmit()` with a
   * flag of its own).
   */
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  /**
   * Replaces the state text ("n thay đổi chưa lưu" / the clean label) in any
   * state, e.g. "Đang nhập · 1 lỗi cần sửa". The changed labels still follow
   * it while dirty, and it stays the fallback reason of a disabled save.
   */
  stateLabel?: string;
  /**
   * Dot colour. `default` (or omitted) keeps the built-in rule: grey when
   * clean, warning when dirty. `warning` and `danger` force that colour.
   */
  stateTone?: "default" | "warning" | "danger";
}

const dotToneClassName = {
  clean: "bg-text-subtle",
  danger: "bg-danger",
  warning: "bg-warning",
} as const;

/**
 * Save bar for long settings forms (design 09a, 17a): fixed to the viewport
 * bottom inside the content column (it never covers the sidebar or rail).
 * Clean: grey dot, "Chưa có thay đổi", save disabled. Dirty: warning dot,
 * "n thay đổi chưa lưu", the changed field names, Hủy and the save button.
 * Long create forms (17a) may add a secondary action ("Lưu và thêm tiếp") and
 * override the state text and dot (e.g. "Đang nhập · 1 lỗi cần sửa", danger).
 * Presentation only: features decide who sees the bar (render it only for
 * people who can save), what counts as a change and what saving does.
 *
 * An in-flow spacer follows the bar's real height (it grows with an error
 * banner or wrapped controls on phones), so the last field always stays
 * reachable; pages add no bottom padding of their own. The same height is
 * published as `--save-bar-h` on <html> (cleared on unmount) so the install
 * prompt sits above the bar. z-[41] keeps the bar above the install prompt
 * (z-40) and below the mobile drawer (z-50) and dialogs (z-[100]). The
 * background spans the content column; its contents line up with <main>
 * (max 1600px, same side padding).
 */
export function StickySaveBar({
  changedLabels = [],
  cleanLabel = "Chưa có thay đổi",
  dirtyCount,
  error,
  isSaving = false,
  onCancel,
  onSave,
  saveDisabled,
  saveDisabledReason,
  saveLabel,
  saveType = "button",
  savingLabel,
  secondaryAction,
  stateLabel,
  stateTone = "default",
  statusMessage = "",
}: StickySaveBarProps) {
  const stateId = useId();
  const reasonId = useId();
  const barRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(FALLBACK_RESERVED_HEIGHT);
  const isDirty = dirtyCount > 0;
  const isSaveDisabled = saveDisabled ?? !isDirty;
  const showReason = isSaveDisabled && !isSaving && Boolean(saveDisabledReason);
  const describedBy = isSaveDisabled && !isSaving ? (showReason ? reasonId : stateId) : undefined;
  const dotTone = stateTone === "default" ? (isDirty ? "warning" : "clean") : stateTone;
  const isSecondaryDisabled = isSaving || Boolean(secondaryAction?.disabled);

  useEffect(() => {
    const element = barRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    // The observer reports the first size right after observe(), then every change.
    const observer = new ResizeObserver(() => {
      setReservedHeight(Math.ceil(element.getBoundingClientRect().height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--save-bar-h", `${reservedHeight}px`);
    return () => {
      root.style.removeProperty("--save-bar-h");
    };
  }, [reservedHeight]);

  return (
    <>
      <div aria-hidden="true" className="shrink-0" style={{ height: reservedHeight }} />
      <div
        aria-label="Thanh lưu thay đổi"
        className="fixed inset-x-0 bottom-0 z-[41] md:left-[var(--rail-w)] xl:left-[var(--sidebar-w)]"
        ref={barRef}
        role="region"
      >
        {error ? <div className={cn(CONTENT_COLUMN, "pb-2")}>{error}</div> : null}
        <div
          className="border-t border-border-subtle bg-surface-base pb-[calc(12px+var(--safe-area-bottom))] pt-3 shadow-[0_-8px_24px_rgba(32,43,64,.08)] transition-[background-color,border-color,box-shadow] duration-150 md:pb-3"
          data-state={isDirty ? "dirty" : "clean"}
        >
          <div className={cn(CONTENT_COLUMN, "flex flex-wrap items-center gap-x-3 gap-y-2")}>
            <span
              aria-hidden="true"
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-colors duration-150",
                dotToneClassName[dotTone],
              )}
              data-tone={dotTone}
            />
            <span className="shrink-0 text-body font-semibold text-text-strong" id={stateId}>
              {stateLabel ?? (isDirty ? `${dirtyCount} thay đổi chưa lưu` : cleanLabel)}
            </span>
            {isDirty && changedLabels.length > 0 ? (
              <span
                className="hidden min-w-0 flex-1 truncate text-secondary text-text-muted sm:block"
                title={changedLabels.join(", ")}
              >
                {changedLabels.join(", ")}
              </span>
            ) : null}
            {showReason ? (
              // Phones: its own full-width line under the controls; sm+: inline after the state.
              <span
                className="order-last min-w-0 basis-full truncate text-secondary text-text-muted sm:order-none sm:basis-auto sm:flex-1"
                id={reasonId}
                title={saveDisabledReason}
              >
                {saveDisabledReason}
              </span>
            ) : null}
            {/* Always mounted (sr-only while empty, so it takes no room); only its text changes. */}
            <p
              aria-live="polite"
              className={statusMessage ? "min-w-0 text-secondary text-text-muted" : "sr-only"}
              role="status"
            >
              {statusMessage}
            </p>
            {/* max-w-full + wrap: three buttons (Hủy, a secondary, save) may not fit one 375px line. */}
            <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
              {isDirty ? (
                <Button
                  className="max-md:h-11"
                  disabled={isSaving}
                  onClick={onCancel}
                  variant="secondary"
                >
                  Hủy
                </Button>
              ) : null}
              {secondaryAction ? (
                <Button
                  // The save's reason covers it when both are disabled for the same reason.
                  aria-describedby={isSecondaryDisabled ? describedBy : undefined}
                  className="max-md:h-11"
                  disabled={isSecondaryDisabled}
                  onClick={secondaryAction.onClick}
                  variant="secondary"
                >
                  {secondaryAction.label}
                </Button>
              ) : null}
              <Button
                aria-describedby={describedBy}
                className="max-md:h-11"
                disabled={isSaveDisabled}
                isLoading={isSaving}
                onClick={saveType === "button" ? onSave : undefined}
                type={saveType}
              >
                {isSaving && savingLabel ? savingLabel : saveLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
