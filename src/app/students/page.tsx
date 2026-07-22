import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { StudentListPage } from "@/features/students/student-list-page";
import type { StudentListDemoState } from "@/features/students/types";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface StudentsRouteProps {
  searchParams: Promise<{
    state?: string | string[];
  }>;
}

export default async function StudentsRoute({
  searchParams,
}: StudentsRouteProps) {
  const params = await searchParams;
  const demoState = parseDemoState(params.state);
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền học viên từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const canViewStudents =
    demoState !== "denied" &&
    permissionResult.permissions.includes("students.view");

  if (!canViewStudents) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền students.view."
        title="Không có quyền xem danh sách học viên"
      />
    );
  }

  return (
    <StudentListPage
      canCreateStudent={permissionResult.permissions.includes(
        "students.create",
      )}
      demoState={demoState}
    />
  );
}

function parseDemoState(
  value: string | string[] | undefined,
): StudentListDemoState {
  const state = Array.isArray(value) ? value[0] : value;

  if (
    state === "denied" ||
    state === "empty" ||
    state === "error" ||
    state === "loading"
  ) {
    return state;
  }

  return "default";
}
