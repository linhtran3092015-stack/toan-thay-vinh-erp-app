import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { EnrollmentImportPage } from "@/features/imports/enrollments/enrollment-import-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
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
        description={permissionDeniedDescription("imports.enrollments")}
        title="Không có quyền import ghi danh học viên"
      />
    );
  }

  return <EnrollmentImportPage />;
}
