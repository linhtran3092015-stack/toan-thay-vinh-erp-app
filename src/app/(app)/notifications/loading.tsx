import { LoadingNotice } from "@/components/shared/loading-state";

export default function NotificationsLoading() {
  return (
    <div className="space-y-5">
      <LoadingNotice title="Đang tải thông báo" />
      <div aria-hidden="true" className="h-28 motion-safe:animate-pulse rounded-xl border border-hairline bg-surface-1 shadow-card" />

      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-32 motion-safe:animate-pulse rounded-xl border border-hairline bg-surface-1 shadow-card"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
