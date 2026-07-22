import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { StudentDetailEmptyState } from "@/features/students/detail/components/student-detail-empty-state";
import { StudentDetailErrorState } from "@/features/students/detail/components/student-detail-error-state";
import { StudentDetailSkeleton } from "@/features/students/detail/components/student-detail-skeleton";
import { getMockStudentDetail } from "@/features/students/detail/mock-student-detail";
import { StudentDetailPage } from "@/features/students/detail/student-detail-page";
import type { StudentDetailDemoState } from "@/features/students/detail/types";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { toLegacyPermissions } from "@/lib/permissions/legacy-permission-adapter";

interface StudentDetailRouteProps {
  params: Promise<{
    studentId: string;
  }>;
  searchParams: Promise<{
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
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền xem hồ sơ học viên từ cơ sở dữ liệu."
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

  return (
    <StudentDetailPage
      detail={detail}
      permissions={toLegacyPermissions(permissionResult.permissions)}
    />
  );
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
