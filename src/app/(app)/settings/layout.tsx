import type { ReactNode } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SettingsHub } from "@/features/settings/components/settings-hub";
import { getCenterDisplayName } from "@/features/settings/system-settings-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập khu vực cài đặt."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("settings.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("settings.view")}
        title="Không có quyền xem cài đặt hệ thống"
      />
    );
  }

  // Per-request memoized: the app shell already read it in this render.
  const centerName = await getCenterDisplayName();

  return (
    <SettingsHub
      canViewAudit={permissionResult.permissions.includes("audit.view")}
      canViewUsers={permissionResult.permissions.includes("staff.view")}
      centerName={centerName}
    >
      {children}
    </SettingsHub>
  );
}
