export function StudentDetailSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-live="polite">
      <span className="sr-only">Đang tải hồ sơ học viên</span>
      <div className="h-5 w-72 animate-pulse rounded bg-neutral-bg" />
      <div className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
        <div className="h-8 w-64 animate-pulse rounded bg-neutral-bg" />
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-20 animate-pulse rounded bg-neutral-bg" key={index} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="h-80 animate-pulse rounded-lg bg-neutral-bg" />
        <div className="h-80 animate-pulse rounded-lg bg-neutral-bg" />
      </div>
    </div>
  );
}
