import type { ReactNode } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SettingsNavigation } from "@/features/settings/components/settings-navigation";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

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
        description="Tài khoản hiện tại không có quyền settings.view."
        title="Không có quyền xem cài đặt hệ thống"
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <header>
        <p className="text-xs font-semibold uppercase text-ink-muted">
          Quản trị
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">
          Cài đặt hệ thống
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
          Quản lý tài khoản, vai trò, quyền truy cập và cấu hình nền tảng.
        </p>
      </header>

      <SettingsNavigation
        canViewAudit={permissionResult.permissions.includes("audit.view")}
        canViewSettings={permissionResult.permissions.includes("settings.view")}
        canViewUsers={permissionResult.permissions.includes("staff.view")}
      />

      {children}
    </div>
  );
}
