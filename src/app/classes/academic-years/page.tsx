import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getAcademicYearManagementData } from "@/features/classes/academic-year-data";
import { AcademicYearManagementPage } from "@/features/classes/management/academic-year-management-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function AcademicYearsRoute() {
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập năm học."
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
        title="Không có quyền xem năm học"
      />
    );
  }

  const dataResult =
    await getAcademicYearManagementData();

  if (!dataResult.ok) {
    return (
      <ErrorState
        description={dataResult.error.message}
        title="Không tải được dữ liệu năm học"
      />
    );
  }

  return (
    <AcademicYearManagementPage
      academicYears={dataResult.academicYears}
      canManageAcademicYears={permissionResult.permissions.includes(
        "classes.create",
      )}
    />
  );
}
