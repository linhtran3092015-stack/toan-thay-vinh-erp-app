import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getMockStudentDetail } from "@/features/students/detail/mock-student-detail";
import { StudentFormSkeleton } from "@/features/students/form/components/student-form-skeleton";
import { getDefaultStudentFormValues } from "@/features/students/form/helpers";
import { StudentFormPage } from "@/features/students/form/student-form-page";
import type { StudentFormDemoState } from "@/features/students/form/student-form-types";
import {
  hasPermission,
  mockCurrentUser,
} from "@/lib/permissions/mock-current-user";
import type { PermissionCode } from "@/types/domain";

interface EditStudentRouteProps {
  params: Promise<{
    studentId: string;
  }>;
  searchParams: Promise<{
    permission?: string | string[];
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
  const permissions = getEffectivePermissions(query.permission);
  const routeUser = { ...mockCurrentUser, permissions };
  const canUpdate =
    demoState !== "denied" && hasPermission(routeUser, "students.update");

  if (!canUpdate) {
    return (
      <PermissionDeniedState
        description="Mock user hiện tại không có quyền students.update, nên route chỉnh sửa học viên bị chặn."
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
        description="Trạng thái lỗi mock của form chỉnh sửa học viên. Chưa có API hoặc database nào được gọi."
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
      permissions={permissions}
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

function getEffectivePermissions(
  value: string | string[] | undefined,
): PermissionCode[] {
  const permissionMode = Array.isArray(value) ? value[0] : value;

  if (permissionMode === "limited-form") {
    return ["students.view", "students.update"];
  }

  if (permissionMode === "student-only") {
    return ["students.view"];
  }

  return mockCurrentUser.permissions;
}
