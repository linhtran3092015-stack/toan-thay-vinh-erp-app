import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getAcademicYearManagementData } from "@/features/classes/academic-year-data";
import { ClassFormPage } from "@/features/classes/management/class-form-page";
import { getClassDirectoryQuery } from "@/features/classes/class-directory-url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface CreateClassRouteProps { searchParams: Promise<Record<string, string | string[] | undefined>>; }

export default async function CreateClassRoute({ searchParams }: CreateClassRouteProps) {
  const resolvedSearchParams = await searchParams;
  const directoryQuery = getClassDirectoryQuery(new URLSearchParams(Object.entries(resolvedSearchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])));
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
        description={permissionDeniedDescription("classes.create")}
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
      directoryQuery={directoryQuery}
    />
  );
}
