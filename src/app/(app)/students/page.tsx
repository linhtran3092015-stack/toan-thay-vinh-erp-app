import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getStudentDirectory, getStudentDirectoryMetrics } from "@/features/students/data";
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

  const permissions = permissionResult.permissions;
  const [directoryResult, metrics] = await Promise.all([
    getStudentDirectory({
      includeClasses: permissions.includes("classes.view"),
      includeGuardians: permissions.includes("guardians.view"),
    }),
    getStudentDirectoryMetrics({
      includeAttendance: permissions.includes("attendance.view") && permissions.includes("sessions.view"),
      includeBalance: permissions.includes("session_ledger.view"),
      includeDebt: permissions.includes("payments.view"),
    }),
  ]);

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
      canImportStudents={permissionResult.permissions.includes(
        "imports.students",
      )}
      canManageStatus={permissionResult.permissions.includes(
        "students.manage_status",
      )}
      metrics={metrics}
      students={directoryResult.students}
    />
  );
}
