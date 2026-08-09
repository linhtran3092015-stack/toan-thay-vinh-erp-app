import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getAdditionalStudyCandidates } from "@/features/sessions/attendance-data";
import { getSessionDetail } from "@/features/sessions/detail-data";
import { SessionDetailPage } from "@/features/sessions/session-detail-page";
import { getSessionDirectoryQuery } from "@/features/sessions/session-directory-url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface SessionDetailRouteProps {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function SessionDetailRoute({
  params,
  searchParams,
}: SessionDetailRouteProps) {
  const { sessionId } = await params;
  const resolvedSearchParams = await searchParams;
  const directoryQuery = getSessionDirectoryQuery(new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []),
  ));

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

  const canManageResults =
    permissionResult.permissions.includes(
      "results.manage",
    );

  const canMarkAttendance =
    permissionResult.permissions.includes(
      "attendance.mark",
    );

  const canLockSession =
    permissionResult.permissions.includes(
      "sessions.lock",
    );

  const canViewStudents =
    permissionResult.permissions.includes(
      "students.view",
    );

  const detailResult = await getSessionDetail(
    sessionId,
    {
      includeAttendance:
        canViewAttendance ||
        canMarkAttendance ||
        canLockSession,
      includeResults:
        canViewResults ||
        canManageResults ||
        canLockSession,
      includeRoster:
        canViewStudents ||
        canLockSession,
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

  const canAddAdditionalStudy =
    canMarkAttendance &&
    canViewStudents &&
    detailResult.detail.lockedAt === null &&
    (
      detailResult.detail.status ===
        "in_progress" ||
      detailResult.detail.status ===
        "completed"
    );

  const candidateResult =
    canAddAdditionalStudy
      ? await getAdditionalStudyCandidates()
      : {
          ok: true as const,
          students: [],
        };

  if (!candidateResult.ok) {
    return (
      <ErrorState
        description={
          candidateResult.error.message
        }
        title="Không tải được học viên học thêm"
      />
    );
  }

  return (
    <SessionDetailPage
      additionalStudyCandidates={
        candidateResult.students
      }
      canLockSession={
        canLockSession
      }
      canManageResults={
        canManageResults
      }
      canManageSessions={permissionResult.permissions.includes(
        "sessions.manage",
      )}
      canMarkAttendance={
        canMarkAttendance
      }
      canViewAttendance={canViewAttendance}
      canViewResults={canViewResults}
      canViewStudents={canViewStudents}
      detail={detailResult.detail}
      directoryQuery={directoryQuery}
    />
  );
}
