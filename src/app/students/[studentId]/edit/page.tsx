import { z } from "zod";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getStudentDetail } from "@/features/students/data";
import {
  getStudentProfileFormDefaults,
} from "@/features/students/form/student-profile-form-helpers";
import { StudentFormPage } from "@/features/students/form/student-form-page";
import {
  getCachedDatabasePermissions,
} from "@/lib/permissions/database-permissions";

interface EditStudentRouteProps {
  params: Promise<{
    studentId: string;
  }>;
}

const studentIdSchema = z.string().uuid();

export default async function EditStudentRoute({
  params,
}: EditStudentRouteProps) {
  const { studentId } = await params;

  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền chỉnh sửa học viên từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const canUpdate =
    permissionResult.permissions.includes(
      "students.view",
    ) &&
    permissionResult.permissions.includes(
      "students.update",
    );

  if (!canUpdate) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại cần có cả quyền students.view và students.update."
        title="Không có quyền chỉnh sửa học viên"
      />
    );
  }

  if (!studentIdSchema.safeParse(studentId).success) {
    return (
      <EmptyState
        description="Mã học viên trên đường dẫn không hợp lệ."
        title="Không tìm thấy học viên"
      />
    );
  }

  const result = await getStudentDetail(studentId, {
    includeClasses: false,
    includeGuardians: true,
  });

  if (!result.ok) {
    if (result.error.code === "student_not_found") {
      return (
        <EmptyState
          description="Không tìm thấy hồ sơ học viên trong cơ sở dữ liệu."
          title="Không tìm thấy học viên"
        />
      );
    }

    return (
      <ErrorState
        description={result.error.message}
        title="Không tải được hồ sơ học viên"
      />
    );
  }

  return (
    <StudentFormPage
      cancelHref={`/students/${studentId}`}
      defaultValues={getStudentProfileFormDefaults(
        "edit",
        result.detail,
      )}
      lifecycleStatus={
        result.detail.lifecycleStatus
      }
      mode="edit"
    />
  );
}
