import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { StudentListPage } from "@/features/students/student-list-page";
import type { StudentListDemoState } from "@/features/students/types";
import {
  hasPermission,
  mockCurrentUser,
} from "@/lib/permissions/mock-current-user";

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
  const canViewStudents =
    demoState !== "denied" && hasPermission(mockCurrentUser, "students.view");

  if (!canViewStudents) {
    return (
      <PermissionDeniedState
        description="Mock user hiện tại không có quyền students.view, nên route /students bị chặn trước khi hiển thị danh sách."
        title="Không có quyền xem danh sách học viên"
      />
    );
  }

  return (
    <StudentListPage
      canCreateStudent={hasPermission(mockCurrentUser, "students.create")}
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
