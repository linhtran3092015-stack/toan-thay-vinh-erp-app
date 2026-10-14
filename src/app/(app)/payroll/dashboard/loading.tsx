import { LoadingNotice } from "@/components/shared/loading-state";

/** Mirrors the real header: title + badge row, context line, left-aligned filter row; optional action block right. */
export default function OwnerPayrollDashboardLoading() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <LoadingNotice title="Đang tải Dashboard lương" />
      <div aria-hidden="true" className="grid gap-5 motion-safe:animate-pulse">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-8 w-72 max-w-full rounded bg-surface-sunken" />
              <div className="h-6 w-28 rounded-full bg-surface-sunken" />
            </div>
            <div className="mt-1 h-4 w-96 max-w-full rounded bg-surface-sunken" />
            <div className="mt-3 flex flex-wrap items-center gap-2 max-md:w-full">
              <div className="h-10 w-40 rounded-md bg-surface-sunken max-md:h-11 max-md:w-full" />
              <div className="h-10 w-40 rounded-md bg-surface-sunken max-md:h-11 max-md:w-full" />
              <div className="h-10 w-20 rounded-md bg-surface-sunken max-md:h-11 max-md:w-full" />
            </div>
          </div>
          <div className="hidden h-10 w-48 shrink-0 rounded-md bg-surface-sunken md:block" />
        </div>
        <div className="h-[76px] rounded-lg border border-border-subtle bg-surface-base" />
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base">
          <div className="h-10 bg-table-header" />
          {Array.from({ length: 6 }, (_, index) => <div className="h-12 border-t border-border-row" key={index} />)}
        </div>
      </div>
    </div>
  );
}
