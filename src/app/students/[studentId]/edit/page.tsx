import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getMockStudentDetail } from "@/features/students/detail/mock-student-detail";
import { StudentFormSkeleton } from "@/features/students/form/components/student-form-skeleton";
import { getDefaultStudentFormValues } from "@/features/students/form/helpers";
import { StudentFormPage } from "@/features/students/form/student-form-page";
import type { StudentFormDemoState } from "@/features/students/form/student-form-types";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { toLegacyPermissions } from "@/lib/permissions/legacy-permission-adapter";

interface EditStudentRouteProps {
  params: Promise<{
    studentId: string;
  }>;
  searchParams: Promise<{
    state?: string | string[];
  }>;
}

export default async function EditStudentRoute({
  params,
  searchParams,
}: EditStudentRouteProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const demoState = parseDemoState(query.state);
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền chỉnh sửa học viên từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const canUpdate =
    demoState !== "denied" &&
    permissionResult.permissions.includes("students.view") &&
    permissionResult.permissions.includes("students.update");

  if (!canUpdate) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại cần có cả quyền students.view và students.update."
        title="Không có quyền chỉnh sửa học viên"
      />
    );
  }

  if (demoState === "loading") {
    return <StudentFormSkeleton />;
  }

  if (demoState === "error") {
    return (
      <ErrorState
        description="Trạng thái lỗi mô phỏng của form chỉnh sửa học viên. Chưa có API ghi dữ liệu nào được gọi."
        title="Không tải được form chỉnh sửa"
      />
    );
  }

  const detail = getMockStudentDetail(studentId);

  if (demoState === "not-found" || !detail) {
    return (
      <EmptyState
        description="Không tìm thấy hồ sơ học viên trong dữ liệu mock Task 2B."
        title="Không tìm thấy học viên"
      />
    );
  }

  return (
    <StudentFormPage
      cancelHref={`/students/${studentId}`}
      defaultValues={getDefaultStudentFormValues("edit", detail)}
      mode="edit"
      permissions={toLegacyPermissions(permissionResult.permissions)}
    />
  );
}

function parseDemoState(
  value: string | string[] | undefined,
): StudentFormDemoState {
  const state = Array.isArray(value) ? value[0] : value;

  if (
    state === "denied" ||
    state === "error" ||
    state === "loading" ||
    state === "not-found"
  ) {
    return state;
  }

  return "default";
}
