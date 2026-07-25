import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getSessionDetail } from "@/features/sessions/detail-data";
import { SessionDetailPage } from "@/features/sessions/session-detail-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface SessionDetailRouteProps {
  params: Promise<{
    sessionId: string;
  }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function SessionDetailRoute({
  params,
}: SessionDetailRouteProps) {
  const { sessionId } = await params;

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

  if (!UUID_PATTERN.test(sessionId)) {
    return (
      <EmptyState
        description="Mã buổi học trên đường dẫn không hợp lệ."
        title="Không tìm thấy buổi học"
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

  const canViewStudents =
    permissionResult.permissions.includes(
      "students.view",
    );

  const detailResult = await getSessionDetail(
    sessionId,
    {
      includeAttendance:
        canViewAttendance,
      includeResults:
        canViewResults,
      includeRoster:
        canViewStudents,
      includeStudentIdentity:
        canViewStudents,
    },
  );

  if (!detailResult.ok) {
    if (
      detailResult.error.code ===
      "session_not_found"
    ) {
      return (
        <EmptyState
          description="Buổi học có thể không tồn tại hoặc đường dẫn không còn hợp lệ."
          title="Không tìm thấy buổi học"
        />
      );
    }

    return (
      <ErrorState
        description={detailResult.error.message}
        title="Không tải được chi tiết buổi học"
      />
    );
  }

  return (
    <SessionDetailPage
      canLockSession={permissionResult.permissions.includes(
        "sessions.lock",
      )}
      canManageResults={permissionResult.permissions.includes(
        "results.manage",
      )}
      canManageSessions={permissionResult.permissions.includes(
        "sessions.manage",
      )}
      canMarkAttendance={permissionResult.permissions.includes(
        "attendance.mark",
      )}
      canViewAttendance={canViewAttendance}
      canViewResults={canViewResults}
      canViewStudents={canViewStudents}
      detail={detailResult.detail}
    />
  );
}
