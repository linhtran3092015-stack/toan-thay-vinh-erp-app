import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getAcademicYearManagementData } from "@/features/classes/academic-year-data";
import { ClassFormPage } from "@/features/classes/management/class-form-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function CreateClassRoute() {
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền tạo lớp."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "classes.create",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền classes.create."
        title="Không có quyền tạo lớp"
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
        description="Tài khoản hiện tại không có quyền classes.view để chọn năm học."
        title="Không có quyền xem dữ liệu lớp"
      />
    );
  }

  const dataResult =
    await getAcademicYearManagementData();

  if (!dataResult.ok) {
    return (
      <ErrorState
        description={dataResult.error.message}
        title="Không tải được danh sách năm học"
      />
    );
  }

  const openAcademicYears =
    dataResult.academicYears.filter(
      (academicYear) =>
        academicYear.status === "draft" ||
        academicYear.status === "active",
    );

  return (
    <ClassFormPage
      academicYears={openAcademicYears}
    />
  );
}
