import { TableSkeletonRows } from "@/components/patterns/data-table-frame";
import { LoadingNotice } from "@/components/shared/loading-state";

/**
 * Loading keeps the page geometry: header, chip row, filter bar and a framed
 * table (cards on narrow widths). Same container breakpoint as the page.
 */
export function LearningResultsSkeleton() {
  return (
    <div className="learning-results-directory @container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-7 w-48 rounded-sm bg-surface-sunken" />
        <div className="mt-2 h-3.5 w-40 rounded-sm bg-surface-sunken" />
      </div>

      {/* Narrow layout: the page's inline search field (44px) sits under the header. */}
      <div aria-hidden="true" className="h-11 rounded-md bg-surface-sunken motion-safe:animate-pulse @min-[1072px]:hidden" />

      {/* Desktop bar: 2 x 16px padding + 18px label + 6px gap + 40px control + 2px border = 98px. */}
      <div aria-hidden="true" className="hidden h-[98px] rounded-lg border border-border-subtle bg-surface-base @min-[1072px]:block" />

      <div aria-hidden="true" className="flex flex-wrap gap-2 motion-safe:animate-pulse">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="h-8 w-28 rounded-md bg-surface-sunken max-md:h-11" key={index} />
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <LoadingNotice title="Đang tải kết quả học tập" />

        <div aria-hidden="true" className="hidden overflow-hidden rounded-lg border border-border-subtle bg-surface-base @min-[1072px]:block">
          <div className="h-10 bg-table-header" />
          <TableSkeletonRows columns={9} rows={10} />
        </div>

        <div aria-hidden="true" className="grid gap-2 motion-safe:animate-pulse @min-[1072px]:hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="grid gap-2 rounded-lg border border-border-subtle bg-surface-base px-4 py-3"
              key={index}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="h-5 w-3/5 rounded-sm bg-surface-sunken" />
                <div className="h-5 w-20 rounded-sm bg-surface-sunken" />
              </div>
              <div className="h-3.5 w-4/5 rounded-sm bg-surface-sunken" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
