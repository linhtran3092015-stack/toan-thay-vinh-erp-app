import { WeeklySchedulePanel } from "@/features/timekeeping/components/weekly-schedule-panel";
import { resolveScheduleWeek } from "@/features/timekeeping/weekly-schedule";
import { AttendanceExceptionPanel } from "@/features/timekeeping/components/attendance-exception-panel";
import { TimekeepingAdjustmentApprovalQueue } from "@/features/timekeeping/components/timekeeping-adjustment-approval-queue";
import { TimekeepingAdjustmentRequests } from "@/features/timekeeping/components/timekeeping-adjustment-requests";
import { AttendanceVerificationSettings } from "@/features/timekeeping/components/attendance-verification-settings";
import { MyTimekeepingPanel } from "@/features/timekeeping/components/my-timekeeping-panel";
import { TimekeepingDayEntries } from "@/features/timekeeping/components/timekeeping-day-entries";
import { MyMonthlyTimesheetPanel } from "@/features/timekeeping/components/my-monthly-timesheet-panel";
import { CenterMonthlyTimesheetManagement } from "@/features/timekeeping/components/center-monthly-timesheet-management";
import { WorkShiftDialog } from "@/features/timekeeping/components/work-shift-dialog";
import { WorkShiftRetireAction } from "@/features/timekeeping/components/work-shift-retire-action";
import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import type { TimekeepingActionOverrides } from "@/features/timekeeping/timekeeping-action-overrides";
import type {
  AttendanceVerificationConfig,
  AttendanceVerificationPolicy,
  TimekeepingAdjustableEntry,
  TimekeepingAdjustmentApprovalQueueEntry,
  TimekeepingAdjustmentRequest,
  TimekeepingCenterMonthlyOverviewEntry,
  TimekeepingDayEntry,
  TimekeepingMonthlyEntry,
  TimekeepingMyEntry,
  TimekeepingScheduleEntry,
  TimekeepingStaffOption,
  TimekeepingWorkShift,
} from "@/features/timekeeping/types";

interface TimekeepingPageProps {
  /** Inert replacements for the /dev/timekeeping preview (staff sections only); real pages pass nothing. */
  actions?: TimekeepingActionOverrides;
  scheduleWeek?: string;
  attendanceConfig?: AttendanceVerificationConfig | null;
  attendancePolicy?: AttendanceVerificationPolicy;
  canCheck: boolean;
  canManage: boolean;
  canManageVerification?: boolean;
  canApproveAdjustments: boolean;
  canView?: boolean;
  adjustmentEntries: readonly TimekeepingAdjustableEntry[];
  adjustmentApprovalQueue: readonly TimekeepingAdjustmentApprovalQueueEntry[];
  centerMonthlyOverview?: readonly TimekeepingCenterMonthlyOverviewEntry[];
  currentMonth?: number;
  currentYear?: number;
  dayEntries: readonly TimekeepingDayEntry[];
  entries: readonly TimekeepingScheduleEntry[];
  myEntries: readonly TimekeepingMyEntry[];
  myMonthlyEntries?: readonly TimekeepingMonthlyEntry[];
  myAdjustmentRequests: readonly TimekeepingAdjustmentRequest[];
  staffOptions: readonly TimekeepingStaffOption[];
  workShifts: readonly TimekeepingWorkShift[];
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatBreak(minutes: number): string {
  if (minutes === 0) {
    return "Không nghỉ";
  }

  return `${minutes} phút`;
}

export function TimekeepingPage({
  actions,
  scheduleWeek = resolveScheduleWeek(undefined),
  attendanceConfig = null,
  attendancePolicy = {
    attendanceRadiusM: 100,
    centerName: "Trung tâm",
    configured: false,
    continuousGpsTrackingRequired: false,
    gpsMaxAccuracyM: 100,
    gpsRequiredForOffline: true,
    wifiRequiredForOffline: false,
  },
  canCheck,
  canManage,
  canManageVerification = false,
  canApproveAdjustments,
  canView = true,
  adjustmentApprovalQueue = [],
  adjustmentEntries = [],
  centerMonthlyOverview = [],
  currentMonth,
  currentYear,
  dayEntries = [],
  entries = [],
  myEntries = [],
  myMonthlyEntries = [],
  myAdjustmentRequests = [],
  staffOptions = [],
  workShifts = [],
}: TimekeepingPageProps) {
  const activeWorkShifts = workShifts.filter((shift) => shift.isActive);
  const assignedEntries = entries.filter((entry) => entry.isActive !== false);
  const staffCount = new Set(assignedEntries.map((entry) => entry.staffId)).size;
  const exceptionPanel = attendancePolicy.exceptionReviewEnabled && (canCheck || canApproveAdjustments) ? (
    <AttendanceExceptionPanel actions={actions} canApprove={canApproveAdjustments} refreshKey={myEntries.map((entry) => `${entry.id}:${entry.status}`).join(",")} />
  ) : null;
  const myPanel = canCheck ? (
    <MyTimekeepingPanel
      actions={actions}
      attendancePolicy={attendancePolicy}
      canCheck={canCheck}
      entries={myEntries}
    />
  ) : null;
  const myMonthlyPanel = canCheck ? (
    <MyMonthlyTimesheetPanel
      actions={actions}
      canCheck={canCheck}
      initialEntries={myMonthlyEntries}
      initialMonth={currentMonth}
      initialYear={currentYear}
    />
  ) : null;
  const myAdjustmentRequestsPanel = canCheck ? (
    <TimekeepingAdjustmentRequests
      actions={actions}
      canCheck={canCheck}
      entries={adjustmentEntries}
      requests={myAdjustmentRequests}
    />
  ) : null;

  // Design 14 (mobile-first): a person who only checks in/out gets the action
  // first. Anyone with a management permission keeps the full page (step 16).
  const isStaffOnly = canCheck && !canView && !canManage && !canManageVerification && !canApproveAdjustments;

  if (isStaffOnly) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 md:gap-6">
        <PageHeader className="max-md:sr-only" title="Chấm công">
          <p className="mt-1 text-secondary text-text-muted">
            Thực hiện chấm công cá nhân và quản lý yêu cầu điều chỉnh công.
          </p>
        </PageHeader>
        {myPanel}
        {exceptionPanel}
        {myMonthlyPanel}
        {myAdjustmentRequestsPanel}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {exceptionPanel}
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface-1 p-6 shadow-xs md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-wider text-primary">
            Quản Lý Nhân Sự
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Chấm công & Ca làm</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-muted">
            {canView
              ? "Quản lý danh mục ca làm việc, chấm công di động và lịch phân công nhân sự theo từng tuần."
              : "Thực hiện chấm công cá nhân và quản lý yêu cầu điều chỉnh công."}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
          {canManage ? (
            <>
              <WorkShiftDialog />
            </>
          ) : null}
          <Badge tone={canManage ? "info" : canView ? "neutral" : "success"}>
            {canManage ? "Quyền Quản lý" : canView ? "Chỉ đọc" : "Cá nhân"}
          </Badge>
        </div>
      </header>

      {/* KPI Metrics - Visible only for administrative readers */}
      {canView ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Phân công trong tuần đang xem" value={assignedEntries.length} />
          <SummaryCard label="Ca đang sử dụng" value={activeWorkShifts.length} />
          <SummaryCard label="Nhân sự được phân công" value={staffCount} />
        </section>
      ) : null}

      {canManageVerification && attendanceConfig ? (
        <AttendanceVerificationSettings initialConfig={attendanceConfig} />
      ) : null}

      {myPanel}

      {myMonthlyPanel}

      {(canManage || canApproveAdjustments) ? (
        <CenterMonthlyTimesheetManagement
          canApproveAdjustments={canApproveAdjustments}
          canManage={canManage}
          initialMonth={currentMonth}
          initialOverview={centerMonthlyOverview}
          initialYear={currentYear}
          staffOptions={staffOptions}
        />
      ) : null}

      {myAdjustmentRequestsPanel}

      {canApproveAdjustments ? (
        <TimekeepingAdjustmentApprovalQueue requests={adjustmentApprovalQueue} />
      ) : null}

      {canView ? <TimekeepingDayEntries entries={dayEntries} /> : null}

      {canView ? <WeeklySchedulePanel key={scheduleWeek} weekStart={scheduleWeek} entries={entries} staffOptions={staffOptions} workShifts={workShifts} canManage={canManage} /> : null}

      {canView ? <WorkShiftCatalogue canManage={canManage} workShifts={workShifts} /> : null}
    </div>
  );
}

function WorkShiftCatalogue({
  canManage,
  workShifts,
}: {
  canManage: boolean;
  workShifts: readonly TimekeepingWorkShift[];
}) {
  return (
    <section aria-labelledby="work-shift-catalogue-heading" className="timekeeping-shift-catalogue-work-area grid gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink" id="work-shift-catalogue-heading">Danh mục ca làm</h2>
        <p className="mt-1 text-sm text-ink-muted">Bao gồm cả ca đang sử dụng và ca đã ngừng dùng. Ca đã từng được phân công không thể xóa.</p>
      </div>
      <div className="timekeeping-shift-catalogue-table">
        <DataTableFrame caption="Danh mục ca làm" tableClassName="min-w-[960px] text-sm" header={<tr><th className="px-6 py-3 font-semibold">Mã ca</th><th className="px-6 py-3 font-semibold">Tên ca</th><th className="px-6 py-3 font-semibold">Thời gian</th><th className="px-6 py-3 font-semibold">Nghỉ</th><th className="px-6 py-3 font-semibold">Trạng thái</th>{canManage ? <th className="px-6 py-3 font-semibold">Thao tác</th> : null}</tr>} body={workShifts.length === 0 ? <tr><td className="px-6 py-10 text-center text-sm text-ink-muted" colSpan={canManage ? 6 : 5}>Chưa có ca làm nào.</td></tr> : workShifts.map((shift) => <tr className="align-top hover:bg-[var(--table-row-hover)]" key={shift.id}><td className="px-6 py-4 font-mono font-semibold text-ink">{shift.code}</td><td className="px-6 py-4"><p className="font-semibold text-ink">{shift.name}</p>{shift.notes ? <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted">{shift.notes}</p> : null}</td><td className="px-6 py-4 text-ink-muted">{formatTime(shift.startTime)} - {formatTime(shift.endTime)}{shift.crossesMidnight ? " (ngày hôm sau)" : ""}</td><td className="px-6 py-4 text-ink-muted">{formatBreak(shift.breakMinutes)}</td><td className="px-6 py-4"><WorkShiftStatus isActive={shift.isActive} /></td>{canManage ? <td className="min-w-40 px-6 py-4">{shift.isActive ? <div className="grid gap-2"><WorkShiftDialog workShift={shift} /><WorkShiftRetireAction workShift={shift} /></div> : <span className="text-caption text-text-muted">Đã ngừng dùng</span>}</td> : null}</tr>)} />
      </div>
      <ResponsiveRecordList className="timekeeping-shift-catalogue-record-list" label="Danh mục ca làm">
        {workShifts.length === 0 ? <p className="rounded-lg border border-dashed border-border-subtle p-6 text-center text-sm text-text-muted">Chưa có ca làm nào.</p> : workShifts.map((shift) => <article className="rounded-lg border border-border-subtle bg-surface-base p-4" key={shift.id} role="listitem"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-caption font-semibold text-action-link">{shift.code}</p><h3 className="mt-1 text-body font-semibold text-text-strong">{shift.name}</h3></div><WorkShiftStatus isActive={shift.isActive} /></div><dl className="mt-4 grid gap-2 border-y border-border-subtle py-3 text-caption"><MobileField label="Thời gian" value={`${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}${shift.crossesMidnight ? " (ngày hôm sau)" : ""}`} /><MobileField label="Nghỉ giữa ca" value={formatBreak(shift.breakMinutes)} />{shift.notes ? <MobileField label="Ghi chú" value={shift.notes} /> : null}</dl>{canManage && shift.isActive ? <div className="mt-4 grid gap-2 sm:grid-cols-2"><WorkShiftDialog workShift={shift} /><WorkShiftRetireAction workShift={shift} /></div> : null}</article>)}
      </ResponsiveRecordList>
    </section>
  );
}

function WorkShiftStatus({ isActive }: { isActive: boolean }) {
  return (
    <Badge tone={isActive ? "success" : "neutral"}>
      {isActive ? "Đang sử dụng" : "Đã ngừng dùng"}
    </Badge>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-5 shadow-card transition-all hover:border-hairline-strong">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">{value}</p>
    </div>
  );
}
