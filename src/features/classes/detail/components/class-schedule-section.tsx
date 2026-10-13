import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ClassScheduleCreateForm } from "@/features/classes/management/class-schedule-create-form";
import { ClassScheduleEndAction } from "@/features/classes/management/class-schedule-end-action";
import { ClassScheduleReplaceAction } from "@/features/classes/management/class-schedule-replace-action";
import type { ClassComponentRef, ClassDetailReadModel, ClassScheduleReadModel } from "@/features/classes/read-models";
import { PanelNotice, ProfilePanel } from "@/features/students/detail/components/student-profile-shared";
import { formatIsoDate, formatTime } from "@/lib/datetime";
import { formatLearningMode } from "@/lib/format";

export const weekdayNames: Record<number, string> = {
  0: "Chủ nhật",
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ nhật",
};

export function formatWeekdayName(value: number): string {
  return weekdayNames[value] ?? `Ngày ${value}`;
}

/** Minutes between two HH:MM[:SS] times; `null` when the end is not after the start. */
export function getDurationMinutes(startTime: string, endTime: string): number | null {
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const minutes = toMinutes(endTime) - toMinutes(startTime);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/**
 * Note for a composite parent ("lớp ghép"): it has no schedule of its own, its
 * component classes do. Links to each component instead of a merged schedule;
 * a link that starts after `today` (YYYY-MM-DD) says from when.
 */
export function CompositeComponentsNotice({ components, today }: { components: readonly ClassComponentRef[]; today: string }) {
  return (
    <div className="rounded-md border border-dashed border-border-strong bg-surface-subtle px-3 py-2.5 text-secondary text-text-muted">
      <p>Lớp ghép không có lịch riêng. Lịch và buổi học nằm ở các lớp thành phần:</p>
      <ul className="mt-1.5 grid gap-0.5">
        {components.map((component) => (
          <li className="flex flex-wrap items-center gap-x-2" key={component.id}>
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-8"
              href={`/classes/${component.id}`}
            >
              {component.code} · {component.name}
            </Link>
            {component.effectiveFrom > today ? <span>từ {formatIsoDate(component.effectiveFrom)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Monday-first order; Sunday is stored as 0 or 7. */
export function sortSchedules(schedules: readonly ClassScheduleReadModel[]): ClassScheduleReadModel[] {
  const order = (weekday: number) => (weekday === 0 ? 7 : weekday);
  return [...schedules].sort((a, b) => order(a.weekday) - order(b.weekday) || a.startTime.localeCompare(b.startTime));
}

interface ClassScheduleSectionProps {
  canManageSchedule: boolean;
  detail: ClassDetailReadModel;
  /** YYYY-MM-DD in Vietnam time: component links that start later show their start date. */
  today: string;
}

/**
 * Schedule templates of the class: active ones with replace/end actions, the
 * create form while slots remain, and the history in a collapsed section. On a
 * linked composite parent the create form is replaced by the list of component
 * classes, since the database rejects its own templates. The overview's
 * "Sửa lịch" link jumps here.
 */
export function ClassScheduleSection({ canManageSchedule, detail, today }: ClassScheduleSectionProps) {
  const activeSchedules = sortSchedules(detail.schedules.filter((schedule) => schedule.isActive));
  const historicalSchedules = detail.schedules.filter((schedule) => !schedule.isActive);
  const remainingScheduleSlots = Math.max(0, detail.weeklySessionCount - detail.activeScheduleCount);
  // The database rejects schedule templates on a linked composite parent, also
  // while the link has not started yet (any overlap with an open-ended template).
  const isCompositeParent = detail.componentClasses.length > 0;
  const canModifySchedule =
    canManageSchedule && !isCompositeParent && detail.status === "active" && detail.academicYear?.status === "active";
  const canCreateSchedule = canModifySchedule && remainingScheduleSlots > 0;

  return (
    // The overview's "#class-schedule-management" links land here; the margin clears the 64px sticky topbar.
    <div className="scroll-mt-24" id="class-schedule-management">
      <ProfilePanel title="Lịch học cố định" titleId="class-schedule-management-title">
        <div className="grid gap-4">
          {isCompositeParent ? (
            <CompositeComponentsNotice components={detail.componentClasses} today={today} />
          ) : canCreateSchedule ? (
            <ClassScheduleCreateForm
              classId={detail.id}
              defaultLearningMode={detail.defaultLearningMode}
              remainingScheduleSlots={remainingScheduleSlots}
            />
          ) : canManageSchedule ? (
            <PanelNotice tone={canModifySchedule ? "neutral" : "warning"}>
              {detail.status !== "active"
                ? "Cần kích hoạt lớp trước khi thiết lập lịch học."
                : detail.academicYear?.status !== "active"
                  ? "Năm học của lớp chưa ở trạng thái hoạt động."
                  : "Lớp đã đủ số lịch học cố định theo cấu hình số buổi mỗi tuần."}
            </PanelNotice>
          ) : null}

          {activeSchedules.length === 0 ? (
            isCompositeParent ? null : <PanelNotice>Lớp chưa có lịch học đang hiệu lực.</PanelNotice>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activeSchedules.map((schedule) => (
                <ScheduleCard canManageSchedule={canModifySchedule} key={schedule.id} schedule={schedule} />
              ))}
            </div>
          )}

          {historicalSchedules.length > 0 ? (
            <details className="group rounded-md border border-border-subtle">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 text-secondary font-semibold text-text-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus">
                Lịch đã kết thúc ({historicalSchedules.length})
              </summary>
              <div className="grid gap-3 border-t border-border-row p-3 md:grid-cols-2">
                {historicalSchedules.map((schedule) => (
                  <ScheduleCard key={schedule.id} schedule={schedule} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </ProfilePanel>
    </div>
  );
}

function ScheduleCard({ canManageSchedule = false, schedule }: { canManageSchedule?: boolean; schedule: ClassScheduleReadModel }) {
  return (
    <article className="rounded-md border border-border-subtle bg-surface-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-text-strong">{formatWeekdayName(schedule.weekday)}</p>
          <p className="mt-1 text-secondary tabular-nums text-text-muted">
            {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
          </p>
        </div>
        <Badge tone={schedule.isActive ? "success" : "neutral"}>{schedule.isActive ? "Đang hiệu lực" : "Đã kết thúc"}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-secondary">
        <dt className="text-text-muted">Hình thức</dt>
        <dd className="text-text-strong">
          {formatLearningMode(schedule.learningMode)}
          {schedule.componentCode ? ` · Thành phần ${schedule.componentCode}` : ""}
        </dd>
        <dt className="text-text-muted">Phòng</dt>
        <dd className="text-text-strong">
          {schedule.roomName ?? (schedule.learningMode === "online" ? "Học trực tuyến" : "Chưa cập nhật")}
        </dd>
        <dt className="text-text-muted">Hiệu lực</dt>
        <dd className="text-text-strong">
          {formatIsoDate(schedule.effectiveFrom)} → {schedule.effectiveTo ? formatIsoDate(schedule.effectiveTo) : "hiện tại"}
        </dd>
      </dl>

      {schedule.meetingUrl ? (
        <a
          className="mt-3 inline-flex min-h-11 items-center text-secondary md:min-h-8 font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href={schedule.meetingUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Mở phòng học trực tuyến (thẻ mới)
        </a>
      ) : null}

      {canManageSchedule && schedule.isActive ? (
        <div className="mt-3 grid gap-2">
          <ClassScheduleReplaceAction schedule={schedule} />
          <ClassScheduleEndAction schedule={schedule} />
        </div>
      ) : null}

      {schedule.endReason ? <p className="mt-3 text-secondary text-text-muted">Lý do kết thúc: {schedule.endReason}</p> : null}
    </article>
  );
}
