import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { StudentFormSkeleton } from "@/features/students/form/components/student-form-skeleton";
import { getDefaultStudentFormValues } from "@/features/students/form/helpers";
import { StudentFormPage } from "@/features/students/form/student-form-page";
import type { StudentFormDemoState } from "@/features/students/form/student-form-types";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { toLegacyPermissions } from "@/lib/permissions/legacy-permission-adapter";

interface NewStudentRouteProps {
  searchParams: Promise<{
    state?: string | string[];
  }>;
}

export default async function NewStudentRoute({
  searchParams,
}: NewStudentRouteProps) {
  const query = await searchParams;
  const demoState = parseDemoState(query.state);
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền tạo học viên từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const canCreate =
    demoState !== "denied" &&
    permissionResult.permissions.includes("students.create");

  if (!canCreate) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền students.create."
        title="Không có quyền tạo học viên"
      />
    );
  }

  if (demoState === "loading") {
    return <StudentFormSkeleton />;
  }

  if (demoState === "error") {
    return (
      <ErrorState
        description="Trạng thái lỗi mô phỏng của form tạo học viên. Chưa có API ghi dữ liệu nào được gọi."
        title="Không tải được form tạo học viên"
      />
    );
  }

  return (
    <StudentFormPage
      cancelHref="/students"
      defaultValues={getDefaultStudentFormValues("create")}
      mode="create"
      permissions={toLegacyPermissions(permissionResult.permissions)}
    />
  );
}

function parseDemoState(
  value: string | string[] | undefined,
): StudentFormDemoState {
  const state = Array.isArray(value) ? value[0] : value;

  if (state === "denied" || state === "error" || state === "loading") {
    return state;
  }

  return "default";
}
