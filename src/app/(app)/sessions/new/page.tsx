import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SessionCreateForm } from "@/features/sessions/components/session-create-form";
import { getSessionDirectoryQuery } from "@/features/sessions/session-directory-url-state";
import { getSessionCreationOptions } from "@/features/sessions/create-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface NewSessionRouteProps { searchParams: Promise<Record<string, string | string[] | undefined>>; }

export default async function NewSessionRoute({ searchParams }: NewSessionRouteProps) {
  const resolvedSearchParams = await searchParams;
  const directoryQuery = getSessionDirectoryQuery(new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []),
  ));
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền tạo buổi học."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "sessions.manage",
    )
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("sessions.manage")}
        title="Không có quyền tạo buổi học"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "classes.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại cần quyền classes.view để chọn lớp và lịch học."
        title="Không có quyền xem lớp học"
      />
    );
  }

  const optionsResult =
    await getSessionCreationOptions();

  if (!optionsResult.ok) {
    return (
      <ErrorState
        description={
          optionsResult.error.message
        }
        title="Không tải được dữ liệu tạo buổi học"
      />
    );
  }

  return (
    <SessionCreateForm
      cancelledSessions={
        optionsResult.cancelledSessions
      }
      classes={optionsResult.classes}
      schedules={optionsResult.schedules}
      directoryQuery={directoryQuery}
    />
  );
}
