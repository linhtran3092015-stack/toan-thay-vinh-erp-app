import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ClassListPage } from "@/features/classes/class-list-page";
import { getClassDirectory } from "@/features/classes/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function ClassesRoute() {
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập lớp học."
        title="Không tải được quyền truy cập"
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
        description="Tài khoản hiện tại không có quyền classes.view."
        title="Không có quyền xem lớp học"
      />
    );
  }

  const directoryResult = await getClassDirectory({
    includeStudentCounts:
      permissionResult.permissions.includes(
        "students.view",
      ),
  });

  if (!directoryResult.ok) {
    return (
      <ErrorState
        description={directoryResult.error.message}
        title="Không tải được danh sách lớp học"
      />
    );
  }

  return (
    <ClassListPage
      canCreateClass={permissionResult.permissions.includes(
        "classes.create",
      )}
      classes={directoryResult.classes}
    />
  );
}
