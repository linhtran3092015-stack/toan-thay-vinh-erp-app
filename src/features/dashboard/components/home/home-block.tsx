import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Text link sized for touch below md (44px) and compact on desktop. The colour
 * is important: the unlayered global `a { color: inherit }` beats utilities.
 */
export const homeLinkClassName =
  "inline-flex min-h-11 items-center text-secondary font-medium text-action-link! hover:underline md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

/**
 * Panel frame for one dashboard block (design 02): 12px radius, subtle border,
 * 1px shadow, header row with title, optional count and one link. Empty and
 * error content stay inside this frame; a block whose source the viewer may
 * not read is not rendered at all.
 */
export function HomeBlock({
  action,
  children,
  className,
  count,
  subtitle,
  title,
  titleId,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Pending-work count next to the title; announced with its own label. */
  count?: { label: string; value: number | string };
  subtitle?: ReactNode;
  title: ReactNode;
  titleId: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn("panel-rise min-w-0 rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border-row px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-body font-semibold text-text-strong" id={titleId}>
            {title}
          </h2>
          {count && count.value !== 0 && count.value !== "0" ? (
            <span className="inline-grid h-5 min-w-5 place-items-center rounded-sm bg-action-primary-soft px-1.5 text-caption font-semibold tabular-nums text-action-link">
              <span aria-hidden="true">{count.value}</span>
              <span className="sr-only">{count.label}</span>
            </span>
          ) : null}
          {subtitle ? <span className="text-secondary text-text-muted">{subtitle}</span> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * In-block failure: says what did not load and offers a reload. Never hides
 * the block, never claims there is nothing to show.
 */
export function BlockError({ className, message, retryHref }: { className?: string; message: string; retryHref: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-warning-border bg-warning-bg px-4 py-3 text-secondary text-warning-ink", className)}
      role="alert"
    >
      <span className="flex min-w-0 items-start gap-2">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
        <span>{message}</span>
      </span>
      <Link className={cn(homeLinkClassName, "text-warning-ink! underline")} href={retryHref} prefetch={false}>
        Thử lại
      </Link>
    </div>
  );
}

/** Quiet in-block note for "nothing here" states. */
export function BlockEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-4 text-secondary text-text-muted">{children}</p>;
}
