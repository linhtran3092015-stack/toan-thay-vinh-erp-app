import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { NotificationListPage } from "@/features/notifications/notification-list-page";
import {
  getCachedUnreadNotificationCountResult,
  getNotificationsResult,
} from "@/features/notifications/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function NotificationsRoute() {
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
      getNotificationsResult(),
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

  if (notificationsResult.data.length === 0) {
    return (
      <EmptyState
        description="Các cập nhật cần chú ý trong quá trình vận hành sẽ xuất hiện tại đây."
        title="Chưa có thông báo"
      />
    );
  }

  return (
    <NotificationListPage
      entries={notificationsResult.data}
      unreadCount={unreadCountResult.data}
    />
  );
}
