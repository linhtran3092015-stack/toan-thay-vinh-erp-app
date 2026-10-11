import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getStudentDirectory } from "@/features/students/data";
import { StudentListPage } from "@/features/students/student-list-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function StudentsRoute() {
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền học viên từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "students.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("students.view")}
        title="Không có quyền xem danh sách học viên"
      />
    );
  }

  const directoryResult = await getStudentDirectory({
    includeClasses:
      permissionResult.permissions.includes(
        "classes.view",
      ),
    includeGuardians:
      permissionResult.permissions.includes(
        "guardians.view",
      ),
  });

  if (!directoryResult.ok) {
    return (
      <ErrorState
        description={directoryResult.error.message}
        title="Không tải được danh sách học viên"
      />
    );
  }

  return (
    <StudentListPage
      canCreateStudent={permissionResult.permissions.includes(
        "students.create",
      )}
      canManageStatus={permissionResult.permissions.includes(
        "students.manage_status",
      )}
      students={directoryResult.students}
    />
  );
}
