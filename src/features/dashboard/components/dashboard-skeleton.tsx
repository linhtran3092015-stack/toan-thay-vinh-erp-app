export function DashboardSkeleton() {
  return (
    <div className="grid min-w-0 gap-6 animate-pulse" aria-busy="true" aria-label="Đang tải dữ liệu Dashboard">
      {/* Header Skeleton */}
      <div className="h-28 rounded-2xl bg-surface-2" />

      {/* 5 KPIs Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="h-28 rounded-2xl bg-surface-2" key={i} />
        ))}
      </div>

      {/* Attention Skeleton */}
      <div className="h-24 rounded-2xl bg-surface-2" />

      {/* Row 1 Charts Skeleton */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="h-80 rounded-2xl bg-surface-2 lg:col-span-8" />
        <div className="h-80 rounded-2xl bg-surface-2 lg:col-span-4" />
      </div>

      {/* Row 2 Charts Skeleton */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="h-80 rounded-2xl bg-surface-2 lg:col-span-6" />
        <div className="h-80 rounded-2xl bg-surface-2 lg:col-span-6" />
      </div>

      {/* Row 3 Charts Skeleton */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="h-72 rounded-2xl bg-surface-2 lg:col-span-6" />
        <div className="h-72 rounded-2xl bg-surface-2 lg:col-span-6" />
      </div>

      {/* Highlights Skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="h-20 rounded-2xl bg-surface-2" key={i} />
        ))}
      </div>
    </div>
  );
}
