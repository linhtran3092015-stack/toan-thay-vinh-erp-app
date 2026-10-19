import { LoadingNotice } from "@/components/shared/loading-state";

/**
 * /imports/session-balances/[batchId] while the batch and its rows load: the
 * header, the stage stepper (Tạo lô · Đối soát · Phê duyệt · Ghi sổ), the
 * count strip and the panel frame keep their shape (W6), with the notice
 * inside the frame.
 */
export default function SessionBalanceBatchLoading() {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div aria-hidden="true" className="grid gap-2 motion-safe:animate-pulse">
        <div className="h-8 w-64 max-w-full rounded-md bg-surface-sunken" />
        <div className="h-4 w-80 max-w-full rounded-sm bg-surface-sunken" />
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex items-center gap-3 border-border-row px-4 py-3 motion-safe:animate-pulse [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 xl:[&:not(:first-child)]:border-t-0" key={index}>
            <div className="h-6 w-6 shrink-0 rounded-full bg-surface-sunken" />
            <div className="h-3.5 w-24 rounded-sm bg-surface-sunken" />
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-2 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] md:grid-cols-6"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div className="grid gap-2 px-4 py-3 motion-safe:animate-pulse" key={index}>
            <div className="h-3 w-16 rounded-sm bg-surface-sunken" />
            <div className="h-6 w-10 rounded-sm bg-surface-sunken" />
          </div>
        ))}
      </div>
      <div className="min-w-0 rounded-lg border border-border-subtle bg-surface-base p-5 shadow-[var(--panel-shadow)]">
        <LoadingNotice description="Thông tin lô, bước hiện tại và các dòng sẽ hiện khi tải xong." title="Đang tải lô số dư" />
        <div aria-hidden="true" className="mt-5 grid gap-2 motion-safe:animate-pulse">
          <div className="h-3 w-3/5 rounded-sm bg-surface-sunken" />
          <div className="h-3 w-4/5 rounded-sm bg-surface-sunken" />
          <div className="h-3 w-2/5 rounded-sm bg-surface-sunken" />
        </div>
      </div>
    </div>
  );
}
