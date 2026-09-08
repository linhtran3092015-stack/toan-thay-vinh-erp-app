import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCurrentAuthUser } from "@/features/auth/current-user";
import { getCachedUnreadNotificationCountResult } from "@/features/notifications/data";
import { getCenterDisplayName } from "@/features/settings/system-settings-data";
import { getCachedMyTimekeepingEntries } from "@/features/timekeeping/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface AuthenticatedAppShellProps {
  children: ReactNode;
}

export async function AuthenticatedAppShell({
  children,
}: AuthenticatedAppShellProps) {
  await connection();

  const authResult = await getCurrentAuthUser();

  if (!authResult.ok) {
    redirect(`/login?error=${authResult.error}`);
  }

  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    if (permissionResult.error.code === "not_authenticated") {
      redirect("/login?error=session_expired");
    }

    return (
      <PermissionDeniedState
        description="Hệ thống chưa tải được quyền truy cập từ cơ sở dữ liệu. Vui lòng tải lại trang hoặc liên hệ quản trị viên."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("app.access")) {
    return (
      <PermissionDeniedState
        description="Tài khoản đã đăng nhập nhưng chưa được cấp quyền app.access."
        title="Tài khoản chưa được phép truy cập hệ thống"
      />
    );
  }

  const canCheckTimekeeping =
    permissionResult.permissions.includes("timekeeping.check");

  // These requests are independent, but still run only after access is verified.
  const [myEntriesResult, unreadNotificationCountResult, centerDisplayName] = await Promise.all([
    canCheckTimekeeping
      ? getCachedMyTimekeepingEntries()
      : Promise.resolve(null),
    permissionResult.permissions.includes("notifications.view")
      ? getCachedUnreadNotificationCountResult()
      : Promise.resolve({ data: 0, ok: true as const }),
    getCenterDisplayName(),
  ]);

  const hasOpenTimekeepingEntry = myEntriesResult?.ok
    ? myEntriesResult.entries.some((entry) => entry.status === "open")
    : false;

  const openOfflineEntry = myEntriesResult?.ok
    ? myEntriesResult.entries.find(
        (entry) => entry.status === "open" && entry.checkInMode === "offline",
      )
    : null;

  const unreadNotificationCount =
    unreadNotificationCountResult.ok
      ? unreadNotificationCountResult.data
      : 0;

  return (
    <AppShell
      authUser={authResult.user}
      canCheckTimekeeping={canCheckTimekeeping}
      centerDisplayName={centerDisplayName}
      hasOpenTimekeepingEntry={hasOpenTimekeepingEntry}
      openOfflineEntryId={openOfflineEntry?.id ?? null}
      permissions={permissionResult.permissions}
      unreadNotificationCount={unreadNotificationCount}
    >
      {children}
    </AppShell>
  );
}
