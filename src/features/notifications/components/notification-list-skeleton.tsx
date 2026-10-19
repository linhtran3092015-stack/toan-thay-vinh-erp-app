import { LoadingNotice } from "@/components/shared/loading-state";

/**
 * Loading keeps the list's geometry: header (title, context line, the primary
 * on the right), the two chips with their caption, and one framed strip list
 * of icon-tile rows. Same list at every width, so no container switch.
 */
export function NotificationListSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div aria-hidden="true" className="flex flex-col gap-4 motion-safe:animate-pulse md:flex-row md:items-start md:justify-between">
        <div>
          <div className="h-7 w-36 rounded-sm bg-surface-sunken" />
          <div className="mt-2 h-3.5 w-40 rounded-sm bg-surface-sunken" />
        </div>
        <div className="h-10 w-52 rounded-md bg-surface-sunken max-md:h-11" />
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <LoadingNotice title="Đang tải thông báo" />

        <div aria-hidden="true" className="grid gap-1.5 motion-safe:animate-pulse">
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-20 rounded-md bg-surface-sunken max-md:h-11" />
            <div className="h-8 w-24 rounded-md bg-surface-sunken max-md:h-11" />
          </div>
          <div className="h-3 w-64 max-w-full rounded-sm bg-surface-sunken" />
        </div>

        <ul
          aria-hidden="true"
          className="divide-y divide-border-row overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] motion-safe:animate-pulse"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <li className="flex min-h-12 gap-3 px-4 py-3" key={index}>
              <div className="h-6 w-6 shrink-0 rounded-sm bg-surface-sunken" />
              <div className="grid min-w-0 flex-1 gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-4 w-3/5 rounded-sm bg-surface-sunken" />
                  <div className="h-3 w-16 rounded-sm bg-surface-sunken" />
                </div>
                <div className="h-3 w-28 rounded-sm bg-surface-sunken" />
                <div className="h-3.5 w-4/5 rounded-sm bg-surface-sunken" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
