"use client";

import { X } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, RefObject, SelectHTMLAttributes } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: ReactNode;
  className?: string;
  /** Number of filters currently applied; the clear button renders only when > 0. */
  activeCount?: number;
  onReset?: () => void;
  label?: string;
  /** Number of filter controls after the search field; sets the design grid. */
  fieldCount?: number;
}

/**
 * Desktop filter bar (design 06): labels above 40px controls, search first,
 * grid `minmax(220px,1.4fr) repeat(n,minmax(0,1fr)) auto`, "Xóa lọc (n)" only when
 * something is filtered. Features own every value and behavior.
 */
export function FilterBar({
  activeCount = 0,
  children,
  className,
  fieldCount,
  label = "Bộ lọc",
  onReset,
}: FilterBarProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "filter-bar grid items-end gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)]",
        className,
      )}
      style={
        fieldCount
          ? { gridTemplateColumns: `minmax(220px, 1.4fr) repeat(${fieldCount}, minmax(0, 1fr)) auto` }
          : undefined
      }
    >
      {children}
      {activeCount > 0 && onReset ? (
        <Button
          className="text-action-primary hover:text-action-primary-hover"
          onClick={onReset}
          variant="ghost"
        >
          Xóa lọc <span className="font-medium tabular-nums">({activeCount})</span>
        </Button>
      ) : null}
    </section>
  );
}

interface FilterFieldProps {
  children: ReactNode;
  className?: string;
  label: string;
}

/** Label on top (13/500), control below. */
export function FilterField({ children, className, label }: FilterFieldProps) {
  return (
    <label className={cn("grid min-w-0 gap-1.5 text-label font-medium text-text-strong", className)}>
      {label}
      {children}
    </label>
  );
}

const controlClassName =
  "h-10 w-full min-w-0 rounded-md border bg-field-bg px-3 text-body font-normal text-text-strong outline-none placeholder:text-field-placeholder focus:border-border-focus focus:shadow-[0_0_0_3px_var(--focus-ring)]";

interface FilterSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** True when the select narrows the result: primary border + soft surface. */
  active?: boolean;
}

export function FilterSelect({ active = false, className, ...props }: FilterSelectProps) {
  return (
    <select
      className={cn(
        controlClassName,
        active ? "border-action-primary bg-action-primary-soft" : "border-border-strong",
        className,
      )}
      data-active={active || undefined}
      {...props}
    />
  );
}

interface FilterInputProps extends InputHTMLAttributes<HTMLInputElement> {
  active?: boolean;
}

export function FilterInput({ active = false, className, ...props }: FilterInputProps) {
  return (
    <input
      className={cn(
        controlClassName,
        active ? "border-action-primary bg-action-primary-soft" : "border-border-strong",
        className,
      )}
      data-active={active || undefined}
      {...props}
    />
  );
}

interface FilterTriggerProps {
  activeCount: number;
  className?: string;
  onClick: () => void;
  ref?: RefObject<HTMLButtonElement | null>;
}

/** Mobile "Bộ lọc · n" button that opens the sheet. */
export function FilterTrigger({ activeCount, className, onClick, ref }: FilterTriggerProps) {
  const isActive = activeCount > 0;

  return (
    <button
      aria-label={isActive ? `Bộ lọc, ${activeCount} đang áp dụng` : "Bộ lọc"}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-3 text-control font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        isActive
          ? "border-action-primary bg-action-primary-soft text-action-primary"
          : "border-border-strong bg-surface-base text-text-strong hover:bg-interactive-hover",
        className,
      )}
      onClick={onClick}
      ref={ref}
      type="button"
    >
      {isActive ? `Bộ lọc · ${activeCount}` : "Bộ lọc"}
    </button>
  );
}

interface FilterSheetProps {
  activeCount: number;
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  resetTestId?: string;
  /** e.g. "Xem 22 học sinh" */
  resultLabel: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Noun used in the empty subtitle, e.g. "học viên". */
  subject: string;
  titleId: string;
}

/**
 * Mobile bottom sheet with the same fields as the bar: handle, "Bộ lọc · n
 * đang áp dụng", "Xóa tất cả", then Đóng + "Xem n kết quả".
 */
export function FilterSheet({
  activeCount,
  children,
  isOpen,
  onClose,
  onReset,
  resetTestId,
  resultLabel,
  returnFocusRef,
  subject,
  titleId,
}: FilterSheetProps) {
  return (
    <Dialog
      ariaLabelledBy={titleId}
      className="flex max-h-[92vh] flex-col rounded-t-xl sm:max-w-[420px] sm:rounded-xl"
      isOpen={isOpen}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong-hover sm:hidden" />
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
        <div>
          <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
            Bộ lọc
          </h2>
          <p className="text-caption text-text-muted">
            {activeCount > 0 ? `${activeCount} bộ lọc đang áp dụng` : `Lọc danh sách ${subject} hiện có`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {activeCount > 0 ? (
            <Button className="text-action-primary" data-testid={resetTestId} onClick={onReset} variant="ghost">
              Xóa tất cả
            </Button>
          ) : null}
          <button
            aria-label="Đóng bộ lọc"
            className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-interactive-hover hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>
        </div>
      </div>
      <div className="grid flex-1 gap-4 overflow-y-auto px-4 py-2 [&_input]:h-11 [&_select]:h-11">{children}</div>
      <div className="flex gap-2 border-t border-border-subtle px-4 py-3">
        <Button className="flex-1" onClick={onClose} size="lg" variant="secondary">
          Đóng
        </Button>
        <Button className="flex-1" onClick={onClose} size="lg">
          {resultLabel}
        </Button>
      </div>
    </Dialog>
  );
}
