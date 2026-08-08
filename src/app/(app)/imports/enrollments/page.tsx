import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { EnrollmentImportPage } from "@/features/imports/enrollments/enrollment-import-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function StudentEnrollmentImportRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền import ghi danh học viên từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("imports.enrollments")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền imports.enrollments."
        title="Không có quyền import ghi danh học viên"
      />
    );
  }

  return <EnrollmentImportPage />;
}
