import type { StudentEnrollmentReadModel } from "@/features/students/read-models";
import type { StudentTuitionProfile } from "@/features/students/tuition-profile-data";
import { formatIsoDate, toVietnamDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";

import { formatMode, formatTransitionKind, PanelNotice } from "./student-profile-shared";

interface StudentHistoryTabProps {
  canViewClasses: boolean;
  enrollmentHistory: StudentEnrollmentReadModel[];
  tuitionProfile?: StudentTuitionProfile | null;
}

interface HistoryEvent {
  date: string;
  detail: string | null;
  id: string;
  title: string;
}

export function buildStudentHistory({
  canViewClasses,
  enrollmentHistory,
  tuitionProfile,
}: StudentHistoryTabProps): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  if (canViewClasses) {
    for (const enrollment of enrollmentHistory) {
      const className = enrollment.classInfo?.name ?? "lớp không xác định";

      events.push({
        date: enrollment.effectiveFrom,
        detail: enrollment.startReason,
        id: `${enrollment.id}-start`,
        title: `${formatTransitionKind(enrollment.transitionKind)} · ${className} · ${formatMode(enrollment.registeredMode)}`,
      });

      if (enrollment.effectiveTo) {
        events.push({
          date: enrollment.effectiveTo,
          detail: enrollment.endReason,
          id: `${enrollment.id}-end`,
          title: `Kết thúc ${className}`,
        });
      }
    }
  }

  for (const rate of tuitionProfile?.rateHistory ?? []) {
    events.push({
      date: rate.effectiveFrom,
      detail: rate.reason,
      id: `rate-${rate.effectiveFrom}-${rate.createdAt}`,
      title: `Mức phí ${formatVnd(rate.unitPriceVnd)}/buổi có hiệu lực`,
    });
  }

  for (const [index, source] of (tuitionProfile?.sourceHistory ?? []).entries()) {
    events.push({
      // A timestamp; convert so it shows and sorts as a Vietnam business date like the other events.
      date: toVietnamDate(source.assignedAt),
      detail: source.reason,
      id: `source-${index}-${source.assignedAt}-${source.reason}`,
      title: "Hiệu chỉnh nguồn học viên",
    });
  }

  return events.sort((left, right) => right.date.localeCompare(left.date));
}

/** Tab "Lịch sử" (design 05b): immutable log built from enrollment, rate and source history. */
export function StudentHistoryTab(props: StudentHistoryTabProps) {
  const events = buildStudentHistory(props);

  if (events.length === 0) {
    return (
      <PanelNotice>
        {props.canViewClasses
          ? "Chưa có sự kiện nào được ghi nhận cho học sinh này."
          : "Không có quyền xem lịch sử xếp lớp (classes.view)."}
      </PanelNotice>
    );
  }

  return (
    <ol className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      {events.map((event) => (
        <li
          className="grid gap-1 border-b border-border-row px-4 py-3 text-secondary last:border-b-0 md:grid-cols-[120px_minmax(0,1fr)] md:gap-3"
          key={event.id}
        >
          <span className="whitespace-nowrap tabular-nums text-text-muted">{formatIsoDate(event.date)}</span>
          <span className="min-w-0">
            <strong className="font-semibold text-text-strong">{event.title}</strong>
            {event.detail ? <span className="text-text-muted"> · {event.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
