import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Design-file variants (10-thu-vien-component): primary, secondary, ghost,
 * danger-outline, danger-solid (dialog confirm only). `outline` and `danger`
 * are the pre-handoff names still used by features and map onto the new
 * presentation; they stay supported on purpose.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger-outline"
  | "danger-solid"
  | "outline"
  | "danger";

/** 32px (table row, desktop, always labelled) · 40px desktop · 44px touch. */
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Keeps the label, adds a 16px spinner, disables the control. */
  isLoading?: boolean;
  /**
   * Plain-language reason rendered under a disabled button and linked through
   * `aria-describedby`. Features own the wording; the button only shows it.
   */
  disabledReason?: string;
  /** Square control holding one icon. Callers must pass `aria-label`. */
  iconOnly?: boolean;
};

type VariantPresentation = {
  base: string;
  padding: string;
  disabled: string;
  pending: string;
  spinner: string;
};

const variants: Record<ButtonVariant, VariantPresentation> = {
  primary: {
    base:
      "border-transparent bg-action-primary font-medium text-text-on-primary shadow-[var(--action-primary-shadow)] hover:bg-action-primary-hover active:translate-y-px",
    padding: "px-[18px]",
    disabled:
      "disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled disabled:shadow-none",
    pending: "opacity-80",
    spinner: "border-current/40 border-t-current",
  },
  secondary: {
    base:
      "border-border-strong bg-surface-base font-medium text-text-strong hover:border-border-strong-hover hover:bg-interactive-hover",
    padding: "px-[18px]",
    disabled:
      "disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
    pending: "text-text-muted",
    spinner: "border-border-subtle border-t-current",
  },
  outline: {
    base:
      "border-border-subtle bg-surface-base font-medium text-text-strong hover:border-border-strong-hover hover:bg-interactive-hover",
    padding: "px-4",
    disabled:
      "disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
    pending: "text-text-muted",
    spinner: "border-border-subtle border-t-current",
  },
  ghost: {
    base:
      "border-transparent bg-transparent font-semibold text-text-default hover:bg-interactive-hover hover:text-text-strong",
    padding: "px-3",
    disabled: "disabled:bg-transparent disabled:text-text-disabled",
    pending: "text-text-muted",
    spinner: "border-border-subtle border-t-current",
  },
  "danger-outline": {
    base:
      "border-danger bg-surface-base font-semibold text-danger hover:bg-danger-bg",
    padding: "px-4",
    disabled:
      "disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
    pending: "opacity-80",
    spinner: "border-current/40 border-t-current",
  },
  danger: {
    base:
      "border-danger bg-surface-base font-semibold text-danger hover:bg-danger-bg",
    padding: "px-4",
    disabled:
      "disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
    pending: "opacity-80",
    spinner: "border-current/40 border-t-current",
  },
  "danger-solid": {
    base:
      "border-transparent bg-danger font-semibold text-text-on-danger hover:bg-[color-mix(in_srgb,var(--status-danger)_88%,black)] active:translate-y-px",
    padding: "px-4",
    disabled:
      "disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
    pending: "opacity-80",
    spinner: "border-current/40 border-t-current",
  },
};

const sizes: Record<ButtonSize, { base: string; iconOnly: string; padding?: string }> = {
  sm: {
    base: "h-8 rounded-[calc(var(--radius-md)-2px)] text-[13px]/[18px]",
    iconOnly: "w-8",
    padding: "px-3",
  },
  md: { base: "h-10 rounded-md text-control", iconOnly: "w-10" },
  lg: { base: "h-11 rounded-md text-control", iconOnly: "w-11" },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  className,
  size = "md",
  type = "button",
  variant = "primary",
  isLoading = false,
  disabled,
  disabledReason,
  iconOnly = false,
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}, ref) {
  const reasonId = useId();
  const presentation = variants[variant];
  const sizing = sizes[size];
  const isDisabled = Boolean(disabled) || isLoading;
  const showReason = Boolean(disabledReason) && Boolean(disabled) && !isLoading;

  const button = (
    <button
      aria-busy={isLoading || undefined}
      aria-describedby={
        showReason
          ? [ariaDescribedBy, reasonId].filter(Boolean).join(" ")
          : ariaDescribedBy
      }
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus focus-visible:shadow-[0_0_0_5px_var(--focus-ring)] disabled:pointer-events-none",
        presentation.base,
        isLoading ? presentation.pending : presentation.disabled,
        sizing.base,
        iconOnly ? cn("px-0", sizing.iconOnly) : (sizing.padding ?? presentation.padding),
        className,
      )}
      disabled={isDisabled}
      ref={ref}
      type={type}
      {...props}
    >
      {isLoading ? (
        <span
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 animate-spin rounded-full border-2",
            presentation.spinner,
          )}
        />
      ) : null}
      {children}
    </button>
  );

  if (!showReason) {
    return button;
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {button}
      <span className="text-caption text-text-muted" id={reasonId}>
        {disabledReason}
      </span>
    </span>
  );
});
