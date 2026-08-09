import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/patterns/page-header";
import type { AdditionalStudyCandidate } from "@/features/sessions/attendance-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionAttendanceManagement } from "@/features/sessions/components/session-attendance-management";
import { SessionResultManagement } from "@/features/sessions/components/session-result-management";
import { SessionLockActions } from "@/features/sessions/components/session-lock-actions";
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
  additionalStudyCandidates:
    AdditionalStudyCandidate[];
  canLockSession: boolean;
  canManageResults: boolean;
  canManageSessions: boolean;
  canMarkAttendance: boolean;
  canViewAttendance: boolean;
  canViewResults: boolean;
  canViewStudents: boolean;
  detail: SessionDetailReadModel;
  directoryQuery?: string;
}

export function SessionDetailPage({
  additionalStudyCandidates,
  canLockSession,
  canManageResults,
  canManageSessions,
  canMarkAttendance,
  canViewAttendance,
  canViewResults,
  canViewStudents,
  detail,
  directoryQuery = "",
}: SessionDetailPageProps) {
  return (
    <div className="grid min-w-0 gap-6">
      <section className="grid gap-4">
        <nav aria-label="Điều hướng buổi học" className="flex flex-wrap items-center gap-2 text-secondary text-text-muted">
          <Link
            className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
            href={directoryQuery ? `/sessions?${directoryQuery}` : "/sessions"}
          >
            Buổi học
          </Link>

          <span>/</span>

          <span className="font-semibold text-ink">
            {formatDate(detail.sessionDate)}
          </span>
        </nav>

        <PageHeader
          context={<><SessionStatusBadge status={detail.status} />{detail.lockedAt ? <Badge tone="neutral">Đã khóa</Badge> : null}</>}
          title={`${detail.classCode} – ${detail.className}`}
          actions={<Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-border-subtle bg-surface-base px-4 text-control font-semibold text-text-strong hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={`/classes/${detail.classId}`}>Xem lớp học</Link>}
        >
            <p className="mt-1 text-secondary text-text-muted">
              {formatDate(detail.sessionDate)}
              {" · "}
              {formatTime(detail.startTime)}
              {" – "}
              {formatTime(detail.endTime)}
            </p>

            <p className="mt-2 text-secondary text-text-muted">{formatKind(detail.sessionKind)}{detail.componentCode ? ` · ${detail.componentCode}` : ""} · {formatMode(detail.learningMode)} · Khối {detail.grade} · Mức {detail.level}{detail.roomName ? ` · ${detail.roomName}` : ""}</p>
        </PageHeader>
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

      {canViewAttendance ||
      canMarkAttendance ? (
        <SessionAttendanceManagement
          additionalStudyCandidates={
            additionalStudyCandidates
          }
          canMarkAttendance={
            canMarkAttendance
          }
          canViewStudents={
            canViewStudents
          }
          defaultLearningMode={
            detail.learningMode
          }
          lockedAt={detail.lockedAt}
          participants={
            detail.participants
          }
          sessionId={detail.id}
          sessionStatus={detail.status}
        />
      ) : null}

      {canViewResults ||
      canManageResults ? (
        <SessionResultManagement
          canManageResults={
            canManageResults
          }
          canViewStudents={
            canViewStudents
          }
          lockedAt={detail.lockedAt}
          participants={
            detail.participants
          }
          sessionId={detail.id}
          sessionStatus={detail.status}
        />
      ) : null}

      {canLockSession ? (
        <SessionLockActions
          lockedAt={detail.lockedAt}
          lockReason={detail.lockReason}
          sessionId={detail.id}
          sessionStatus={detail.status}
        />
      ) : null}

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

                <InfoLine
                  label="Ghi nhận sổ cái"
                  value={
                    detail.sessionKind === "regular" ||
                    detail.sessionKind === "makeup"
                      ? "Đã phát sinh trừ 1 buổi (-1)"
                      : "Buổi bổ sung (không trừ buổi)"
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

function SessionStatusBadge({ status }: { status: SessionStatus }) {
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
    "info" | "neutral" | "success"
  > = {
    cancelled: "neutral",
    completed: "success",
    in_progress: "info",
    scheduled: "info",
  };

  return (
    <Badge tone={tones[status]}>
      {labels[status]}
    </Badge>
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
