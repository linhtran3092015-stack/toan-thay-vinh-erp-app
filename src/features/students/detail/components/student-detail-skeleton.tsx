import { LoadingNotice } from "@/components/shared/loading-state";

export function StudentDetailSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <LoadingNotice title="Đang tải hồ sơ học viên" />
      <div aria-hidden="true" className="h-5 w-72 max-w-full motion-safe:animate-pulse rounded-sm bg-surface-subtle" />
      <div aria-hidden="true" className="rounded-lg border border-border-subtle bg-surface-base p-5">
        <div className="h-8 w-64 max-w-full motion-safe:animate-pulse rounded-sm bg-surface-subtle" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-20 motion-safe:animate-pulse rounded-sm bg-surface-subtle" key={index} />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="h-80 motion-safe:animate-pulse rounded-lg bg-surface-subtle" />
        <div className="h-80 motion-safe:animate-pulse rounded-lg bg-surface-subtle" />
      </div>
    </div>
  );
}
