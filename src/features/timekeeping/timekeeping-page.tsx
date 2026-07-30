import { StaffShiftAssignmentDialog } from "@/features/timekeeping/components/staff-shift-assignment-dialog";
import { StaffShiftEndAction } from "@/features/timekeeping/components/staff-shift-end-action";
import { StaffShiftReplaceAction } from "@/features/timekeeping/components/staff-shift-replace-action";
import { TimekeepingAdjustmentApprovalQueue } from "@/features/timekeeping/components/timekeeping-adjustment-approval-queue";
import { TimekeepingAdjustmentRequests } from "@/features/timekeeping/components/timekeeping-adjustment-requests";
import { MyTimekeepingPanel } from "@/features/timekeeping/components/my-timekeeping-panel";
import { TimekeepingDayEntries } from "@/features/timekeeping/components/timekeeping-day-entries";
import { WorkShiftDialog } from "@/features/timekeeping/components/work-shift-dialog";
import { WorkShiftRetireAction } from "@/features/timekeeping/components/work-shift-retire-action";
import { Badge } from "@/components/ui/badge";
import type {
  TimekeepingAdjustableEntry,
  TimekeepingAdjustmentApprovalQueueEntry,
  TimekeepingAdjustmentRequest,
  TimekeepingDayEntry,
  TimekeepingMyEntry,
  TimekeepingScheduleEntry,
  TimekeepingStaffOption,
  TimekeepingWorkShift,
} from "@/features/timekeeping/types";

interface TimekeepingPageProps {
  canCheck: boolean;
  canManage: boolean;
  canApproveAdjustments: boolean;
  adjustmentEntries: readonly TimekeepingAdjustableEntry[];
  adjustmentApprovalQueue: readonly TimekeepingAdjustmentApprovalQueueEntry[];
  dayEntries: readonly TimekeepingDayEntry[];
  entries: readonly TimekeepingScheduleEntry[];
  myEntries: readonly TimekeepingMyEntry[];
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
  canCheck,
  canManage,
  canApproveAdjustments,
  adjustmentApprovalQueue,
  adjustmentEntries,
  dayEntries,
  entries,
  myEntries,
  myAdjustmentRequests,
  staffOptions,
  workShifts,
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
            Quản lý danh mục ca làm việc, chấm công di động và lịch phân công nhân sự đang hiệu lực.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
          {canManage ? (
            <>
              <WorkShiftDialog />
              <StaffShiftAssignmentDialog
                staffOptions={staffOptions}
                workShifts={activeWorkShifts}
              />
            </>
          ) : null}
          <Badge tone={canManage ? "info" : "neutral"}>
            {canManage ? "Quyền Quản lý" : "Chỉ đọc"}
          </Badge>
        </div>
      </header>

      {/* KPI Metrics */}
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Lịch hiệu lực" value={entries.length} />
        <SummaryCard label="Ca đang sử dụng" value={activeWorkShifts.length} />
        <SummaryCard label="Nhân sự được phân công" value={staffCount} />
      </section>

      <MyTimekeepingPanel canCheck={canCheck} entries={myEntries} />

      <TimekeepingAdjustmentRequests
        canCheck={canCheck}
        entries={adjustmentEntries}
        requests={myAdjustmentRequests}
      />

      {canApproveAdjustments ? (
        <TimekeepingAdjustmentApprovalQueue requests={adjustmentApprovalQueue} />
      ) : null}

      <TimekeepingDayEntries entries={dayEntries} />

      {/* Table Section */}
      <section className="overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-card">
        <div className="border-b border-hairline px-6 py-4">
          <h2 className="font-display text-base font-bold text-ink">Lịch phân công ca làm</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Có <span className="font-bold text-ink">{entries.length}</span> lịch làm việc đang hiệu lực theo tuần
          </p>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-[1040px] border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-ink-subtle">
              <tr>
                <th className="px-6 py-3.5 font-bold">Thứ</th>
                <th className="px-6 py-3.5 font-bold">Nhân sự</th>
                <th className="px-6 py-3.5 font-bold">Ca làm</th>
                <th className="px-6 py-3.5 font-bold">Thời gian</th>
                <th className="px-6 py-3.5 font-bold">Nghỉ giữa ca</th>
                <th className="px-6 py-3.5 font-bold">Hiệu lực</th>
                {canManage ? <th className="px-6 py-3.5 font-bold">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {entries.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-sm text-ink-muted" colSpan={canManage ? 7 : 6}>
                    Chưa có lịch phân công nào đang hiệu lực.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr className="align-top transition-colors hover:bg-surface-2/70" key={entry.assignmentId}>
                    <td className="px-6 py-4 font-display font-bold text-ink">
                      {weekdayLabels[entry.weekday] ?? "Chưa xác định"}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-display font-bold text-ink">{getStaffLabel(entry)}</p>
                      {entry.staffEmployeeCode ? (
                        <p className="mt-0.5 font-mono text-xs font-semibold text-ink-subtle">{entry.staffEmployeeCode}</p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink">{entry.workShiftName}</p>
                      <p className="mt-0.5 font-mono text-xs text-ink-muted">{entry.workShiftCode}</p>
                    </td>
                    <td className="px-6 py-4"><ShiftTime entry={entry} /></td>
                    <td className="px-6 py-4 text-xs font-medium text-ink-muted">{formatBreak(entry.breakMinutes)}</td>
                    <td className="px-6 py-4"><EffectivePeriod entry={entry} /></td>
                    {canManage ? (
                      <td className="min-w-44 px-6 py-4">
                        <div className="grid gap-2">
                          <StaffShiftReplaceAction entry={entry} workShifts={activeWorkShifts} />
                          <StaffShiftEndAction entry={entry} />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3.5 p-4 lg:hidden">
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm leading-relaxed text-ink-muted">
              Chưa có lịch phân công nào đang hiệu lực.
            </p>
          ) : (
            entries.map((entry) => (
              <article className="rounded-xl border border-hairline bg-surface-1 p-4 shadow-xs" key={entry.assignmentId}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xs font-bold uppercase tracking-wider text-primary">
                      {weekdayLabels[entry.weekday] ?? "Chưa xác định"}
                    </p>
                    <h3 className="mt-1 font-display text-base font-bold text-ink">{getStaffLabel(entry)}</h3>
                    {entry.staffEmployeeCode ? (
                      <p className="mt-0.5 font-mono text-xs font-semibold text-ink-muted">{entry.staffEmployeeCode}</p>
                    ) : null}
                  </div>
                  <Badge tone="info">{entry.workShiftCode}</Badge>
                </div>

                <dl className="mt-3.5 grid gap-2.5 rounded-lg bg-surface-2 p-3 text-xs">
                  <MobileField label="Ca làm" value={entry.workShiftName} />
                  <MobileField
                    label="Thời gian"
                    value={`${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}${entry.crossesMidnight ? " (hôm sau)" : ""}`}
                  />
                  <MobileField label="Nghỉ giữa ca" value={formatBreak(entry.breakMinutes)} />
                  <MobileField
                    label="Hiệu lực"
                    value={entry.effectiveTo ? `Từ ${formatDate(entry.effectiveFrom)} đến ${formatDate(entry.effectiveTo)}` : `Từ ${formatDate(entry.effectiveFrom)}`}
                  />
                </dl>

                {canManage ? (
                  <div className="mt-4 grid gap-2 border-t border-hairline pt-3.5 sm:grid-cols-2">
                    <StaffShiftReplaceAction entry={entry} workShifts={activeWorkShifts} />
                    <StaffShiftEndAction entry={entry} />
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <WorkShiftCatalogue canManage={canManage} workShifts={workShifts} />
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
    <section className="overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-card">
      <div className="border-b border-hairline px-6 py-4">
        <h2 className="font-display text-base font-bold text-ink">Danh mục ca làm</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Các ca đã từng được phân công không thể xóa để bảo toàn lịch sử chấm công
        </p>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-6 py-3.5 font-bold">Mã ca</th>
              <th className="px-6 py-3.5 font-bold">Tên ca</th>
              <th className="px-6 py-3.5 font-bold">Thời gian</th>
              <th className="px-6 py-3.5 font-bold">Nghỉ</th>
              <th className="px-6 py-3.5 font-bold">Trạng thái</th>
              {canManage ? <th className="px-6 py-3.5 font-bold">Thao tác</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {workShifts.length === 0 ? (
              <tr>
                <td className="px-6 py-10 text-center text-sm text-ink-muted" colSpan={canManage ? 6 : 5}>
                  Chưa có ca làm nào.
                </td>
              </tr>
            ) : (
              workShifts.map((shift) => (
                <tr className="align-top transition-colors hover:bg-surface-2/70" key={shift.id}>
                  <td className="px-6 py-4 font-mono font-bold text-ink">{shift.code}</td>
                  <td className="px-6 py-4">
                    <p className="font-display font-bold text-ink">{shift.name}</p>
                    {shift.notes ? <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted">{shift.notes}</p> : null}
                  </td>
                  <td className="px-6 py-4 font-medium text-ink-muted">
                    {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    {shift.crossesMidnight ? " (hôm sau)" : ""}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-ink-muted">{formatBreak(shift.breakMinutes)}</td>
                  <td className="px-6 py-4"><WorkShiftStatus isActive={shift.isActive} /></td>
                  {canManage ? (
                    <td className="min-w-40 px-6 py-4">
                      {shift.isActive ? (
                        <div className="grid gap-2">
                          <WorkShiftDialog workShift={shift} />
                          <WorkShiftRetireAction workShift={shift} />
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-ink-muted">Đã ngừng dùng</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3.5 p-4 lg:hidden">
        {workShifts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm leading-relaxed text-ink-muted">
            Chưa có ca làm nào.
          </p>
        ) : (
          workShifts.map((shift) => (
            <article className="rounded-xl border border-hairline bg-surface-1 p-4 shadow-xs" key={shift.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-primary">{shift.code}</p>
                  <h3 className="mt-1 font-display text-base font-bold text-ink">{shift.name}</h3>
                </div>
                <WorkShiftStatus isActive={shift.isActive} />
              </div>
              <dl className="mt-3.5 grid gap-2.5 rounded-lg bg-surface-2 p-3 text-xs">
                <MobileField
                  label="Thời gian"
                  value={`${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}${shift.crossesMidnight ? " (hôm sau)" : ""}`}
                />
                <MobileField label="Nghỉ giữa ca" value={formatBreak(shift.breakMinutes)} />
                {shift.notes ? <MobileField label="Ghi chú" value={shift.notes} /> : null}
              </dl>
              {canManage && shift.isActive ? (
                <div className="mt-4 grid gap-2 border-t border-hairline pt-3.5 sm:grid-cols-2">
                  <WorkShiftDialog workShift={shift} />
                  <WorkShiftRetireAction workShift={shift} />
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
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
