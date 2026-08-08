import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SessionBalanceImportPage } from "@/features/imports/session-balances/session-balance-import-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function SessionBalanceImportRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền import số dư buổi từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes("imports.session_balances")
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền imports.session_balances."
        title="Không có quyền import số dư buổi"
      />
    );
  }

  return <SessionBalanceImportPage />;
}
