"use client";

import { LoaderCircle } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";

/** Next owns pending state, including cancellation, prefetch hits and modified clicks. */
export function NavigationLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <NavigationPending />
    </Link>
  );
}

function NavigationPending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return createPortal(
    <div className="navigation-pending pointer-events-none fixed inset-0 z-[70] print:hidden">
      <div aria-hidden="true" className="h-1 overflow-hidden bg-action-primary-soft">
        <div className="navigation-pending-bar h-full w-1/3 rounded-r-full bg-action-primary" />
      </div>
      <div aria-atomic="true" className="absolute bottom-5 right-4 flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 text-sm font-medium text-text-strong shadow-[var(--elevation-2)]" role="status">
        <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin" />
        Đang mở mô-đun…
      </div>
    </div>,
    document.body,
  );
}
