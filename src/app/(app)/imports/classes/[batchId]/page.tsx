import { notFound } from "next/navigation";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ClassScheduleBatchDetailPage } from "@/features/imports/classes/class-schedule-batch-detail-page";
import { getClassScheduleImportBatchDetail } from "@/features/imports/classes/queries";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface ClassScheduleBatchDetailRouteProps {
  params: Promise<{
    batchId: string;
  }>;
}

export default async function ClassScheduleBatchDetailRoute({
  params,
}: ClassScheduleBatchDetailRouteProps) {
  const { batchId } = await params;

  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập đối soát lớp học từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const hasViewPermission = permissionResult.permissions.includes(
    "imports.classes"
  );

  if (!hasViewPermission) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền xem chi tiết batch import lớp học & lịch học."
        title="Không có quyền truy cập"
      />
    );
  }

  const detail = await getClassScheduleImportBatchDetail(batchId);

  if (!detail) {
    notFound();
  }

  return <ClassScheduleBatchDetailPage detail={detail} />;
}
