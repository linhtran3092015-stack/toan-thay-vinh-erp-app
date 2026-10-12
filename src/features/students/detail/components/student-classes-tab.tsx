"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  StudentEnrollmentOperation,
  StudentEnrollmentUiModel,
} from "@/features/students/enrollment/student-enrollment-ui-types";
import type {
  StudentDetailReadModel,
  StudentEnrollmentReadModel,
  StudentScheduleReadModel,
} from "@/features/students/read-models";
import { formatIsoDate, formatTime } from "@/lib/datetime";

import {
  formatMode,
  formatTransitionKind,
  formatWeekday,
  getEnrollmentStatusMeta,
  PanelNotice,
} from "./student-profile-shared";

interface StudentClassesTabProps {
  canViewClasses: boolean;
  detail: StudentDetailReadModel;
  model: StudentEnrollmentUiModel;
  onOperation: (operation: StudentEnrollmentOperation, trigger: HTMLButtonElement) => void;
}

const cardActions: ReadonlyArray<{ label: string; operation: StudentEnrollmentOperation }> = [
  { label: "Chuyển lớp", operation: "transfer" },
  { label: "Bảo lưu…", operation: "reserve" },
];

/** Tab "Lớp" (design 05b): current enrollment with its schedule, then ended ones. */
export function StudentClassesTab({ canViewClasses, detail, model, onOperation }: StudentClassesTabProps) {
  if (!canViewClasses) {
    return <PanelNotice tone="warning">Không có quyền xem lớp học (classes.view).</PanelNotice>;
  }

  const active = detail.activeEnrollment;
  const ended = detail.enrollmentHistory.filter((enrollment) => enrollment.id !== active?.id);
  const enrollAction = model.actions.enroll.visible ? model.actions.enroll : model.actions.resume.visible ? model.actions.resume : null;
  const enrollLabel = model.actions.enroll.visible ? "Ghi danh vào lớp" : "Quay lại học";
  const enrollOperation: StudentEnrollmentOperation = model.actions.enroll.visible ? "enroll" : "resume";

  return (
    <div className="grid gap-4">
      {active && active.classInfo ? (
        <ActiveEnrollmentCard
          enrollment={active}
          model={model}
          onOperation={onOperation}
          schedules={detail.activeSchedules}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-base px-5 py-8 text-center">
          <p className="text-body font-semibold text-text-strong">Chưa ghi danh lớp nào</p>
          <p className="mt-1 text-secondary text-text-muted">
            Học sinh chưa có lớp đang hoạt động, nên chưa có lịch học và chưa bị trừ buổi.
          </p>
          {enrollAction ? (
            <Button
              className="mt-4"
              disabled={!enrollAction.enabled}
              disabledReason={enrollAction.enabled ? undefined : enrollAction.reason ?? undefined}
              onClick={(event) => onOperation(enrollOperation, event.currentTarget)}
              type="button"
              variant="secondary"
            >
              {enrollLabel}
            </Button>
          ) : null}
        </div>
      )}

      {ended.length > 0 ? (
        <section aria-label="Lớp đã kết thúc" className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
          <h3 className="border-b border-border-row px-4 py-3 text-body font-semibold text-text-strong">
            Đã kết thúc <span className="font-normal tabular-nums text-text-muted">{ended.length}</span>
          </h3>
          <ul className="divide-y divide-border-row">
            {ended.map((enrollment) => (
              <EndedEnrollmentRow enrollment={enrollment} key={enrollment.id} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ActiveEnrollmentCard({
  enrollment,
  model,
  onOperation,
  schedules,
}: {
  enrollment: StudentEnrollmentReadModel;
  model: StudentEnrollmentUiModel;
  onOperation: StudentClassesTabProps["onOperation"];
  schedules: StudentScheduleReadModel[];
}) {
  const klass = enrollment.classInfo!;
  const status = getEnrollmentStatusMeta(enrollment.status);
  const visibleActions = cardActions.filter(({ operation }) => model.actions[operation].visible);

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)]">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="text-body font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              href={`/classes/${klass.id}`}
            >
              {klass.name}
            </Link>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-secondary text-text-muted">
            Vào lớp {formatIsoDate(enrollment.effectiveFrom)} · Mã {klass.code} · Khối {klass.grade} · Mức {klass.level} ·{" "}
            {formatMode(enrollment.registeredMode)}
          </p>
          {enrollment.startReason ? (
            <p className="mt-1 text-secondary text-text-muted">Lý do: {enrollment.startReason}</p>
          ) : null}
        </div>

        {visibleActions.length > 0 ? (
          <div className="flex flex-wrap items-start gap-2 md:max-w-[300px] md:justify-end [&>span]:max-w-full">
            {visibleActions.map(({ label, operation }) => {
              const availability = model.actions[operation];

              return (
                <Button
                  disabled={!availability.enabled}
                  disabledReason={availability.enabled ? undefined : availability.reason ?? undefined}
                  key={operation}
                  onClick={(event) => onOperation(operation, event.currentTarget)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {label}
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-border-row pt-4">
        <h3 className="text-secondary font-semibold text-text-strong">Lịch học đang hiệu lực</h3>
        {schedules.length === 0 ? (
          <p className="mt-2 text-secondary text-text-muted">Lớp chưa có lịch học đang hiệu lực.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {schedules.map((schedule) => (
              <li
                className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-border-subtle bg-surface-subtle px-2.5 py-1.5 text-secondary text-text-default"
                key={schedule.id}
              >
                <span className="font-semibold text-text-strong">{formatWeekday(schedule.weekday)}</span>
                <span className="tabular-nums">
                  {formatTime(schedule.startTime)}–{formatTime(schedule.endTime)}
                </span>
                <span className="text-text-muted">
                  · {schedule.roomName ?? (schedule.learningMode === "online" ? "Trực tuyến" : "Chưa có phòng")}
                  {schedule.componentCode ? ` · ${schedule.componentCode}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function EndedEnrollmentRow({ enrollment }: { enrollment: StudentEnrollmentReadModel }) {
  const status = getEnrollmentStatusMeta(enrollment.status);
  const name = enrollment.classInfo?.name ?? "Lớp không xác định";

  return (
    <li className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {enrollment.classInfo ? (
            <Link
              className="text-body font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              href={`/classes/${enrollment.classInfo.id}`}
            >
              {name}
            </Link>
          ) : (
            <span className="text-body font-semibold text-text-strong">{name}</span>
          )}
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-0.5 text-secondary text-text-muted">
          {formatIsoDate(enrollment.effectiveFrom)} → {enrollment.effectiveTo ? formatIsoDate(enrollment.effectiveTo) : "nay"} ·{" "}
          {formatTransitionKind(enrollment.transitionKind)} · {formatMode(enrollment.registeredMode)}
          {enrollment.endReason ? ` · ${enrollment.endReason}` : ""}
        </p>
      </div>
    </li>
  );
}
