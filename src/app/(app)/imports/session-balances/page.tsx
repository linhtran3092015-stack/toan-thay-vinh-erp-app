import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { listSessionBalanceImportBatches } from "@/features/imports/session-balances/queries";
import { SessionBalanceImportPage } from "@/features/imports/session-balances/session-balance-import-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const hasViewPermission = permissionResult.permissions.includes(
    "imports.session_balances",
  );
  const canApprove = permissionResult.permissions.includes(
    "imports.session_balances.approve",
  );

  if (!hasViewPermission && !canApprove) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền xem hoặc duyệt import số dư buổi."
        title="Không có quyền truy cập"
      />
    );
  }

  const batches = await listSessionBalanceImportBatches();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <SessionBalanceImportPage
      batches={batches}
      canApprove={canApprove}
      canImport={hasViewPermission}
      currentUserId={user?.id ?? null}
    />
  );
}
