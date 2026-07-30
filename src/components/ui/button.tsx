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
    "border-primary bg-primary text-white hover:bg-primary-strong shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:shadow-none",
  secondary:
    "border-secondary bg-secondary text-white hover:bg-secondary-strong shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:shadow-none",
  outline:
    "border-hairline bg-surface-1 text-ink hover:border-hairline-strong hover:bg-surface-2 active:scale-[0.98] disabled:text-ink-subtle disabled:bg-surface-2",
  ghost:
    "border-transparent bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-[0.98] disabled:text-ink-subtle",
  danger:
    "border-danger bg-danger text-white hover:bg-danger/90 shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:shadow-none",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-11 px-5 text-base rounded-lg",
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
        "inline-flex items-center justify-center gap-2 border font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
