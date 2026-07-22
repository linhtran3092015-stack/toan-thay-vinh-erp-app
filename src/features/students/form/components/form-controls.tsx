import type { ReactNode } from "react";
import type { FieldErrors } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { StudentFormValues } from "../student-form-schema";

interface FieldShellProps {
  children: ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  required?: boolean;
}

export function FieldShell({
  children,
  error,
  hint,
  id,
  label,
  required,
}: FieldShellProps) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-sm font-semibold text-ink-muted" htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs leading-5 text-ink-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs font-semibold leading-5 text-danger" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function fieldControlClass(error?: string, className?: string) {
  return cn(
    "min-h-11 w-full min-w-0 rounded-md border bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:bg-neutral-bg disabled:text-ink-muted",
    error ? "border-danger" : "border-hairline",
    className,
  );
}

export function textAreaControlClass(error?: string, className?: string) {
  return fieldControlClass(error, cn("min-h-24 py-2 leading-6", className));
}

export function getFieldError(
  errors: FieldErrors<StudentFormValues>,
  name: keyof StudentFormValues,
): string | undefined {
  const error = errors[name];

  return typeof error?.message === "string" ? error.message : undefined;
}

export function describedBy(id: string, error?: string, hint?: string) {
  if (error) {
    return `${id}-error`;
  }

  return hint ? `${id}-hint` : undefined;
}
