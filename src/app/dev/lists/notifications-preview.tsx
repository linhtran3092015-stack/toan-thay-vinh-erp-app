"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { NotificationActionOverrides } from "@/features/notifications/notification-action-overrides";
import { NotificationListPage } from "@/features/notifications/notification-list-page";
import { parseNotificationPage } from "@/features/notifications/notification-models";
import type { NotificationActionResult } from "@/features/notifications/read-models";

import type { ListsPreviewRole, ListsPreviewState } from "./lists-preview";
import { getNotificationPreviewPage } from "./notification-fixtures";
import { sessionPreviewToday } from "./session-fixtures";

const STUB = "Bản xem trước không ghi dữ liệu.";
const stub = async (): Promise<NotificationActionResult> => ({ message: STUB, status: "error" });

/**
 * Inert stand-ins for both server actions the list can reach (mark one read,
 * by its button or by opening the row, and "Đánh dấu tất cả đã đọc"). The
 * preview runs on localhost where .env.local may point at production: each
 * stub answers with an error, so nothing is written and nothing refreshes; an
 * opened row still navigates (to another /dev preview).
 */
export const previewNotificationActions: Required<NotificationActionOverrides> = {
  markAllNotificationsRead: stub,
  markNotificationRead: stub,
};

/**
 * The exact unread total the route would load for this role and state (all
 * pages), so the controller can hand the shell's bell the same number.
 */
export function getNotificationPreviewUnreadCount(role: ListsPreviewRole, state: ListsPreviewState): number {
  return getNotificationPreviewPage(role, state, 1).unreadCount;
}

/**
 * /dev/lists?view=notifications body (the controller wraps it in AppShell).
 * Every role holds `notifications.view` (migrations grant it with
 * `app.access`), so there is no denial here; the roles differ by what they
 * receive: the owner gets the ops alerts (`settings.manage`) and the
 * approval/digest rows, the TA its own lock reminders and advance results,
 * the accountant the advance requests to reconcile. Fixed clock
 * `sessionPreviewToday`; `?page=` is read here (the list never reads the URL)
 * and the pager writes back to `/dev/lists`, keeping `view` and a non-default
 * `role`/`state`. Like the route, the list is not keyed by the page: it stays
 * mounted across pager links (keeping the focused link) and resets its own
 * page state.
 */
export function NotificationsPreviewBody({ role, state }: { role: ListsPreviewRole; state: ListsPreviewState }) {
  const searchParams = useSearchParams();
  const page = parseNotificationPage(searchParams.get("page"));
  const result = useMemo(() => getNotificationPreviewPage(role, state, page), [page, role, state]);
  const preservedParams = useMemo(() => {
    const params: Record<string, string> = { view: "notifications" };
    if (role !== "owner") params.role = role;
    if (state !== "normal") params.state = state;
    return params;
  }, [role, state]);

  return (
    <NotificationListPage
      actions={previewNotificationActions}
      basePath="/dev/lists"
      entries={result.entries}
      hasNextPage={result.hasNextPage}
      page={page}
      preservedParams={preservedParams}
      today={sessionPreviewToday}
      unreadCount={result.unreadCount}
    />
  );
}
