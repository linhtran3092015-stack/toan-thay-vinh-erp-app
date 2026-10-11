import { redirect } from "next/navigation";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function SettingsAuditLogsRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền xem nhật ký thay đổi."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("audit.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("audit.view")}
        title="Không có quyền xem nhật ký thay đổi"
      />
    );
  }

  redirect("/audit");
}
