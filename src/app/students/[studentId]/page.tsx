import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getStudentDetail } from "@/features/students/data";
import { getStudentEnrollmentUiModel } from "@/features/students/enrollment/student-enrollment-data";
import { DatabaseStudentDetailPage } from "@/features/students/detail/database-student-detail-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface StudentDetailRouteProps {
  params: Promise<{
    studentId: string;
  }>;
}

export default async function StudentDetailRoute({
  params,
}: StudentDetailRouteProps) {
  const { studentId } = await params;
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền xem hồ sơ học viên."
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
        description="Tài khoản hiện tại không có quyền students.view."
        title="Không có quyền xem hồ sơ học viên"
      />
    );
  }

  const canUpdateStudent =
    permissionResult.permissions.includes(
      "students.update",
    );

  const canManageEnrollment =
    permissionResult.permissions.includes(
      "students.manage_status",
    ) ||
    permissionResult.permissions.includes(
      "students.transfer_class",
    ) ||
    permissionResult.permissions.includes(
      "students.reserve",
    );

  const canViewClasses =
    permissionResult.permissions.includes("classes.view");

  const canViewGuardians =
    permissionResult.permissions.includes(
      "guardians.view",
    );

  const detailResult = await getStudentDetail(studentId, {
    includeClasses:
      canViewClasses || canManageEnrollment,
    includeGuardians: canViewGuardians,
  });

  if (!detailResult.ok) {
    if (
      detailResult.error.code === "student_not_found"
    ) {
      return (
        <EmptyState
          description="Hồ sơ có thể đã bị xóa, đường dẫn không chính xác hoặc tài khoản không còn quyền truy cập."
          title="Không tìm thấy học viên"
        />
      );
    }

    return (
      <ErrorState
        description={detailResult.error.message}
        title="Không tải được hồ sơ học viên"
      />
    );
  }

  const enrollmentUiModel =
    await getStudentEnrollmentUiModel(
      detailResult.detail,
      permissionResult.permissions,
    );

  return (
    <DatabaseStudentDetailPage
      canUpdateStudent={canUpdateStudent}
      canViewClasses={canViewClasses}
      canViewGuardians={canViewGuardians}
      detail={detailResult.detail}
      enrollmentUiModel={enrollmentUiModel}
    />
  );
}
