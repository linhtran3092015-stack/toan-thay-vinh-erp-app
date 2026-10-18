import { TableSkeletonRows } from "@/components/patterns/data-table-frame";
import { LoadingNotice } from "@/components/shared/loading-state";
import { cn } from "@/lib/utils";

import {
  AUDIT_CARDS_SWITCH_CLASS,
  AUDIT_FILTER_TRACKS_CLASS,
  AUDIT_TABLE_COLUMN_COUNT,
  AUDIT_TABLE_SWITCH_CLASS,
} from "./audit-log-cells";

/**
 * Loading keeps the /audit geometry: header with its two caption lines, the
 * filter bar (1 → 2 → 4 tracks like the page), then a framed seven-column
 * table from 1042px of the work area and cards below it. Same column count,
 * container switch and filter tracks as AuditLogPage (shared constants).
 */
export function AuditLogSkeleton() {
  return (
    <div className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-7 w-56 rounded-sm bg-surface-sunken" />
        <div className="mt-2 h-3.5 w-72 max-w-full rounded-sm bg-surface-sunken" />
        <div className="mt-1.5 h-3 w-80 max-w-full rounded-sm bg-surface-sunken" />
      </div>

      <div className="grid min-w-0 gap-2">
        <div
          aria-hidden="true"
          className={cn(
            "grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 motion-safe:animate-pulse",
            AUDIT_FILTER_TRACKS_CLASS,
          )}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div className="grid gap-1.5" key={index}>
              <div className="h-3.5 w-24 rounded-sm bg-surface-sunken" />
              <div className="h-11 rounded-md bg-surface-sunken @min-[880px]:h-10" />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="h-3 w-72 max-w-full rounded-sm bg-surface-sunken motion-safe:animate-pulse" />
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <LoadingNotice title="Đang tải nhật ký hệ thống" />

        <div
          aria-hidden="true"
          className={cn("overflow-hidden rounded-lg border border-border-subtle bg-surface-base", AUDIT_TABLE_SWITCH_CLASS)}
        >
          <div className="h-10 bg-table-header" />
          <TableSkeletonRows columns={AUDIT_TABLE_COLUMN_COUNT} rows={10} />
        </div>

        <div aria-hidden="true" className={cn("grid gap-2 motion-safe:animate-pulse", AUDIT_CARDS_SWITCH_CLASS)}>
          {Array.from({ length: 5 }, (_, index) => (
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
