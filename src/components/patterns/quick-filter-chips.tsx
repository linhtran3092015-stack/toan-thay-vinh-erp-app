import { Fragment } from "react";

import { cn } from "@/lib/utils";

export interface QuickFilterChip<T extends string = string> {
  value: T;
  label: string;
  /** Omit when the feature has no count for this chip: no number is shown and the chip is never disabled for it. */
  count?: number;
  /** Text shown instead of `count` (e.g. "212/312"); the number still drives disabling. */
  countLabel?: string;
  /** `danger` renders a non-zero count in the danger colour (e.g. overdue work); the label still says what it is. */
  countTone?: "default" | "danger";
  /** Explicitly disabled by the feature; a zero count also disables the chip unless `disableEmpty` is false. */
  disabled?: boolean;
  /** 1px divider before this chip, separating chip groups. */
  separatorBefore?: boolean;
}

interface QuickFilterChipsProps<T extends string> {
  chips: readonly QuickFilterChip<T>[];
  className?: string;
  /** Disable a chip whose count is 0 (default). Pass false when counts are scoped differently from the list and may lag. */
  disableEmpty?: boolean;
  label: string;
  onChange: (value: T) => void;
  /** Active chip; `null` when the current filters match no single chip. */
  value: T | null;
}

/**
 * 32px count chips (design 06): active = primary border + soft surface. The
 * count is optional: a chip without `count`/`countLabel` shows no number, and
 * `countLabel` replaces the number's text (e.g. "212/312"). A chip with count
 * 0 is disabled unless it is active or the feature passes
 * `disableEmpty={false}` (counts scoped differently from the list);
 * `separatorBefore` draws a divider between chip groups. The feature computes
 * counts and maps the chosen value onto its own filter state.
 */
export function QuickFilterChips<T extends string>({
  chips,
  className,
  disableEmpty = true,
  label,
  onChange,
  value,
}: QuickFilterChipsProps<T>) {
  return (
    <div
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
    >
      {chips.map((chip) => {
        const isActive = chip.value === value;
        const isDisabled = chip.disabled || (disableEmpty && chip.count === 0 && !isActive);
        const hasCount = chip.count !== undefined || chip.countLabel !== undefined;

        return (
          <Fragment key={chip.value}>
            {chip.separatorBefore ? (
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-border-subtle" />
            ) : null}
            <button
              aria-pressed={isActive}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
                isActive
                  ? "border-action-primary bg-action-primary-soft font-semibold text-action-primary"
                  : "border-border-strong bg-surface-base font-medium text-text-default hover:border-border-strong-hover hover:bg-interactive-hover",
              )}
              disabled={isDisabled}
              onClick={() => onChange(chip.value)}
              type="button"
            >
              {chip.label}
              {hasCount ? (
                <span
                  className={cn(
                    "tabular-nums",
                    isActive
                      ? "font-medium"
                      : isDisabled
                        ? ""
                        : chip.countTone === "danger" && (chip.count ?? 0) > 0
                          ? "font-semibold text-danger"
                          : "text-text-muted",
                  )}
                >
                  {chip.countLabel ?? chip.count}
                </span>
              ) : null}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
