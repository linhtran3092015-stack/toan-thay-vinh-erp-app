import { notFound } from "next/navigation";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { CoachingDetailPage } from "@/features/coaching/coaching-detail-page";
import {
  getCoachingRecordDetailResult,
  getCoachingRecordEventsResult,
} from "@/features/coaching/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface CoachingDetailRouteProps {
  params: Promise<{ coachingId: string }>;
}

export default async function CoachingDetailRoute({
  params,
}: CoachingDetailRouteProps) {
  const { coachingId } = await params;
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Coaching."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("coaching.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền coaching.view."
        title="Không có quyền xem Coaching"
      />
    );
  }

  const detailResult = await getCoachingRecordDetailResult(coachingId);

  if (!detailResult.ok) {
    return (
      <ErrorState
        description="Không tải được thông tin phiếu Coaching từ hệ thống."
        title="Không tải được phiếu Coaching"
      />
    );
  }

  if (!detailResult.data) {
    notFound();
  }

  const eventsResult = await getCoachingRecordEventsResult(coachingId);

  if (!eventsResult.ok) {
    return (
      <ErrorState
        description="Không tải được lịch sử của phiếu Coaching."
        title="Không tải được lịch sử Coaching"
      />
    );
  }

  return (
    <CoachingDetailPage
      canManage={permissionResult.permissions.includes("coaching.manage")}
      events={eventsResult.data}
      record={detailResult.data}
    />
  );
}
