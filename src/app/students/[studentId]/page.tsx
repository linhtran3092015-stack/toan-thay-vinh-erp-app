import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { StudentDetailEmptyState } from "@/features/students/detail/components/student-detail-empty-state";
import { StudentDetailErrorState } from "@/features/students/detail/components/student-detail-error-state";
import { StudentDetailSkeleton } from "@/features/students/detail/components/student-detail-skeleton";
import { getMockStudentDetail } from "@/features/students/detail/mock-student-detail";
import { StudentDetailPage } from "@/features/students/detail/student-detail-page";
import type { StudentDetailDemoState } from "@/features/students/detail/types";
import {
  hasPermission,
  mockCurrentUser,
} from "@/lib/permissions/mock-current-user";
import type { PermissionCode } from "@/types/domain";

interface StudentDetailRouteProps {
  params: Promise<{
    studentId: string;
  }>;
  searchParams: Promise<{
    permission?: string | string[];
    state?: string | string[];
  }>;
}

export default async function StudentDetailRoute({
  params,
  searchParams,
}: StudentDetailRouteProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const demoState = parseDemoState(query.state);
  const permissions = getEffectivePermissions(query.permission);
  const canViewStudents =
    demoState !== "denied" &&
    hasPermission(
      { ...mockCurrentUser, permissions },
      "students.view",
    );

  if (!canViewStudents) {
    return (
      <PermissionDeniedState
        description="Mock user hiện tại không có quyền students.view, nên route chi tiết học viên bị chặn."
        title="Không có quyền xem hồ sơ học viên"
      />
    );
  }

  if (demoState === "loading") {
    return <StudentDetailSkeleton />;
  }

  if (demoState === "error") {
    return <StudentDetailErrorState />;
  }

  const detail = getMockStudentDetail(studentId);

  if (demoState === "not-found" || !detail) {
    return <StudentDetailEmptyState />;
  }

  return <StudentDetailPage detail={detail} permissions={permissions} />;
}

function parseDemoState(
  value: string | string[] | undefined,
): StudentDetailDemoState {
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

  if (permissionMode === "student-only") {
    return ["students.view"];
  }

  return mockCurrentUser.permissions;
}
