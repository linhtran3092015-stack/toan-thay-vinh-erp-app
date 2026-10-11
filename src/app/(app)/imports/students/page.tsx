import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { StudentImportPage } from "@/features/imports/students/student-import-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function StudentImportRoute() {
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền import học viên từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "imports.students",
    )
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("imports.students")}
        title="Không có quyền import học viên"
      />
    );
  }

  return (
    <StudentImportPage
      canCreateStudents={permissionResult.permissions.includes(
        "students.create",
      )}
    />
  );
}
