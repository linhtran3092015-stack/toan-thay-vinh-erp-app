export default function NotificationsLoading() {
  return (
    <div
      aria-label="Đang tải thông báo"
      className="space-y-5"
      role="status"
    >
      <div className="h-28 animate-pulse rounded-xl border border-hairline bg-surface-1 shadow-card" />

      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-32 animate-pulse rounded-xl border border-hairline bg-surface-1 shadow-card"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
