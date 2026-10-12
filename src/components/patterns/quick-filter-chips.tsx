import { cn } from "@/lib/utils";

export interface QuickFilterChip<T extends string = string> {
  value: T;
  label: string;
  count: number;
  /** Explicitly disabled by the feature; a zero count also disables the chip. */
  disabled?: boolean;
}

interface QuickFilterChipsProps<T extends string> {
  chips: readonly QuickFilterChip<T>[];
  className?: string;
  label: string;
  onChange: (value: T) => void;
  value: T;
}

/**
 * 32px count chips (design 06): active = primary border + soft surface;
 * a chip with count 0 is disabled. The feature computes counts and maps the
 * chosen value onto its own filter state.
 */
export function QuickFilterChips<T extends string>({
  chips,
  className,
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
        const isDisabled = chip.disabled || (chip.count === 0 && !isActive);

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
              isActive
                ? "border-action-primary bg-action-primary-soft font-semibold text-action-primary"
                : "border-border-strong bg-surface-base font-medium text-text-default hover:border-border-strong-hover hover:bg-interactive-hover",
            )}
            disabled={isDisabled}
            key={chip.value}
            onClick={() => onChange(chip.value)}
            type="button"
          >
            {chip.label}
            <span
              className={cn(
                "tabular-nums",
                isActive ? "font-medium" : isDisabled ? "" : "text-text-muted",
              )}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
