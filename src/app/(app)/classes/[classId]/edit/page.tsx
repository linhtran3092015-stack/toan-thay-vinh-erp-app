import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getAcademicYearManagementData } from "@/features/classes/academic-year-data";
import { getClassDetail } from "@/features/classes/data";
import { ClassFormPage } from "@/features/classes/management/class-form-page";
import { getClassDirectoryQuery } from "@/features/classes/class-directory-url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface EditClassRouteProps {
  params: Promise<{
    classId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditClassRoute({
  params,
  searchParams,
}: EditClassRouteProps) {
  const { classId } = await params;
  const resolvedSearchParams = await searchParams;
  const directoryQuery = getClassDirectoryQuery(new URLSearchParams(Object.entries(resolvedSearchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])));

  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền chỉnh sửa lớp học."
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

  if (
    !permissionResult.permissions.includes(
      "classes.create",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền classes.create."
        title="Không có quyền chỉnh sửa lớp"
      />
    );
  }

  if (!UUID_PATTERN.test(classId)) {
    return (
      <EmptyState
        description="Mã lớp trên đường dẫn không hợp lệ."
        title="Không tìm thấy lớp học"
      />
    );
  }

  const [
    detailResult,
    academicYearResult,
  ] = await Promise.all([
    getClassDetail(classId, {
      includeStudentCounts: false,
    }),
    getAcademicYearManagementData(),
  ]);

  if (!detailResult.ok) {
    if (
      detailResult.error.code ===
      "class_not_found"
    ) {
      return (
        <EmptyState
          description="Lớp học có thể không tồn tại hoặc đường dẫn không còn hợp lệ."
          title="Không tìm thấy lớp học"
        />
      );
    }

    return (
      <ErrorState
        description={detailResult.error.message}
        title="Không tải được thông tin lớp học"
      />
    );
  }

  if (!academicYearResult.ok) {
    return (
      <ErrorState
        description={
          academicYearResult.error.message
        }
        title="Không tải được danh sách năm học"
      />
    );
  }

  if (
    !["draft", "active"].includes(
      detailResult.detail.status,
    )
  ) {
    return (
      <ErrorState
        description="Chỉ lớp ở trạng thái nháp hoặc đang hoạt động mới có thể chỉnh sửa."
        title="Không thể chỉnh sửa lớp"
      />
    );
  }

  if (!detailResult.detail.academicYear) {
    return (
      <ErrorState
        description="Lớp học chưa được liên kết với năm học hợp lệ."
        title="Dữ liệu lớp chưa đầy đủ"
      />
    );
  }

  const openAcademicYears =
    academicYearResult.academicYears.filter(
      (academicYear) =>
        academicYear.status === "draft" ||
        academicYear.status === "active",
    );

  const currentAcademicYearIsOpen =
    openAcademicYears.some(
      (academicYear) =>
        academicYear.id ===
        detailResult.detail.academicYear?.id,
    );

  if (!currentAcademicYearIsOpen) {
    return (
      <ErrorState
        description="Năm học của lớp đã đóng hoặc lưu trữ nên lớp không thể chỉnh sửa."
        title="Không thể chỉnh sửa lớp"
      />
    );
  }

  return (
    <ClassFormPage
      academicYears={openAcademicYears}
      classDetail={detailResult.detail}
      directoryQuery={directoryQuery}
    />
  );
}
