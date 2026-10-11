"use client";

import { Button } from "@/components/ui/button";

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
}

/** Shared pager: summary line, prev/next, and a compact window of page numbers. */
export function Pagination({ itemLabel, label, onPageChange, page, pageCount, rangeEnd, rangeStart, total }: PaginationProps) {
  if (pageCount <= 1) return null;
  const pages = visiblePages(page, pageCount);
  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 text-body text-text-muted md:flex-row md:items-center md:justify-between"
    >
      <p>
        Hiển thị {rangeStart}-{rangeEnd} của {total} {itemLabel} · Trang {page}/{pageCount}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button" variant="outline">
          Trước
        </Button>
        {pages.map((value, index) =>
          value === null ? (
            <span aria-hidden="true" className="inline-flex min-w-10 items-center justify-center" key={`gap-${index}`}>
              …
            </span>
          ) : (
            <Button
              aria-current={value === page ? "page" : undefined}
              className="min-w-10"
              key={value}
              onClick={() => onPageChange(value)}
              type="button"
              variant={value === page ? "secondary" : "ghost"}
            >
              {value}
            </Button>
          ),
        )}
        <Button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} type="button" variant="outline">
          Sau
        </Button>
      </div>
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

/** Slice helper so features share one pagination arithmetic. */
export function paginate<T>(rows: readonly T[], requestedPage: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const rangeStart = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, rows.length);
  return { page, pageCount, rangeEnd, rangeStart, rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
}
