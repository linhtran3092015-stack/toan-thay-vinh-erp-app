import { StaffShiftAssignmentDialog } from "@/features/timekeeping/components/staff-shift-assignment-dialog";
import { StaffShiftEndAction } from "@/features/timekeeping/components/staff-shift-end-action";
import { StaffShiftReplaceAction } from "@/features/timekeeping/components/staff-shift-replace-action";
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
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
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

const weekdayLabels: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatBreak(minutes: number): string {
  if (minutes === 0) {
    return "Không nghỉ";
  }

  return `${minutes} phút`;
}

function getStaffLabel(entry: TimekeepingScheduleEntry): string {
  return (
    entry.staffDisplayName?.trim() ||
    entry.staffEmployeeCode ||
    "Nhân sự trung tâm"
  );
}

function ShiftTime({ entry }: { entry: TimekeepingScheduleEntry }) {
  return (
    <div>
      <p className="font-display font-bold text-ink">
        {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
      </p>
      {entry.crossesMidnight ? (
        <p className="mt-0.5 text-xs text-ink-muted">Kết thúc ngày hôm sau</p>
      ) : null}
    </div>
  );
}

function EffectivePeriod({ entry }: { entry: TimekeepingScheduleEntry }) {
  return (
    <div className="text-xs text-ink-muted">
      <p>Từ {formatDate(entry.effectiveFrom)}</p>
      <p className="mt-0.5 font-medium text-ink">
        {entry.effectiveTo ? `Đến ${formatDate(entry.effectiveTo)}` : "Đang hiệu lực"}
      </p>
    </div>
  );
}

export function TimekeepingPage({
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
  const staffCount = new Set(entries.map((entry) => entry.staffId)).size;

  return (
    <div className="grid gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface-1 p-6 shadow-xs md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-wider text-primary">
            Quản Lý Nhân Sự
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Chấm công & Ca làm</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-muted">
            {canView
              ? "Quản lý danh mục ca làm việc, chấm công di động và lịch phân công nhân sự đang hiệu lực."
              : "Thực hiện chấm công cá nhân và quản lý yêu cầu điều chỉnh công."}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
          {canManage ? (
            <>
              <WorkShiftDialog />
              <StaffShiftAssignmentDialog
                staffOptions={staffOptions}
                workShifts={workShifts}
              />
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
          <SummaryCard label="Lịch hiệu lực" value={entries.length} />
          <SummaryCard label="Ca đang sử dụng" value={activeWorkShifts.length} />
          <SummaryCard label="Nhân sự được phân công" value={staffCount} />
        </section>
      ) : null}

      {canManageVerification && attendanceConfig ? (
        <AttendanceVerificationSettings initialConfig={attendanceConfig} />
      ) : null}

      {canCheck ? (
        <MyTimekeepingPanel
          attendancePolicy={attendancePolicy}
          canCheck={canCheck}
          entries={myEntries}
        />
      ) : null}

      {canCheck ? (
        <MyMonthlyTimesheetPanel
          canCheck={canCheck}
          initialEntries={myMonthlyEntries}
          initialMonth={currentMonth}
          initialYear={currentYear}
        />
      ) : null}

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

      {canCheck ? (
        <TimekeepingAdjustmentRequests
          canCheck={canCheck}
          entries={adjustmentEntries}
          requests={myAdjustmentRequests}
        />
      ) : null}

      {canApproveAdjustments ? (
        <TimekeepingAdjustmentApprovalQueue requests={adjustmentApprovalQueue} />
      ) : null}

      {canView ? <TimekeepingDayEntries entries={dayEntries} /> : null}

      {canView ? (
        <section aria-labelledby="active-shift-schedule-heading" className="timekeeping-assignment-work-area grid gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink" id="active-shift-schedule-heading">
              Lịch phân công ca đang hoạt động
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Các lịch lặp lại đang hiệu lực theo tuần. Lịch đã kết thúc không hiển thị tại đây.
            </p>
          </div>

          <div className="timekeeping-assignment-table">
            <DataTableFrame
              caption="Lịch phân công ca đang hoạt động"
              tableClassName="min-w-[1040px] text-sm"
              header={
                <tr>
                  <th className="px-6 py-3 font-semibold">Thứ</th>
                  <th className="px-6 py-3 font-semibold">Nhân sự</th>
                  <th className="px-6 py-3 font-semibold">Ca làm</th>
                  <th className="px-6 py-3 font-semibold">Thời gian</th>
                  <th className="px-6 py-3 font-semibold">Nghỉ giữa ca</th>
                  <th className="px-6 py-3 font-semibold">Hiệu lực</th>
                  {canManage ? <th className="px-6 py-3 font-semibold">Thao tác</th> : null}
                </tr>
              }
              body={
                entries.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-ink-muted" colSpan={canManage ? 7 : 6}>
                      Chưa có lịch phân công ca đang hoạt động.
                    </td>
                  </tr>
                ) : entries.map((entry) => (
                  <tr className="align-top hover:bg-[var(--table-row-hover)]" key={entry.assignmentId}>
                    <td className="px-6 py-4 font-semibold text-ink">{weekdayLabels[entry.weekday] ?? "Chưa xác định"}</td>
                    <td className="px-6 py-4"><p className="font-semibold text-ink">{getStaffLabel(entry)}</p>{entry.staffEmployeeCode ? <p className="mt-1 font-mono text-xs text-ink-muted">{entry.staffEmployeeCode}</p> : null}</td>
                    <td className="px-6 py-4"><p className="font-semibold text-ink">{entry.workShiftName}</p><p className="mt-1 font-mono text-xs text-ink-muted">{entry.workShiftCode}</p></td>
                    <td className="px-6 py-4"><ShiftTime entry={entry} /></td>
                    <td className="px-6 py-4 text-sm text-ink-muted">{formatBreak(entry.breakMinutes)}</td>
                    <td className="px-6 py-4"><EffectivePeriod entry={entry} /></td>
                    {canManage ? <td className="min-w-44 px-6 py-4"><div className="grid gap-2"><StaffShiftReplaceAction entry={entry} workShifts={workShifts} /><StaffShiftEndAction entry={entry} /></div></td> : null}
                  </tr>
                ))
              }
            />
          </div>

          <ResponsiveRecordList className="timekeeping-assignment-record-list" label="Lịch phân công ca đang hoạt động">
            {entries.length === 0 ? <p className="rounded-lg border border-dashed border-border-subtle p-6 text-center text-sm text-text-muted">Chưa có lịch phân công ca đang hoạt động.</p> : entries.map((entry) => (
              <article className="rounded-lg border border-border-subtle bg-surface-base p-4" key={entry.assignmentId} role="listitem">
                <p className="text-caption font-semibold text-text-muted">{weekdayLabels[entry.weekday] ?? "Chưa xác định"}</p>
                <h3 className="mt-1 text-body font-semibold text-text-strong">{getStaffLabel(entry)}</h3>
                {entry.staffEmployeeCode ? <p className="mt-1 font-mono text-caption text-text-muted">{entry.staffEmployeeCode}</p> : null}
                <dl className="mt-4 grid gap-2 border-y border-border-subtle py-3 text-caption"><MobileField label="Ca làm" value={`${entry.workShiftCode} · ${entry.workShiftName}`} /><MobileField label="Thời gian" value={`${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}${entry.crossesMidnight ? " (ngày hôm sau)" : ""}`} /><MobileField label="Nghỉ giữa ca" value={formatBreak(entry.breakMinutes)} /><MobileField label="Hiệu lực" value={entry.effectiveTo ? `Từ ${formatDate(entry.effectiveFrom)} đến ${formatDate(entry.effectiveTo)}` : `Từ ${formatDate(entry.effectiveFrom)}`} /></dl>
                {canManage ? <div className="mt-4 grid gap-2 sm:grid-cols-2"><StaffShiftReplaceAction entry={entry} workShifts={workShifts} /><StaffShiftEndAction entry={entry} /></div> : null}
              </article>
            ))}
          </ResponsiveRecordList>
        </section>
      ) : null}

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
