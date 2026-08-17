import { Suspense } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getSessionDirectory } from "@/features/sessions/data";
import { SessionListPage } from "@/features/sessions/session-list-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function SessionsRoute() {
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập buổi học."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "sessions.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền sessions.view."
        title="Không có quyền xem buổi học"
      />
    );
  }

  const canViewAttendance =
    permissionResult.permissions.includes(
      "attendance.view",
    );

  const canViewResults =
    permissionResult.permissions.includes(
      "results.view",
    );

  const directoryResult =
    await getSessionDirectory({
      includeAttendanceCounts:
        canViewAttendance,
      includeResultCounts: canViewResults,
    });

  if (!directoryResult.ok) {
    return (
      <ErrorState
        description={
          directoryResult.error.message
        }
        title="Không tải được danh sách buổi học"
      />
    );
  }

  return (
    <Suspense>
      <SessionListPage
        canManageSessions={
          permissionResult.permissions.includes(
            "sessions.manage",
          )
        }
        canViewAttendance={canViewAttendance}
        canViewResults={canViewResults}
        sessions={directoryResult.sessions}
      />
    </Suspense>
  );
}
