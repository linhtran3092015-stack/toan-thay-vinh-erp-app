import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { NotificationListPage } from "@/features/notifications/notification-list-page";
import {
  getCachedUnreadNotificationCountResult,
  getNotificationsResult,
} from "@/features/notifications/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function NotificationsRoute({ searchParams }: { searchParams?: Promise<{page?: string}> }) {
  const requestedPage = Number((await searchParams)?.page ?? 1);
  const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(100000, requestedPage)) : 1;
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập thông báo."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "notifications.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền notifications.view."
        title="Không có quyền xem thông báo"
      />
    );
  }

  const [notificationsResult, unreadCountResult] =
    await Promise.all([
      getNotificationsResult(page),
      getCachedUnreadNotificationCountResult(),
    ]);

  if (!notificationsResult.ok || !unreadCountResult.ok) {
    return (
      <ErrorState
        description="Không tải được dữ liệu thông báo từ hệ thống."
        title="Không tải được thông báo"
      />
    );
  }

  if (notificationsResult.data.length === 0 && page === 1) {
    return (
      <EmptyState
        description="Các cập nhật cần chú ý trong quá trình vận hành sẽ xuất hiện tại đây."
        title="Chưa có thông báo"
      />
    );
  }

  return (
    <div className="space-y-4">
    <NotificationListPage
      entries={notificationsResult.data}
      unreadCount={unreadCountResult.data}
    />
    <nav className="flex gap-4 text-sm" aria-label="Phân trang thông báo">
      {page > 1 && <Link className="text-action-link underline" href={`/notifications?page=${page - 1}`}>Mới hơn</Link>}
      <span>Trang {page}</span>
      {notificationsResult.data.length === 50 && <Link className="text-action-link underline" href={`/notifications?page=${page + 1}`}>Cũ hơn</Link>}
    </nav>
    </div>
  );
}
