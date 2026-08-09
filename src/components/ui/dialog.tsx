"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "@/lib/utils";

interface DialogProps {
  ariaDescribedBy?: string;
  ariaLabelledBy: string;
  children: ReactNode;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Domain-agnostic modal presentation with keyboard containment. Features own
 * whether a dialog may close and all confirmation/action behavior.
 */
export function Dialog({
  ariaDescribedBy,
  ariaLabelledBy,
  children,
  className,
  initialFocusRef,
  isOpen,
  onClose,
  returnFocusRef,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const returnFocusTarget = returnFocusRef?.current;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const frame = window.requestAnimationFrame(() => {
      const focusTarget =
        initialFocusRef?.current ??
        dialogRef.current?.querySelector<HTMLElement>(focusableSelector) ??
        dialogRef.current;

      focusTarget?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      (returnFocusTarget ?? previousFocusRef.current)?.focus();
    };
  }, [initialFocusRef, isOpen, returnFocusRef]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--overlay-scrim)] p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className={cn(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-surface-base shadow-[var(--elevation-3)] outline-none sm:rounded-xl",
          className,
        )}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }

          if (event.key !== "Tab") {
            return;
          }

          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
          );

          if (focusable.length === 0) {
            event.preventDefault();
            dialogRef.current?.focus();
            return;
          }

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
