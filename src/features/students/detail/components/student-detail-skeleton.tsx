export function StudentDetailSkeleton() {
  return (
    <div aria-live="polite" className="grid gap-4" role="status">
      <span className="sr-only">Đang tải hồ sơ học viên</span>
      <div className="h-5 w-72 animate-pulse rounded-sm bg-surface-subtle" />
      <div className="rounded-lg border border-border-subtle bg-surface-base p-5">
        <div className="h-8 w-64 animate-pulse rounded-sm bg-surface-subtle" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-20 animate-pulse rounded-sm bg-surface-subtle" key={index} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="h-80 animate-pulse rounded-lg bg-surface-subtle" />
        <div className="h-80 animate-pulse rounded-lg bg-surface-subtle" />
      </div>
    </div>
  );
}
