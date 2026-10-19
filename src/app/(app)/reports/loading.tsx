import { LoadingNotice } from "@/components/shared/loading-state";

/** Same geometry as ReportsPage: header lines, then a 1–2 column grid of catalog cards. */
export default function ReportsLoading() {
  return (
    <div className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <LoadingNotice title="Đang tải báo cáo" />
      <div aria-hidden="true" className="grid gap-5 motion-safe:animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-64 max-w-full rounded bg-surface-sunken" />
          <div className="h-4 w-80 max-w-full rounded bg-surface-sunken" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @min-[720px]:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div className="h-64 rounded-lg bg-surface-sunken" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
