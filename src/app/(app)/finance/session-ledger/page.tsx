import { ErrorState } from "@/components/shared/error-state";
import {
  SessionLedgerHistory,
  SessionLedgerPermissionDenied,
} from "@/features/finance/components/session-ledger-history";
import { getCenterSessionLedgerEntriesResult } from "@/features/finance/data";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

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

  const { permissions } = permissionResult;

  if (!permissions.includes("session_ledger.view")) {
    return <SessionLedgerPermissionDenied />;
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

  // Link gates from the permissions already loaded above (no extra read): profile
  // links need students.view, session links sessions.view, PAY- codes the
  // payment-request list's own gate.
  return (
    <SessionLedgerHistory
      canViewPaymentRequests={permissions.includes("payments.view") || permissions.includes("payments.manage")}
      canViewSessions={permissions.includes("sessions.view")}
      canViewStudents={permissions.includes("students.view")}
      entries={entriesResult.data}
      today={getVietnamToday()}
    />
  );
}
