import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/patterns/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClassScheduleCreateForm } from "@/features/classes/management/class-schedule-create-form";
import { ClassScheduleEndAction } from "@/features/classes/management/class-schedule-end-action";
import { ClassScheduleReplaceAction } from "@/features/classes/management/class-schedule-replace-action";
import { ClassStatusActions } from "@/features/classes/management/class-status-actions";
import type {
  ClassDetailReadModel,
  ClassLearningMode,
  ClassScheduleReadModel,
} from "@/features/classes/read-models";

interface ClassDetailPageProps {
  canEditClass: boolean;
  canManageSchedule: boolean;
  canViewStudentCount: boolean;
  detail: ClassDetailReadModel;
  directoryQuery?: string;
}

export function ClassDetailPage({
  canEditClass,
  canManageSchedule,
  canViewStudentCount,
  detail,
  directoryQuery = "",
}: ClassDetailPageProps) {
  const activeSchedules = detail.schedules.filter(
    (schedule) => schedule.isActive,
  );

  const historicalSchedules = detail.schedules.filter(
    (schedule) => !schedule.isActive,
  );

  const classStatus = getClassStatusMeta(detail.status);

  const remainingScheduleSlots = Math.max(
    0,
    detail.weeklySessionCount -
      detail.activeScheduleCount,
  );

  const canModifySchedule =
    canManageSchedule &&
    detail.status === "active" &&
    detail.academicYear?.status === "active";

  const canCreateSchedule =
    canModifySchedule &&
    remainingScheduleSlots > 0;

  return (
    <div className="grid min-w-0 gap-4">
      <section className="grid gap-4">
        <nav aria-label="Điều hướng lớp học" className="flex flex-wrap items-center gap-2 text-secondary text-text-muted">
          <Link
            className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
            href={directoryQuery ? `/classes?${directoryQuery}` : "/classes"}
          >
            Lớp học
          </Link>
          <span>/</span>
          <span className="font-semibold text-ink">
            {detail.code}
          </span>
        </nav>

        <PageHeader
          context={<Badge tone={classStatus.tone}>{classStatus.label}</Badge>}
          title={detail.name}
          actions={canEditClass ? <div className="flex flex-wrap items-center gap-2">
              {["draft", "active"].includes(detail.status) ? <Link className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-base px-4 text-control font-semibold text-text-strong hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={`/classes/${detail.id}/edit${directoryQuery ? `?${directoryQuery}` : ""}`}>Chỉnh sửa lớp</Link> : null}
              <ClassStatusActions classCode={detail.code} classId={detail.id} className={detail.name} status={detail.status} />
            </div> : undefined}
        >
          <p className="mt-1 font-mono text-secondary font-semibold text-text-muted">
              {detail.code}
            </p>
          <p className="mt-2 text-secondary text-text-muted">Khối {detail.grade} · Mức {detail.level} · {formatMode(detail.defaultLearningMode)}{detail.academicYear ? ` · ${detail.academicYear.code}` : ""}</p>
        </PageHeader>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin lớp học</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-2">
              <InfoTile
                label="Mã lớp"
                value={detail.code}
              />

              <InfoTile
                label="Tên lớp"
                value={detail.name}
              />

              <InfoTile
                label="Khối"
                value={`Khối ${detail.grade}`}
              />

              <InfoTile
                label="Mức"
                value={detail.level}
              />

              <InfoTile
                label="Hình thức mặc định"
                value={formatMode(
                  detail.defaultLearningMode,
                )}
              />

              <InfoTile
                label="Số buổi mỗi tuần"
                value={String(
                  detail.weeklySessionCount,
                )}
              />

              <InfoTile
                label="Trạng thái"
                value={classStatus.label}
              />

              <InfoTile
                label="Học viên đang học"
                value={
                  canViewStudentCount
                    ? String(
                        detail.activeStudentCount ?? 0,
                      )
                    : "Không có quyền students.view"
                }
              />

              <InfoTile
                label="Ghi chú"
                value={
                  detail.notes ?? "Chưa có ghi chú"
                }
                wide
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>
                Lịch học đang hiệu lực
              </CardTitle>
              {detail.status === "active" ? (
                <Link
                  className="inline-flex min-h-8 items-center justify-center rounded-md border border-border-subtle bg-surface-base px-3 text-caption font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
                  href={`/sessions/batch?classId=${detail.id}${directoryQuery ? `&${directoryQuery}` : ""}`}
                >
                  Tạo buổi học hàng loạt
                </Link>
              ) : null}
            </CardHeader>

            <CardContent className="grid gap-4">
              {canCreateSchedule ? (
                <ClassScheduleCreateForm
                  classId={detail.id}
                  defaultLearningMode={
                    detail.defaultLearningMode
                  }
                  remainingScheduleSlots={
                    remainingScheduleSlots
                  }
                />
              ) : canManageSchedule ? (
                <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning">
                  {detail.status !== "active"
                    ? "Cần kích hoạt lớp trước khi thiết lập lịch học."
                    : detail.academicYear?.status !==
                        "active"
                      ? "Năm học của lớp chưa ở trạng thái hoạt động."
                      : "Lớp đã đủ số lịch học cố định theo cấu hình số buổi mỗi tuần."}
                </div>
              ) : null}

              {activeSchedules.length === 0 ? (
                <NoticeText>
                  Lớp chưa có lịch học đang hiệu lực.
                </NoticeText>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {activeSchedules.map((schedule) => (
                    <ScheduleCard
                      canManageSchedule={
                        canModifySchedule
                      }
                      key={schedule.id}
                      schedule={schedule}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Lịch sử lịch học
              </CardTitle>
            </CardHeader>

            <CardContent>
              {historicalSchedules.length === 0 ? (
                <NoticeText>
                  Chưa có lịch học cũ.
                </NoticeText>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {historicalSchedules.map(
                    (schedule) => (
                      <ScheduleCard
                        key={schedule.id}
                        schedule={schedule}
                      />
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin năm học</CardTitle>
            </CardHeader>

            <CardContent>
              {!detail.academicYear ? (
                <NoticeText>
                  Chưa xác định năm học.
                </NoticeText>
              ) : (
                <div className="grid gap-3 text-sm">
                  <InfoLine
                    label="Mã năm học"
                    value={detail.academicYear.code}
                  />

                  <InfoLine
                    label="Tên năm học"
                    value={detail.academicYear.name}
                  />

                  <InfoLine
                    label="Ngày bắt đầu"
                    value={formatDate(
                      detail.academicYear.startsOn,
                    )}
                  />

                  <InfoLine
                    label="Ngày kết thúc"
                    value={formatDate(
                      detail.academicYear.endsOn,
                    )}
                  />

                  <InfoLine
                    label="Trạng thái"
                    value={formatAcademicYearStatus(
                      detail.academicYear.status,
                    )}
                  />

                  <InfoLine
                    label="Năm học hiện tại"
                    value={
                      detail.academicYear.isCurrent
                        ? "Có"
                        : "Không"
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ClassIn</CardTitle>
            </CardHeader>

            <CardContent>
              {detail.classinUrl ? (
                <a
                  aria-label="Mở lớp trên ClassIn, mở trong thẻ mới"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-hairline bg-white px-4 text-sm font-semibold text-primary transition hover:border-secondary hover:bg-canvas"
                  href={detail.classinUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Mở lớp trên ClassIn (thẻ mới)
                </a>
              ) : (
                <NoticeText>
                  Lớp chưa có đường dẫn ClassIn.
                </NoticeText>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trạng thái hệ thống</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3 text-sm">
              <InfoLine
                label="Trạng thái lớp"
                value={classStatus.label}
              />

              <InfoLine
                label="Lịch đang hiệu lực"
                value={String(
                  detail.activeScheduleCount,
                )}
              />

              <InfoLine
                label="Hình thức mặc định"
                value={formatMode(
                  detail.defaultLearningMode,
                )}
              />

              <InfoLine
                label="Mức lớp"
                value={detail.level}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScheduleCard({
  canManageSchedule = false,
  schedule,
}: {
  canManageSchedule?: boolean;
  schedule: ClassScheduleReadModel;
}) {
  return (
    <article className="rounded-md border border-hairline bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">
            {formatWeekday(schedule.weekday)}
          </p>

          <p className="mt-1 text-sm text-ink-muted">
            {formatTime(schedule.startTime)}
            {" – "}
            {formatTime(schedule.endTime)}
          </p>
        </div>

        <Badge
          tone={
            schedule.isActive
              ? "success"
              : "neutral"
          }
        >
          {schedule.isActive
            ? "Đang hiệu lực"
            : "Đã kết thúc"}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ModeBadge mode={schedule.learningMode} />

        {schedule.componentCode ? (
          <Badge tone="neutral">
            {schedule.componentCode}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <InfoLine
          label="Phòng"
          value={
            schedule.roomName ??
            (schedule.learningMode === "online"
              ? "Học trực tuyến"
              : "Chưa cập nhật")
          }
        />

        <InfoLine
          label="Hiệu lực từ"
          value={formatDate(
            schedule.effectiveFrom,
          )}
        />

        <InfoLine
          label="Hiệu lực đến"
          value={
            schedule.effectiveTo
              ? formatDate(schedule.effectiveTo)
              : "Hiện tại"
          }
        />
      </div>

      {schedule.meetingUrl ? (
        <a
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-hairline bg-white px-3 text-sm font-semibold text-primary hover:border-secondary hover:bg-surface-1"
          href={schedule.meetingUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Mở phòng học trực tuyến
        </a>
      ) : null}

      {canManageSchedule &&
      schedule.isActive ? (
        <div className="mt-4 grid gap-2">
          <ClassScheduleReplaceAction
            schedule={schedule}
          />

          <ClassScheduleEndAction
            schedule={schedule}
          />
        </div>
      ) : null}

      {schedule.endReason ? (
        <p className="mt-3 text-sm text-ink-muted">
          Lý do kết thúc: {schedule.endReason}
        </p>
      ) : null}
    </article>
  );
}

function InfoTile({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-hairline bg-canvas p-3 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-ink">
        {value}
      </p>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">
        {label}
      </span>

      <span className="text-right font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}

function NoticeText({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-hairline bg-canvas p-4 text-sm text-ink-muted">
      {children}
    </div>
  );
}

function ModeBadge({
  mode,
}: {
  mode: ClassLearningMode;
}) {
  return (
    <Badge
      tone={
        mode === "online"
          ? "purple"
          : mode === "offline"
            ? "info"
            : "warning"
      }
    >
      {formatMode(mode)}
    </Badge>
  );
}

function getClassStatusMeta(status: string): {
  label: string;
  tone:
    | "info"
    | "neutral"
    | "success"
    | "warning";
} {
  const metadata: Record<
    string,
    {
      label: string;
      tone:
        | "info"
        | "neutral"
        | "success"
        | "warning";
    }
  > = {
    active: {
      label: "Đang hoạt động",
      tone: "success",
    },
    archived: {
      label: "Lưu trữ",
      tone: "neutral",
    },
    closed: {
      label: "Đã đóng",
      tone: "neutral",
    },
    draft: {
      label: "Nháp",
      tone: "warning",
    },
  };

  if (!Object.hasOwn(metadata, status)) {
    return {
      label: `Trạng thái chưa hỗ trợ: ${status}`,
      tone: "neutral",
    };
  }

  return metadata[status];
}

function formatMode(value: string): string {
  if (value === "online") {
    return "Online";
  }

  if (value === "offline") {
    return "Offline";
  }

  if (value === "hybrid") {
    return "Kết hợp";
  }

  return value;
}

function formatAcademicYearStatus(
  value: string,
): string {
  const labels: Record<string, string> = {
    active: "Đang hoạt động",
    archived: "Lưu trữ",
    closed: "Đã đóng",
    draft: "Nháp",
  };

  return Object.hasOwn(labels, value)
    ? labels[value]
    : `Trạng thái chưa hỗ trợ: ${value}`;
}

function formatWeekday(value: number): string {
  const labels: Record<number, string> = {
    0: "Chủ nhật",
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
    7: "Chủ nhật",
  };

  return labels[value] ?? `Ngày ${value}`;
}

function formatDate(value: string): string {
  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}
