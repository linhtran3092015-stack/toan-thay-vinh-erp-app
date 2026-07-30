import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import {
  getMyTimeEntryAdjustmentRequests,
  getMyTimekeepingAdjustableEntries,
  getMyTimekeepingEntries,
  getTimeEntryAdjustmentApprovalQueue,
  getTimekeepingDayEntries,
  getTimekeepingSchedule,
  getTimekeepingStaffOptions,
  getTimekeepingWorkShifts,
} from "@/features/timekeeping/data";
import { TimekeepingPage } from "@/features/timekeeping/timekeeping-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function TimekeepingRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập chấm công."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("timekeeping.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền timekeeping.view."
        title="Không có quyền xem chấm công"
      />
    );
  }

  const canManage = permissionResult.permissions.includes("staff.manage");
  const canCheck = permissionResult.permissions.includes("timekeeping.check");
  const canApproveAdjustments = permissionResult.permissions.includes(
    "timekeeping.approve_adjustment",
  );
  const [
    adjustmentEntriesResult,
    adjustmentApprovalQueueResult,
    adjustmentRequestsResult,
    scheduleResult,
    workShiftsResult,
    staffOptionsResult,
    myEntriesResult,
    dayEntriesResult,
  ] = await Promise.all([
    canCheck ? getMyTimekeepingAdjustableEntries() : Promise.resolve(null),
    canApproveAdjustments
      ? getTimeEntryAdjustmentApprovalQueue()
      : Promise.resolve(null),
    canCheck ? getMyTimeEntryAdjustmentRequests() : Promise.resolve(null),
    getTimekeepingSchedule(),
    getTimekeepingWorkShifts(),
    canManage ? getTimekeepingStaffOptions() : Promise.resolve(null),
    canCheck ? getMyTimekeepingEntries() : Promise.resolve(null),
    getTimekeepingDayEntries(),
  ]);

  if (adjustmentEntriesResult && !adjustmentEntriesResult.ok) {
    return (
      <ErrorState
        description={adjustmentEntriesResult.error.message}
        title="Không tải được các lượt có thể điều chỉnh"
      />
    );
  }

  if (adjustmentRequestsResult && !adjustmentRequestsResult.ok) {
    return (
      <ErrorState
        description={adjustmentRequestsResult.error.message}
        title="Không tải được yêu cầu điều chỉnh"
      />
    );
  }

  if (adjustmentApprovalQueueResult && !adjustmentApprovalQueueResult.ok) {
    return (
      <ErrorState
        description={adjustmentApprovalQueueResult.error.message}
        title="Không tải được hàng chờ duyệt điều chỉnh"
      />
    );
  }

  if (!scheduleResult.ok) {
    return (
      <ErrorState
        description={scheduleResult.error.message}
        title="Không tải được lịch phân công"
      />
    );
  }

  if (!workShiftsResult.ok) {
    return (
      <ErrorState
        description={workShiftsResult.error.message}
        title="Không tải được danh mục ca làm"
      />
    );
  }

  if (staffOptionsResult && !staffOptionsResult.ok) {
    return (
      <ErrorState
        description={staffOptionsResult.error.message}
        title="Không tải được danh sách nhân sự"
      />
    );
  }

  if (myEntriesResult && !myEntriesResult.ok) {
    return (
      <ErrorState
        description={myEntriesResult.error.message}
        title="Không tải được chấm công của bạn"
      />
    );
  }

  if (!dayEntriesResult.ok) {
    return (
      <ErrorState
        description={dayEntriesResult.error.message}
        title="Không tải được chấm công trong ngày"
      />
    );
  }

  return (
    <TimekeepingPage
      adjustmentApprovalQueue={
        adjustmentApprovalQueueResult?.ok ? adjustmentApprovalQueueResult.requests : []
      }
      adjustmentEntries={adjustmentEntriesResult?.ok ? adjustmentEntriesResult.entries : []}
      canApproveAdjustments={canApproveAdjustments}
      canCheck={canCheck}
      canManage={canManage}
      dayEntries={dayEntriesResult.entries}
      entries={scheduleResult.entries}
      myEntries={myEntriesResult?.ok ? myEntriesResult.entries : []}
      myAdjustmentRequests={adjustmentRequestsResult?.ok ? adjustmentRequestsResult.requests : []}
      staffOptions={staffOptionsResult?.ok ? staffOptionsResult.staffOptions : []}
      workShifts={workShiftsResult.workShifts}
    />
  );
}
