export function StudentTableSkeleton() {
  return (
    <div className="grid gap-3" role="status" aria-live="polite">
      <span className="sr-only">Đang tải danh sách học viên</span>
      <div className="hidden overflow-hidden rounded-lg border border-hairline bg-surface-1 lg:block">
        <div className="h-11 animate-pulse bg-neutral-bg" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            className="grid grid-cols-[120px_220px_80px_150px_130px_70px_110px_100px_90px_130px_110px_130px_150px_100px_80px] gap-3 border-t border-hairline px-4 py-3"
            key={index}
          >
            {Array.from({ length: 15 }).map((__, cellIndex) => (
              <div
                className="h-4 animate-pulse rounded bg-neutral-bg"
                key={cellIndex}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="rounded-lg border border-hairline bg-surface-1 p-4"
            key={index}
          >
            <div className="h-5 w-3/5 animate-pulse rounded bg-neutral-bg" />
            <div className="mt-3 h-4 w-2/5 animate-pulse rounded bg-neutral-bg" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="h-8 animate-pulse rounded bg-neutral-bg" />
              <div className="h-8 animate-pulse rounded bg-neutral-bg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
