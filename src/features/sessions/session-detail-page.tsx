import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionLifecycleActions } from "@/features/sessions/components/session-lifecycle-actions";
import type {
  SessionAttendanceStatus,
  SessionDetailReadModel,
  SessionNotebookStatus,
  SessionParticipantReadModel,
} from "@/features/sessions/detail-read-models";
import type {
  SessionKind,
  SessionLearningMode,
  SessionStatus,
} from "@/features/sessions/read-models";

interface SessionDetailPageProps {
  canLockSession: boolean;
  canManageResults: boolean;
  canManageSessions: boolean;
  canMarkAttendance: boolean;
  canViewAttendance: boolean;
  canViewResults: boolean;
  canViewStudents: boolean;
  detail: SessionDetailReadModel;
}

export function SessionDetailPage({
  canLockSession,
  canManageResults,
  canManageSessions,
  canMarkAttendance,
  canViewAttendance,
  canViewResults,
  canViewStudents,
  detail,
}: SessionDetailPageProps) {
  return (
    <div className="grid min-w-0 gap-4">
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Link
            className="font-semibold text-primary hover:underline"
            href="/sessions"
          >
            Buổi học
          </Link>

          <span>/</span>

          <span className="font-semibold text-ink">
            {formatDate(detail.sessionDate)}
          </span>
        </nav>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink md:text-3xl">
                {detail.classCode} –{" "}
                {detail.className}
              </h1>

              <SessionStatusBadge
                lockedAt={detail.lockedAt}
                status={detail.status}
              />
            </div>

            <p className="mt-2 text-sm text-ink-muted">
              {formatDate(detail.sessionDate)}
              {" · "}
              {formatTime(detail.startTime)}
              {" – "}
              {formatTime(detail.endTime)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <SessionKindBadge
                kind={detail.sessionKind}
              />

              <Badge tone="neutral">
                {formatMode(detail.learningMode)}
              </Badge>

              {detail.componentCode ? (
                <Badge tone="info">
                  Thành phần{" "}
                  {detail.componentCode}
                </Badge>
              ) : null}

              <Badge tone="neutral">
                Khối {detail.grade} · Mức{" "}
                {detail.level}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-hairline bg-white px-4 text-sm font-semibold text-ink transition hover:bg-surface-2"
              href={`/classes/${detail.classId}`}
            >
              Xem lớp học
            </Link>

            {canManageSessions ? (
              <Badge tone="success">
                Quản lý buổi
              </Badge>
            ) : null}

            {canMarkAttendance ? (
              <Badge tone="success">
                Nhập điểm danh
              </Badge>
            ) : null}

            {canManageResults ? (
              <Badge tone="success">
                Nhập kết quả
              </Badge>
            ) : null}

            {canLockSession ? (
              <Badge tone="purple">
                Khóa buổi
              </Badge>
            ) : null}
          </div>
        </div>
      </section>

      {canManageSessions ? (
        <SessionLifecycleActions
          classCode={detail.classCode}
          lockedAt={detail.lockedAt}
          sessionDate={detail.sessionDate}
          sessionId={detail.id}
          status={detail.status}
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Roster"
          value={
            detail.rosterCount === null
              ? "Không có quyền"
              : String(detail.rosterCount)
          }
        />

        <SummaryCard
          label="Đã điểm danh"
          value={
            detail.attendanceCount === null
              ? "Không có quyền"
              : String(
                  detail.attendanceCount,
                )
          }
        />

        <SummaryCard
          label="Đã có kết quả"
          value={
            detail.resultCount === null
              ? "Không có quyền"
              : String(detail.resultCount)
          }
        />

        <SummaryCard
          label="Dữ liệu"
          value={
            detail.lockedAt
              ? "Đã khóa"
              : "Chưa khóa"
          }
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Thông tin buổi học
              </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3">
              <InfoLine
                label="Ngày học"
                value={formatDate(
                  detail.sessionDate,
                )}
              />

              <InfoLine
                label="Thời gian"
                value={`${formatTime(
                  detail.startTime,
                )} – ${formatTime(
                  detail.endTime,
                )}`}
              />

              <InfoLine
                label="Loại buổi"
                value={formatKind(
                  detail.sessionKind,
                )}
              />

              <InfoLine
                label="Hình thức"
                value={formatMode(
                  detail.learningMode,
                )}
              />

              <InfoLine
                label="Phòng học"
                value={
                  detail.roomName ??
                  "Chưa xác định"
                }
              />

              <InfoLine
                label="Đường dẫn học"
                value={
                  detail.meetingUrl ??
                  "Chưa xác định"
                }
              />

              <InfoLine
                label="Bắt đầu"
                value={formatDateTime(
                  detail.startedAt,
                )}
              />

              <InfoLine
                label="Hoàn thành"
                value={formatDateTime(
                  detail.completedAt,
                )}
              />

              <InfoLine
                label="Ghi chú"
                value={
                  detail.notes ??
                  "Chưa có ghi chú"
                }
              />
            </CardContent>
          </Card>

          {detail.status === "cancelled" ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Thông tin hủy buổi
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                <InfoLine
                  label="Thời điểm hủy"
                  value={formatDateTime(
                    detail.cancelledAt,
                  )}
                />

                <InfoLine
                  label="Lý do"
                  value={
                    detail.cancellationReason ??
                    "Không có lý do"
                  }
                />
              </CardContent>
            </Card>
          ) : null}

          {detail.lockedAt ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Thông tin khóa dữ liệu
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                <InfoLine
                  label="Thời điểm khóa"
                  value={formatDateTime(
                    detail.lockedAt,
                  )}
                />

                <InfoLine
                  label="Lý do khóa"
                  value={
                    detail.lockReason ??
                    "Không có lý do"
                  }
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Học viên trong buổi học
            </CardTitle>
          </CardHeader>

          <CardContent>
            {!canViewAttendance &&
            !canViewResults &&
            !canViewStudents ? (
              <p className="text-sm text-ink-muted">
                Tài khoản hiện tại không có
                quyền xem roster, điểm danh hoặc
                kết quả của buổi học.
              </p>
            ) : detail.participants.length ===
              0 ? (
              <p className="text-sm text-ink-muted">
                Chưa có học viên hoặc dữ liệu
                điểm danh trong buổi học này.
              </p>
            ) : (
              <ParticipantTable
                canViewAttendance={
                  canViewAttendance
                }
                canViewResults={
                  canViewResults
                }
                canViewStudents={
                  canViewStudents
                }
                participants={
                  detail.participants
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ParticipantTable({
  canViewAttendance,
  canViewResults,
  canViewStudents,
  participants,
}: {
  canViewAttendance: boolean;
  canViewResults: boolean;
  canViewStudents: boolean;
  participants: SessionParticipantReadModel[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-3 py-3">
              Học viên
            </th>

            <th className="px-3 py-3">
              Hình thức đăng ký
            </th>

            {canViewAttendance ? (
              <th className="px-3 py-3">
                Điểm danh
              </th>
            ) : null}

            {canViewResults ? (
              <>
                <th className="px-3 py-3">
                  Điểm kiểm tra
                </th>

                <th className="px-3 py-3">
                  Điểm vở
                </th>

                <th className="px-3 py-3">
                  Nhận xét
                </th>
              </>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {participants.map((participant) => (
            <tr
              className="border-t border-hairline align-top"
              key={participant.studentId}
            >
              <td className="px-3 py-4">
                <p className="font-semibold text-ink">
                  {canViewStudents
                    ? participant.studentName ??
                      "Chưa có tên học viên"
                    : "Học viên ẩn"}
                </p>

                {canViewStudents &&
                participant.studentCode ? (
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    {participant.studentCode}
                  </p>
                ) : null}
              </td>

              <td className="px-3 py-4">
                {formatRegisteredMode(
                  participant.registeredMode,
                )}
              </td>

              {canViewAttendance ? (
                <td className="px-3 py-4">
                  <AttendanceBadge
                    status={
                      participant.attendanceStatus
                    }
                  />

                  {participant.isLateUpdate ? (
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      Cập nhật muộn
                    </p>
                  ) : null}
                </td>
              ) : null}

              {canViewResults ? (
                <>
                  <td className="px-3 py-4 font-semibold text-ink">
                    {formatScore(
                      participant.testScore,
                    )}
                  </td>

                  <td className="px-3 py-4">
                    <p className="font-semibold text-ink">
                      {formatScore(
                        participant.notebookScore,
                      )}
                    </p>

                    <p className="mt-1 text-xs text-ink-muted">
                      {formatNotebookStatus(
                        participant.notebookStatus,
                      )}
                    </p>
                  </td>

                  <td className="max-w-[260px] px-3 py-4 text-ink-muted">
                    {participant.resultComment ??
                      "Chưa có nhận xét"}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceBadge({
  status,
}: {
  status: SessionAttendanceStatus | null;
}) {
  if (!status) {
    return (
      <Badge tone="neutral">
        Chưa điểm danh
      </Badge>
    );
  }

  const labels: Record<
    SessionAttendanceStatus,
    string
  > = {
    additional_study: "Học thêm",
    excused_absence: "Vắng có phép",
    present: "Có mặt",
    unexcused_absence: "Vắng không phép",
  };

  const tones: Record<
    SessionAttendanceStatus,
    "info" | "neutral" | "success"
  > = {
    additional_study: "info",
    excused_absence: "neutral",
    present: "success",
    unexcused_absence: "neutral",
  };

  return (
    <Badge tone={tones[status]}>
      {labels[status]}
    </Badge>
  );
}

function SessionStatusBadge({
  lockedAt,
  status,
}: {
  lockedAt: string | null;
  status: SessionStatus;
}) {
  if (lockedAt) {
    return (
      <Badge tone="neutral">
        Đã khóa
      </Badge>
    );
  }

  const labels: Record<
    SessionStatus,
    string
  > = {
    cancelled: "Đã hủy",
    completed: "Đã hoàn thành",
    in_progress: "Đang học",
    scheduled: "Đã lên lịch",
  };

  const tones: Record<
    SessionStatus,
    "info" | "neutral" | "purple" | "success"
  > = {
    cancelled: "neutral",
    completed: "success",
    in_progress: "info",
    scheduled: "purple",
  };

  return (
    <Badge tone={tones[status]}>
      {labels[status]}
    </Badge>
  );
}

function SessionKindBadge({
  kind,
}: {
  kind: SessionKind;
}) {
  return (
    <Badge
      tone={
        kind === "regular"
          ? "info"
          : "neutral"
      }
    >
      {formatKind(kind)}
    </Badge>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-sm font-medium text-ink-muted">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold text-ink">
        {value}
      </p>
    </section>
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
    <div className="flex items-start justify-between gap-4 border-b border-hairline pb-3 last:border-0 last:pb-0">
      <dt className="text-sm font-medium text-ink-muted">
        {label}
      </dt>

      <dd className="max-w-[65%] text-right text-sm font-semibold text-ink">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    weekday: "long",
    year: "numeric",
  }).format(
    new Date(`${value}T00:00:00+07:00`),
  );
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Chưa có";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatKind(
  value: SessionKind,
): string {
  const labels: Record<SessionKind, string> = {
    additional: "Buổi bổ sung",
    makeup: "Buổi bù",
    regular: "Buổi chính",
  };

  return labels[value];
}

function formatMode(
  value: SessionLearningMode,
): string {
  const labels: Record<
    SessionLearningMode,
    string
  > = {
    hybrid: "Kết hợp",
    offline: "Offline",
    online: "Online",
  };

  return labels[value];
}

function formatRegisteredMode(
  value: string | null,
): string {
  if (value === "online") {
    return "Online";
  }

  if (value === "offline") {
    return "Offline";
  }

  return "Học thêm/Chưa xác định";
}

function formatScore(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNotebookStatus(
  value: SessionNotebookStatus | null,
): string {
  if (!value) {
    return "Chưa có dữ liệu";
  }

  const labels: Record<
    SessionNotebookStatus,
    string
  > = {
    not_required: "Không yêu cầu",
    not_submitted: "Chưa nộp",
    submitted: "Đã nộp",
  };

  return labels[value];
}
