import { resolveScheduleWeek } from "@/features/timekeeping/weekly-schedule";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import {
  getAttendanceVerificationConfig,
  getAttendanceVerificationPolicy,
  getCenterMonthlyTimekeepingOverview,
  getMyMonthlyTimekeepingEntries,
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

export default async function TimekeepingRoute({ searchParams }: {
  searchParams?: Promise<{ week?: string | string[] }>;
}) {
  const weekStart = resolveScheduleWeek((await searchParams)?.week);
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập chấm công."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const canView = permissionResult.permissions.includes("timekeeping.view");
  const canCheck = permissionResult.permissions.includes("timekeeping.check");
  const canManageVerification = permissionResult.permissions.includes(
    "timekeeping.manage_verification",
  );

  if (!canView && !canCheck && !canManageVerification) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền truy cập chấm công (yêu cầu timekeeping.check hoặc timekeeping.view)."
        title="Không có quyền truy cập chấm công"
      />
    );
  }

  const canManage = permissionResult.permissions.includes("staff.manage");
  const canApproveAdjustments = permissionResult.permissions.includes(
    "timekeeping.approve_adjustment",
  );

  const now = new Date();
  const currentMonth = Number(
    new Intl.DateTimeFormat("en-CA", { month: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(now),
  );
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(now),
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
    verificationPolicyResult,
    verificationConfigResult,
    myMonthlyEntriesResult,
    centerMonthlyOverviewResult,
  ] = await Promise.all([
    canCheck ? getMyTimekeepingAdjustableEntries() : Promise.resolve(null),
    canApproveAdjustments
      ? getTimeEntryAdjustmentApprovalQueue()
      : Promise.resolve(null),
    canCheck ? getMyTimeEntryAdjustmentRequests() : Promise.resolve(null),
    canView ? getTimekeepingSchedule(weekStart) : Promise.resolve(null),
    canView ? getTimekeepingWorkShifts() : Promise.resolve(null),
    canManage || canApproveAdjustments
      ? getTimekeepingStaffOptions()
      : Promise.resolve(null),
    canCheck ? getMyTimekeepingEntries() : Promise.resolve(null),
    canView ? getTimekeepingDayEntries() : Promise.resolve(null),
    canCheck || canManageVerification
      ? getAttendanceVerificationPolicy()
      : Promise.resolve(null),
    canManageVerification
      ? getAttendanceVerificationConfig()
      : Promise.resolve(null),
    canCheck
      ? getMyMonthlyTimekeepingEntries(currentMonth, currentYear)
      : Promise.resolve(null),
    canManage || canApproveAdjustments
      ? getCenterMonthlyTimekeepingOverview(currentMonth, currentYear)
      : Promise.resolve(null),
  ]);

  if (verificationPolicyResult && !verificationPolicyResult.ok) {
    return (
      <ErrorState
        description={verificationPolicyResult.error.message}
        title="Không tải được điều kiện xác minh chấm công"
      />
    );
  }

  if (verificationConfigResult && !verificationConfigResult.ok) {
    return (
      <ErrorState
        description={verificationConfigResult.error.message}
        title="Không tải được cấu hình GPS và Wi-Fi"
      />
    );
  }

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

  if (scheduleResult && !scheduleResult.ok) {
    return (
      <ErrorState
        description={scheduleResult.error.message}
        title="Không tải được lịch phân công"
      />
    );
  }

  if (workShiftsResult && !workShiftsResult.ok) {
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

  if (dayEntriesResult && !dayEntriesResult.ok) {
    return (
      <ErrorState
        description={dayEntriesResult.error.message}
        title="Không tải được chấm công trong ngày"
      />
    );
  }

  if (myMonthlyEntriesResult && !myMonthlyEntriesResult.ok) {
    return (
      <ErrorState
        description={myMonthlyEntriesResult.error.message}
        title="Không tải được bảng công tháng cá nhân"
      />
    );
  }

  if (centerMonthlyOverviewResult && !centerMonthlyOverviewResult.ok) {
    return (
      <ErrorState
        description={centerMonthlyOverviewResult.error.message}
        title="Không tải được bảng tổng hợp công toàn trung tâm"
      />
    );
  }

  return (
    <TimekeepingPage
      adjustmentApprovalQueue={
        adjustmentApprovalQueueResult?.ok ? adjustmentApprovalQueueResult.requests : []
      }
      adjustmentEntries={adjustmentEntriesResult?.ok ? adjustmentEntriesResult.entries : []}
      attendanceConfig={verificationConfigResult?.ok ? verificationConfigResult.config : null}
      attendancePolicy={verificationPolicyResult?.ok ? verificationPolicyResult.policy : undefined}
      canApproveAdjustments={canApproveAdjustments}
      canCheck={canCheck}
      canManage={canManage}
      canManageVerification={canManageVerification}
      canView={canView}
      centerMonthlyOverview={
        centerMonthlyOverviewResult?.ok ? centerMonthlyOverviewResult.overview : []
      }
      scheduleWeek={weekStart}
      currentMonth={currentMonth}
      currentYear={currentYear}
      dayEntries={dayEntriesResult?.ok ? dayEntriesResult.entries : []}
      entries={scheduleResult?.ok ? scheduleResult.entries : []}
      myAdjustmentRequests={adjustmentRequestsResult?.ok ? adjustmentRequestsResult.requests : []}
      myEntries={myEntriesResult?.ok ? myEntriesResult.entries : []}
      myMonthlyEntries={
        myMonthlyEntriesResult?.ok ? myMonthlyEntriesResult.entries : []
      }
      staffOptions={staffOptionsResult?.ok ? staffOptionsResult.staffOptions : []}
      workShifts={workShiftsResult?.ok ? workShiftsResult.workShifts : []}
    />
  );
}
