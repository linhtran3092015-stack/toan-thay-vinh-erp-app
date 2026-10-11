import { Suspense } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { UnlockedSessionQueue } from "@/features/sessions/components/unlocked-session-queue";
import { getSessionDirectory } from "@/features/sessions/data";
import { getUnlockedSessionQueueResult } from "@/features/sessions/unlocked-sessions-data";
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

  const [directoryResult, queueResult] = await Promise.all([
    getSessionDirectory({
      includeAttendanceCounts:
        canViewAttendance,
      includeResultCounts: canViewResults,
    }),
    getUnlockedSessionQueueResult(),
  ]);

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
        queuePanel={
          queueResult.ok ? (
            <UnlockedSessionQueue
              canLock={permissionResult.permissions.includes("sessions.lock")}
              queue={queueResult.data}
            />
          ) : null
        }
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
