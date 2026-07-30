import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { CoachingListPage } from "@/features/coaching/coaching-list-page";
import { getCoachingRecordsDashboardResult } from "@/features/coaching/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function CoachingRoute() {
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

  const coachingResult = await getCoachingRecordsDashboardResult();

  if (!coachingResult.ok) {
    return (
      <ErrorState
        description="Không tải được danh sách phiếu Coaching từ hệ thống."
        title="Không tải được Coaching"
      />
    );
  }

  return <CoachingListPage entries={coachingResult.data} />;
}
