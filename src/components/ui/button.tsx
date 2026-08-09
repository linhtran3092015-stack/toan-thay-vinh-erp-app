import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-action-primary bg-action-primary text-text-on-primary hover:bg-action-primary-hover disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
  secondary:
    "border-border-strong bg-surface-base text-text-strong hover:bg-interactive-hover disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
  outline:
    "border-border-subtle bg-surface-base text-text-strong hover:border-border-strong hover:bg-interactive-hover disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
  ghost:
    "border-transparent bg-transparent text-text-muted hover:bg-interactive-hover hover:text-text-strong disabled:text-text-disabled",
  danger:
    "border-danger bg-danger text-text-on-danger hover:bg-danger/90 disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 rounded-md px-3 text-control",
  md: "h-10 rounded-md px-4 text-control",
  lg: "h-11 rounded-md px-5 text-control",
};

export function Button({
  className,
  size = "md",
  type = "button",
  variant = "primary",
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 border font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      type={type}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
