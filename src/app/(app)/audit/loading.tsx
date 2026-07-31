export default function AuditLoading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="h-36 animate-pulse rounded-xl border border-hairline bg-surface-1" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-24 animate-pulse rounded-lg border border-hairline bg-surface-1"
            key={index}
          />
        ))}
      </div>

      <div className="h-64 animate-pulse rounded-xl border border-hairline bg-surface-1" />
      <div className="h-96 animate-pulse rounded-xl border border-hairline bg-surface-1" />
    </div>
  );
}
