import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import {
  getStudentProfileFormDefaults,
} from "@/features/students/form/student-profile-form-helpers";
import { StudentFormPage } from "@/features/students/form/student-form-page";
import { getStudentDirectoryQuery, withStudentDirectoryQuery } from "@/features/students/student-directory-url-state";
import {
  getCachedDatabasePermissions,
} from "@/lib/permissions/database-permissions";

interface NewStudentRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewStudentRoute({ searchParams }: NewStudentRouteProps) {
  const requestedSearchParams = await searchParams;
  const directoryParams = new URLSearchParams();
  Object.entries(requestedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") directoryParams.set(key, value);
  });
  const returnQuery = getStudentDirectoryQuery(directoryParams);
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền tạo học viên từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "students.create",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền students.create."
        title="Không có quyền tạo học viên"
      />
    );
  }

  return (
    <StudentFormPage
      cancelHref={withStudentDirectoryQuery("/students", directoryParams)}
      defaultValues={getStudentProfileFormDefaults(
        "create",
      )}
      mode="create"
      returnQuery={returnQuery}
    />
  );
}
