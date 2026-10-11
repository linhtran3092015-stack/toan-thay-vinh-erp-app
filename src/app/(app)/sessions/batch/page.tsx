import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getSessionDirectoryQuery } from "@/features/sessions/session-directory-url-state";
import { getBatchSessionCreationContext } from "@/features/sessions/batch-data";
import { BatchSessionCreateWorkspace } from "@/features/sessions/components/batch-session-create-workspace";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface BatchSessionsRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BatchSessionsRoute({ searchParams }: BatchSessionsRouteProps) {
  const resolvedSearchParams = await searchParams;
  const directoryQuery = getSessionDirectoryQuery(
    new URLSearchParams(
      Object.entries(resolvedSearchParams).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    ),
  );

  const targetClassId =
    typeof resolvedSearchParams.classId === "string" ? resolvedSearchParams.classId : undefined;

  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền tạo buổi học hàng loạt."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("sessions.manage")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("sessions.manage")}
        title="Không có quyền quản lý buổi học"
      />
    );
  }

  if (!permissionResult.permissions.includes("classes.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại cần quyền classes.view để chọn lớp học và xem thời khóa biểu."
        title="Không có quyền xem lớp học"
      />
    );
  }

  const contextResult = await getBatchSessionCreationContext(targetClassId);

  if (!contextResult.ok) {
    return (
      <ErrorState
        description={contextResult.error}
        title="Không tải được dữ liệu tạo buổi học hàng loạt"
      />
    );
  }

  if (contextResult.data.classes.length === 0) {
    return (
      <ErrorState
        description="Hiện tại không có lớp học nào đang hoạt động (active) để tạo buổi học."
        title="Chưa có lớp học hoạt động"
      />
    );
  }

  return (
    <BatchSessionCreateWorkspace
      classes={contextResult.data.classes}
      directoryQuery={directoryQuery}
      existingSessionCount={contextResult.data.existingSessionCount}
      existingSessions={contextResult.data.existingSessions}
      schedules={contextResult.data.schedules}
      selectedClassId={contextResult.data.targetClassId || contextResult.data.classes[0].id}
    />
  );
}
