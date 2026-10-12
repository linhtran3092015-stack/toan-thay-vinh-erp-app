import { TableSkeletonRows } from "@/components/patterns/data-table-frame";
import { LoadingNotice } from "@/components/shared/loading-state";

/** Loading keeps the page geometry: header bar, filter bar, framed table with 10 skeleton rows. */
export function StudentTableSkeleton() {
  return (
    <div className="students-directory grid gap-5">
      <div aria-hidden="true" className="flex flex-wrap items-start justify-between gap-4 motion-safe:animate-pulse">
        <div>
          <div className="h-7 w-40 rounded-sm bg-surface-sunken" />
          <div className="mt-2 h-3.5 w-64 rounded-sm bg-surface-sunken" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-md bg-surface-sunken" />
          <div className="h-10 w-36 rounded-md bg-surface-sunken" />
        </div>
      </div>

      <div aria-hidden="true" className="students-filter-bar hidden h-[90px] rounded-lg border border-border-subtle bg-surface-base" />

      <div className="students-directory-results grid gap-3">
        <LoadingNotice title="Đang tải danh sách học sinh" />

        <div aria-hidden="true" className="students-directory-table overflow-hidden rounded-lg border border-border-subtle bg-surface-base">
          <div className="h-10 bg-table-header" />
          <TableSkeletonRows columns={7} rows={10} />
        </div>

        <div aria-hidden="true" className="students-directory-record-list grid gap-2 motion-safe:animate-pulse">
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
              <div className="h-3.5 w-2/3 rounded-sm bg-surface-sunken" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
