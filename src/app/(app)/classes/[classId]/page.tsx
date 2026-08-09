import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ClassDetailPage } from "@/features/classes/class-detail-page";
import { getClassDirectoryQuery } from "@/features/classes/class-directory-url-state";
import { getClassDetail } from "@/features/classes/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface ClassDetailRouteProps {
  params: Promise<{
    classId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ClassDetailRoute({
  params,
  searchParams,
}: ClassDetailRouteProps) {
  const { classId } = await params;
  const resolvedSearchParams = await searchParams;
  const directoryQuery = getClassDirectoryQuery(new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []),
  ));
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập lớp học."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "classes.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền classes.view."
        title="Không có quyền xem lớp học"
      />
    );
  }

  if (!UUID_PATTERN.test(classId)) {
    return (
      <EmptyState
        description="Mã lớp trên đường dẫn không hợp lệ."
        title="Không tìm thấy lớp học"
      />
    );
  }

  const canViewStudentCount =
    permissionResult.permissions.includes(
      "students.view",
    );

  const canEditClass =
    permissionResult.permissions.includes(
      "classes.create",
    );

  const canManageSchedule =
    permissionResult.permissions.includes(
      "classes.manage_schedule",
    );

  const detailResult = await getClassDetail(classId, {
    includeStudentCounts: canViewStudentCount,
  });

  if (!detailResult.ok) {
    if (
      detailResult.error.code === "class_not_found"
    ) {
      return (
        <EmptyState
          description="Lớp học có thể không tồn tại hoặc đường dẫn không còn hợp lệ."
          title="Không tìm thấy lớp học"
        />
      );
    }

    return (
      <ErrorState
        description={detailResult.error.message}
        title="Không tải được thông tin lớp học"
      />
    );
  }

  return (
    <ClassDetailPage
      canEditClass={canEditClass}
      canManageSchedule={canManageSchedule}
      canViewStudentCount={canViewStudentCount}
      directoryQuery={directoryQuery}
      detail={detailResult.detail}
    />
  );
}
