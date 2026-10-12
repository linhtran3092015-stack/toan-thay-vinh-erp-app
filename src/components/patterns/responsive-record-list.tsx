import Link from "next/link";
import type { ReactNode } from "react";

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
  meta,
  metrics,
  title,
}: RecordListItemProps) {
  return (
    <article className={cn("min-w-0", className)} role="listitem">
      <Link
        aria-label={ariaLabel}
        className="block rounded-lg border border-border-subtle bg-surface-base px-4 py-3 text-text-strong shadow-[var(--panel-shadow)] hover:border-border-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        href={href}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[15px] font-semibold leading-5">{title}</span>
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </div>
        {meta ? (
          <div className="mt-0.5 text-secondary tabular-nums text-text-muted">{meta}</div>
        ) : null}
        {metrics ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-row pt-2 text-secondary text-text-default">
            {metrics}
          </div>
        ) : null}
      </Link>
    </article>
  );
}
