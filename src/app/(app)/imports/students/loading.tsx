import { LoadingNotice } from "@/components/shared/loading-state";

const STEP_COUNT = 4;

/**
 * /imports/students while the route loads: the wizard's geometry (header,
 * the four-step stepper, the file card and the action bar) in the frame's
 * one-column grid, so nothing jumps when the page arrives.
 */
export default function StudentImportLoading() {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-7 w-56 max-w-full rounded-sm bg-surface-sunken" />
      </div>

      <ol
        aria-hidden="true"
        className="m-0 grid list-none grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-border-subtle bg-surface-base p-0 shadow-[var(--panel-shadow)] motion-safe:animate-pulse sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({ length: STEP_COUNT }, (_, index) => (
          <li className="flex items-center gap-3 border-border-row px-4 py-3 [&:not(:first-child)]:border-t xl:[&:not(:first-child)]:border-t-0 xl:[&:not(:last-child)]:border-r" key={index}>
            <span className="h-6 w-6 shrink-0 rounded-full bg-surface-sunken" />
            <span className="h-4 w-32 rounded-sm bg-surface-sunken" />
          </li>
        ))}
      </ol>

      <div className="grid gap-4 rounded-lg border border-border-subtle bg-surface-base p-5 shadow-[var(--panel-shadow)]">
        <LoadingNotice description="Bước chọn file hiện ra ngay khi tải xong." title="Đang tải màn nhập học sinh" />
        <div aria-hidden="true" className="grid justify-items-center gap-3 rounded-md border border-dashed border-border-strong px-4 py-8 motion-safe:animate-pulse">
          <div className="h-7 w-7 rounded-sm bg-surface-sunken" />
          <div className="h-10 w-72 max-w-full rounded-md bg-surface-sunken" />
          <div className="h-3 w-80 max-w-full rounded-sm bg-surface-sunken" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)] motion-safe:animate-pulse"
      >
        <div className="h-3.5 flex-1 rounded-sm bg-surface-sunken" />
        <div className="h-10 w-40 shrink-0 rounded-md bg-surface-sunken max-md:h-11" />
      </div>
    </div>
  );
}
