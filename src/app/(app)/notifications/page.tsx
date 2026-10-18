import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import {
  getCachedUnreadNotificationCountResult,
  getNotificationsResult,
} from "@/features/notifications/data";
import { NotificationListPage } from "@/features/notifications/notification-list-page";
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATIONS_ACCESS,
  parseNotificationPage,
} from "@/features/notifications/notification-models";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

export default async function NotificationsRoute({ searchParams }: { searchParams?: Promise<{page?: string}> }) {
  const page = parseNotificationPage((await searchParams)?.page);
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
      NOTIFICATIONS_ACCESS.permission,
    )
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription(NOTIFICATIONS_ACCESS.permission)}
        title={NOTIFICATIONS_ACCESS.deniedTitle}
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

  // Empty pages (page 1 or past the last one) render inside the list's frame, with the pager.
  // No key: a pager link keeps the list mounted (and its focused link); the list resets its page state itself.
  return (
    <NotificationListPage
      entries={notificationsResult.data}
      // No total exists: a full page may have an older one (an exact multiple ends on an empty page).
      hasNextPage={notificationsResult.data.length === NOTIFICATION_PAGE_SIZE}
      page={page}
      today={getVietnamToday()}
      unreadCount={unreadCountResult.data}
    />
  );
}
