"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  /** Noun for the summary line, e.g. "buổi học". */
  itemLabel: string;
  label: string;
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  rangeEnd: number;
  rangeStart: number;
  total: number;
  /** Extra summary text, e.g. "lọc theo lớp Toán 9A". */
  summarySuffix?: string;
  /** `frame`: compact 32px pager meant for the DataTableFrame footer slot. */
  variant?: "standalone" | "frame";
}

/** Shared pager: summary line, prev/next, and a compact window of page numbers. */
export function Pagination({
  itemLabel,
  label,
  onPageChange,
  page,
  pageCount,
  rangeEnd,
  rangeStart,
  summarySuffix,
  total,
  variant = "standalone",
}: PaginationProps) {
  const summary = (
    <p className="text-secondary text-text-muted">
      {rangeStart}–{rangeEnd} trong {total} {itemLabel}
      {summarySuffix ? ` · ${summarySuffix}` : ""}
    </p>
  );

  if (pageCount <= 1) {
    return variant === "frame" ? summary : null;
  }

  const pages = visiblePages(page, pageCount);
  // The standalone pager sits under phone record lists: keep 44px touch targets there.
  const touchClassName = variant === "standalone" ? "max-md:h-11 max-md:min-w-11" : undefined;
  const controls = (
    <div className="flex flex-wrap items-center gap-1">
      <Button className={touchClassName} disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" type="button" variant="secondary">
        Trước
      </Button>
      {pages.map((value, index) =>
        value === null ? (
          <span aria-hidden="true" className="inline-flex min-w-8 items-center justify-center text-text-subtle" key={`gap-${index}`}>
            …
          </span>
        ) : (
          <Button
            aria-current={value === page ? "page" : undefined}
            className={cn("min-w-8 px-2 tabular-nums", touchClassName, value === page && "border-action-primary bg-action-primary-soft text-action-primary")}
            key={value}
            onClick={() => onPageChange(value)}
            size="sm"
            type="button"
            variant={value === page ? "secondary" : "ghost"}
          >
            {value}
          </Button>
        ),
      )}
      <Button className={touchClassName} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} size="sm" type="button" variant="secondary">
        Sau
      </Button>
    </div>
  );

  if (variant === "frame") {
    return (
      <nav aria-label={label} className="flex w-full flex-wrap items-center justify-between gap-3">
        {summary}
        {controls}
      </nav>
    );
  }

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-2.5 md:flex-row md:items-center md:justify-between"
    >
      {summary}
      {controls}
    </nav>
  );
}

/** First, last, and a window of two around the current page; `null` marks a gap. */
function visiblePages(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const window = new Set([1, pageCount, page - 1, page, page + 1]);
  const result: (number | null)[] = [];
  for (let value = 1; value <= pageCount; value += 1) {
    if (window.has(value)) {
      result.push(value);
    } else if (result[result.length - 1] !== null) {
      result.push(null);
    }
  }
  return result;
}
