import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { StudentFormSkeleton } from "@/features/students/form/components/student-form-skeleton";
import { getDefaultStudentFormValues } from "@/features/students/form/helpers";
import { StudentFormPage } from "@/features/students/form/student-form-page";
import type { StudentFormDemoState } from "@/features/students/form/student-form-types";
import {
  hasPermission,
  mockCurrentUser,
} from "@/lib/permissions/mock-current-user";
import type { PermissionCode } from "@/types/domain";

interface NewStudentRouteProps {
  searchParams: Promise<{
    permission?: string | string[];
    state?: string | string[];
  }>;
}

export default async function NewStudentRoute({
  searchParams,
}: NewStudentRouteProps) {
  const query = await searchParams;
  const demoState = parseDemoState(query.state);
  const permissions = getEffectivePermissions(query.permission);
  const routeUser = { ...mockCurrentUser, permissions };
  const canCreate =
    demoState !== "denied" && hasPermission(routeUser, "students.create");

  if (!canCreate) {
    return (
      <PermissionDeniedState
        description="Mock user hiện tại không có quyền students.create, nên route /students/new bị chặn trước khi mở form."
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
        description="Trạng thái lỗi mock của form tạo học viên. Chưa có API hoặc database nào được gọi."
        title="Không tải được form tạo học viên"
      />
    );
  }

  return (
    <StudentFormPage
      cancelHref="/students"
      defaultValues={getDefaultStudentFormValues("create")}
      mode="create"
      permissions={permissions}
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

function getEffectivePermissions(
  value: string | string[] | undefined,
): PermissionCode[] {
  const permissionMode = Array.isArray(value) ? value[0] : value;

  if (permissionMode === "limited-form") {
    return ["students.view", "students.create"];
  }

  if (permissionMode === "student-only") {
    return ["students.view"];
  }

  return mockCurrentUser.permissions;
}
