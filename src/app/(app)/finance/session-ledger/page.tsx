import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SessionLedgerHistory } from "@/features/finance/components/session-ledger-history";
import { getCenterSessionLedgerEntriesResult } from "@/features/finance/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function CenterSessionLedgerPage() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Sổ cái số buổi."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("session_ledger.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("session_ledger.view")}
        title="Không có quyền xem Sổ cái số buổi"
      />
    );
  }

  const entriesResult = await getCenterSessionLedgerEntriesResult();
  if (!entriesResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được sổ cái số buổi. Vui lòng thử lại sau."
        title="Không tải được sổ cái số buổi"
      />
    );
  }

  return <SessionLedgerHistory entries={entriesResult.data} />;
}
