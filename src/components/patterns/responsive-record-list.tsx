import Link from "next/link";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ResponsiveRecordListProps {
  children: ReactNode;
  className?: string;
  label: string;
}

/** Presentation-only compact list for data that cannot retain usable table columns. */
export function ResponsiveRecordList({
  children,
  className,
  label,
}: ResponsiveRecordListProps) {
  return (
    <div aria-label={label} className={cn("grid gap-2", className)} role="list">
      {children}
    </div>
  );
}

interface RecordListItemProps {
  /** Accessible name of the whole-card link, e.g. "Mở hồ sơ học viên Nguyễn A". */
  ariaLabel: string;
  /** Status badge placed next to the title. */
  badge?: ReactNode;
  className?: string;
  href: string;
  /**
   * Control placed before the card, outside its link (e.g. a selection
   * checkbox: an input cannot live inside the whole-card link).
   */
  leading?: ReactNode;
  /** 13px muted line under the title (code · guardian · phone). */
  meta?: ReactNode;
  /** Metric row under a top divider (attendance, balance, debt). */
  metrics?: ReactNode;
  title: ReactNode;
}

/**
 * One record (design 06c): 15/600 title + badge, meta line, metric row with a
 * divider, the whole card is the link.
 */
export function RecordListItem({
  ariaLabel,
  badge,
  className,
  href,
  leading,
  meta,
  metrics,
  title,
}: RecordListItemProps) {
  // The short aria-label names the link; the status, meta and metrics stay
  // announced as its description instead of being hidden behind the label.
  const id = useId();
  const describedBy = [badge && `${id}-badge`, meta && `${id}-meta`, metrics && `${id}-metrics`]
    .filter(Boolean)
    .join(" ");

  const link = (
    <Link
      aria-describedby={describedBy || undefined}
      aria-label={ariaLabel}
      className="block rounded-lg border border-border-subtle bg-surface-base px-4 py-3 text-text-strong shadow-[var(--panel-shadow)] hover:border-border-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      href={href}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[15px] font-semibold leading-5">{title}</span>
        {badge ? <span className="shrink-0" id={`${id}-badge`}>{badge}</span> : null}
      </div>
      {meta ? (
        <div className="mt-0.5 text-secondary tabular-nums text-text-muted" id={`${id}-meta`}>{meta}</div>
      ) : null}
      {metrics ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-row pt-2 text-secondary text-text-default" id={`${id}-metrics`}>
          {metrics}
        </div>
      ) : null}
    </Link>
  );

  return (
    <article className={cn("min-w-0", leading ? "flex items-center gap-1" : undefined, className)} role="listitem">
      {leading}
      {leading ? <div className="min-w-0 flex-1">{link}</div> : link}
    </article>
  );
}
