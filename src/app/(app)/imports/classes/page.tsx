import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ClassScheduleImportPage } from "@/features/imports/classes/class-schedule-import-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function ClassScheduleImportRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền import lớp & lịch học từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("imports.classes")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền imports.classes."
        title="Không có quyền import lớp & lịch học"
      />
    );
  }

  return <ClassScheduleImportPage />;
}
