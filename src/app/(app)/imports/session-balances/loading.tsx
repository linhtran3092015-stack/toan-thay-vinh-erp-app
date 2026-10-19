import { LoadingNotice } from "@/components/shared/loading-state";

/**
 * /imports/session-balances while the route loads its permissions and the
 * newest batches: the page header, the four-step stepper and the batch list
 * frame keep their shape (W6), with the notice inside the frame.
 */
export default function SessionBalanceImportLoading() {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div aria-hidden="true" className="grid gap-2 motion-safe:animate-pulse">
        <div className="h-8 w-72 max-w-full rounded-md bg-surface-sunken" />
        <div className="h-4 w-96 max-w-full rounded-sm bg-surface-sunken" />
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex items-center gap-3 border-border-row px-4 py-3 motion-safe:animate-pulse [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 xl:[&:not(:first-child)]:border-t-0" key={index}>
            <div className="h-6 w-6 shrink-0 rounded-full bg-surface-sunken" />
            <div className="h-3.5 w-32 rounded-sm bg-surface-sunken" />
          </div>
        ))}
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base p-5 shadow-[var(--panel-shadow)]">
        <LoadingNotice description="Danh sách lô và bước nhập file sẽ hiện khi tải xong." title="Đang tải lô số dư buổi" />
        <div aria-hidden="true" className="mt-5 grid gap-3 motion-safe:animate-pulse">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-4 border-t border-border-row pt-3 first:border-t-0 first:pt-0" key={index}>
              <div className="grid gap-2">
                <div className={index % 2 === 0 ? "h-3 w-3/5 rounded-sm bg-surface-sunken" : "h-3 w-4/5 rounded-sm bg-surface-sunken"} />
                <div className="h-2.5 w-2/5 rounded-sm bg-surface-sunken" />
              </div>
              <div className="h-8 rounded-md bg-surface-sunken" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
