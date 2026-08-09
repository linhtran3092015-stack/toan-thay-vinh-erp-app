export function StudentTableSkeleton() {
  return (
    <div
      aria-live="polite"
      className="students-directory-results grid gap-3"
      role="status"
    >
      <span className="sr-only">Đang tải danh sách học viên</span>

      <div className="students-directory-table overflow-hidden rounded-lg border border-border-subtle bg-surface-base">
        <div className="h-11 animate-pulse bg-surface-subtle" />
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div
            className="grid grid-cols-[104px_220px_88px_172px_184px_88px_144px_96px] gap-3 border-t border-border-subtle px-4 py-3"
            key={rowIndex}
          >
            {Array.from({ length: 8 }).map((__, cellIndex) => (
              <div
                className="h-4 animate-pulse rounded-sm bg-surface-subtle"
                key={cellIndex}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="students-directory-record-list grid gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4"
            key={index}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-5 w-3/5 animate-pulse rounded-sm bg-surface-subtle" />
              <div className="h-5 w-20 animate-pulse rounded-sm bg-surface-subtle" />
            </div>
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-subtle" />
            <div className="h-4 w-4/5 animate-pulse rounded-sm bg-surface-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
