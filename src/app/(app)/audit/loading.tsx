import { LoadingNotice } from "@/components/shared/loading-state";

export default function AuditLoading() {
  return (
    <div className="space-y-5">
      <LoadingNotice title="Đang tải nhật ký hệ thống" />
      <div aria-hidden="true" className="space-y-5">
        <div className="h-36 motion-safe:animate-pulse rounded-xl border border-hairline bg-surface-1" />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="h-24 motion-safe:animate-pulse rounded-lg border border-hairline bg-surface-1"
              key={index}
            />
          ))}
        </div>

        <div className="h-64 motion-safe:animate-pulse rounded-xl border border-hairline bg-surface-1" />
        <div className="h-96 motion-safe:animate-pulse rounded-xl border border-hairline bg-surface-1" />
      </div>
    </div>
  );
}
