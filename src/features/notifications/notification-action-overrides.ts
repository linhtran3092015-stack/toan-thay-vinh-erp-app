import type { markAllNotificationsReadAction, markNotificationReadAction } from "./actions/notification-actions";

/**
 * Optional replacements for the two server actions the notification list can
 * reach ("Đánh dấu tất cả đã đọc" and marking one row read, by its button or by
 * opening it). The list calls `actions?.markNotificationRead ??
 * markNotificationReadAction` with the same positional arguments, so the real
 * route passes nothing while the /dev/lists preview passes inert stubs (it runs
 * on localhost where .env.local may point at the production database).
 * Type-only import: no server module enters a bundle through this file.
 */
export interface NotificationActionOverrides {
  markAllNotificationsRead?: typeof markAllNotificationsReadAction;
  markNotificationRead?: typeof markNotificationReadAction;
}
