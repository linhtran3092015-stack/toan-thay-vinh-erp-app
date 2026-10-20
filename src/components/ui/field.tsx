"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

const controlChromeClassName =
  "w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition placeholder:text-text-subtle focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring aria-[invalid=true]:border-danger disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

/** One control height (44px on touch, 40px on desktop) and one focus ring for every form. */
export const controlClassName = `min-h-11 ${controlChromeClassName} md:min-h-10`;

/**
 * Same chrome without the single-line height: cn() does not merge classes, so
 * `md:min-h-10` would beat any `min-h-*` a textarea adds from 768px up.
 */
const textareaChromeClassName = `${controlChromeClassName} py-2`;

/** Textarea chrome with its default 80px minimum, for raw `<textarea>`s that do not use `Textarea`. */
export const textareaClassName = `${textareaChromeClassName} min-h-20`;

/** An unprefixed `min-h-*` from the caller replaces the default (a shorter one would otherwise lose to min-h-20 by CSS order). */
const OWN_MIN_HEIGHT = /(^|\s)min-h-/;

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }>(
  function Label({ children, className, required, ...props }, ref) {
    return (
      <label
        className={cn(
          "text-label font-medium text-text-strong",
          // The asterisk is decorative CSS so label text stays clean for assistive tech and tests.
          required && "after:ml-0.5 after:text-danger after:content-['*']",
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </label>
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input className={cn(controlClassName, className)} ref={ref} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select className={cn(controlClassName, className)} ref={ref} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        className={cn(textareaChromeClassName, !OWN_MIN_HEIGHT.test(className ?? "") && "min-h-20", className)}
        ref={ref}
        {...props}
      />
    );
  },
);

interface FieldProps {
  children: (controlProps: { "aria-describedby"?: string; "aria-invalid"?: true; id: string }) => ReactNode;
  className?: string;
  error?: string | null;
  hint?: string;
  label: string;
  required?: boolean;
}

/**
 * Label + control + hint/error wiring. The child render-prop receives the id
 * and aria attributes so any control (Input, Select, Textarea, custom) stays
 * accessible without repeating the plumbing.
 */
export function Field({ children, className, error, hint, label, required }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children({ "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}), id })}
      {error ? (
        <p className="text-caption text-danger" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
