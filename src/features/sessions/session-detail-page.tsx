import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import type { AdditionalStudyCandidate } from "@/features/sessions/attendance-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionWorkspace } from "@/features/sessions/components/session-workspace";
import { SessionAttendanceManagement } from "@/features/sessions/components/session-attendance-management";
import { SessionResultManagement } from "@/features/sessions/components/session-result-management";
import { SessionLockActions } from "@/features/sessions/components/session-lock-actions";
import { SessionLifecycleActions } from "@/features/sessions/components/session-lifecycle-actions";
import { SessionRescheduleDialog } from "@/features/sessions/components/session-reschedule-dialog";
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
  canReverseLedger?: boolean;
  canViewAttendance: boolean;
  canViewPayroll?: boolean;
  canViewResults: boolean;
  canViewStudents: boolean;
  detail: SessionDetailReadModel;
  directoryQuery?: string;
}

/**
 * Session workbench (design 04): state → attendance → results → lock. The
 * read-model and server actions are unchanged; this page only arranges them.
 */
export function SessionDetailPage({
  additionalStudyCandidates,
  canLockSession,
  canManageResults,
  canManageSessions,
  canMarkAttendance,
  canReverseLedger = false,
  canViewAttendance,
  canViewPayroll = false,
  canViewResults,
  canViewStudents,
  detail,
  directoryQuery = "",
}: SessionDetailPageProps) {
  const rosterCount = detail.participants.length;
  const markedCount = detail.participants.filter((participant) => participant.attendanceStatus !== null).length;
  const eligible = detail.participants.filter(
    (participant) => participant.attendanceStatus === "present" || participant.attendanceStatus === "additional_study",
  );
  const resultCount = eligible.filter((participant) => participant.resultId !== null).length;
  const showsAttendance = canViewAttendance || canMarkAttendance;
  const showsResults = canViewResults || canManageResults;
  const lockTile = detail.lockedAt
    ? { tone: "neutral" as const, value: "Đã khóa vĩnh viễn" }
    : detail.status !== "completed"
      ? { tone: "neutral" as const, value: "Chưa thể khóa" }
      : markedCount < rosterCount
        ? { tone: "warning" as const, value: `Bị chặn · thiếu ${rosterCount - markedCount} điểm danh` }
        : { tone: "success" as const, value: "Sẵn sàng" };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader
        actions={
          <Link className={getButtonClassName({ variant: "secondary" })} href={`/classes/${detail.classId}`}>
            Xem lớp học
          </Link>
        }
        context={
          <>
            <SessionStatusBadge status={detail.status} />
            {detail.lockedAt ? <Badge tone="neutral">Đã khóa</Badge> : null}
          </>
        }
        title={`${detail.classCode} · ${detail.className}`}
      >
        <p className="mt-1 text-secondary text-text-muted">
          {formatDate(detail.sessionDate)} · {formatTime(detail.startTime)}–{formatTime(detail.endTime)}
          {detail.roomName ? ` · ${detail.roomName}` : ""} · {formatKind(detail.sessionKind)}
          {detail.componentCode ? ` · ${detail.componentCode}` : ""} · {formatMode(detail.learningMode)} · Khối {detail.grade} · Mức {detail.level}
          {rosterCount > 0 ? ` · ${rosterCount} học sinh` : ""}
        </p>
        <nav aria-label="Điều hướng buổi học" className="mt-2 text-secondary">
          <Link
            className="font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={directoryQuery ? `/sessions?${directoryQuery}` : "/sessions"}
          >
            ← Danh sách buổi học
          </Link>
        </nav>
      </PageHeader>

      {rosterCount > 0 && (showsAttendance || showsResults || canLockSession) ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {showsAttendance ? (
            <WorkbenchTile
              label="Điểm danh"
              tone={markedCount === rosterCount ? "success" : "warning"}
              value={`${markedCount}/${rosterCount}`}
              hint={markedCount === rosterCount ? "đủ roster" : `${rosterCount - markedCount} chưa điểm danh`}
            />
          ) : null}
          {showsResults ? (
            <WorkbenchTile
              label="Kết quả"
              tone={eligible.length > 0 && resultCount === eligible.length ? "success" : "neutral"}
              value={`${resultCount}/${eligible.length}`}
              hint={eligible.length === 0 ? "chưa có học sinh đủ điều kiện" : resultCount === eligible.length ? "đủ cho học sinh có mặt" : `thiếu ${eligible.length - resultCount}`}
            />
          ) : null}
          {canLockSession ? <WorkbenchTile label="Khóa buổi" tone={lockTile.tone} value={lockTile.value} /> : null}
        </div>
      ) : null}

      {canManageSessions ? (
        <SessionLifecycleActions
          classCode={detail.classCode}
          lockedAt={detail.lockedAt}
          sessionDate={detail.sessionDate}
          sessionId={detail.id}
          status={detail.status}
        />
      ) : null}

      {canManageSessions && detail.status === "scheduled" && !detail.lockedAt ? (
        <div className="flex flex-wrap items-center gap-3">
          <SessionRescheduleDialog
            classCode={detail.classCode}
            endTime={detail.endTime}
            learningMode={detail.learningMode}
            meetingUrl={detail.meetingUrl}
            notes={detail.notes}
            roomName={detail.roomName}
            sessionDate={detail.sessionDate}
            sessionId={detail.id}
            startTime={detail.startTime}
          />
          {detail.previousSessionDate ? (
            <p className="text-caption text-text-muted">
              Đã dời {detail.rescheduleCount} lần, lần gần nhất từ ngày {formatIsoDate(detail.previousSessionDate)}.
            </p>
          ) : null}
        </div>
      ) : null}

      <SessionWorkspace
        attendance={
          showsAttendance ? (
            <SessionAttendanceManagement
              additionalStudyCandidates={additionalStudyCandidates}
              canMarkAttendance={canMarkAttendance}
              canViewStudents={canViewStudents}
              defaultLearningMode={detail.learningMode}
              lockedAt={detail.lockedAt}
              participants={detail.participants}
              sessionId={detail.id}
              sessionStatus={detail.status}
            />
          ) : null
        }
        attendancePending={detail.lockedAt ? 0 : rosterCount - markedCount}
        results={
          showsResults ? (
            <SessionResultManagement
              canManageResults={canManageResults}
              canViewStudents={canViewStudents}
              lockedAt={detail.lockedAt}
              participants={detail.participants}
              sessionId={detail.id}
              sessionStatus={detail.status}
            />
          ) : null
        }
        resultsPending={detail.lockedAt ? 0 : eligible.length - resultCount}
      />

      {canLockSession ? (
        <SessionLockActions
          canReverseLedger={canReverseLedger}
          canViewPayroll={canViewPayroll}
          lockedAt={detail.lockedAt}
          lockReason={detail.lockReason}
          markedCount={markedCount}
          rosterCount={rosterCount}
          sessionId={detail.id}
          sessionStatus={detail.status}
        />
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin buổi học</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3">
              <InfoLine label="Ngày học" value={formatDate(detail.sessionDate)} />
              <InfoLine label="Thời gian" value={`${formatTime(detail.startTime)} – ${formatTime(detail.endTime)}`} />
              <InfoLine label="Loại buổi" value={formatKind(detail.sessionKind)} />
              <InfoLine label="Hình thức" value={formatMode(detail.learningMode)} />
              <InfoLine label="Phòng học" value={detail.roomName ?? "Chưa xác định"} />
              <InfoLine label="Đường dẫn học" value={detail.meetingUrl ?? "Chưa xác định"} />
              <InfoLine label="Bắt đầu" value={formatDateTime(detail.startedAt)} />
              <InfoLine label="Hoàn thành" value={formatDateTime(detail.completedAt)} />
              <InfoLine label="Ghi chú" value={detail.notes ?? "Chưa có ghi chú"} />
            </CardContent>
          </Card>

          {detail.status === "cancelled" ? (
            <Card>
              <CardHeader>
                <CardTitle>Thông tin hủy buổi</CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                <InfoLine label="Thời điểm hủy" value={formatDateTime(detail.cancelledAt)} />
                <InfoLine label="Lý do" value={detail.cancellationReason ?? "Không có lý do"} />
              </CardContent>
            </Card>
          ) : null}

          {detail.lockedAt ? (
            <Card>
              <CardHeader>
                <CardTitle>Thông tin khóa dữ liệu</CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                <InfoLine label="Thời điểm khóa" value={formatDateTime(detail.lockedAt)} />
                <InfoLine label="Lý do khóa" value={detail.lockReason ?? "Không có lý do"} />
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
            <CardTitle>Học sinh trong buổi học</CardTitle>
          </CardHeader>

          <CardContent>
            {!canViewAttendance && !canViewResults && !canViewStudents ? (
              <p className="text-body text-text-muted">
                Tài khoản hiện tại không có quyền xem roster, điểm danh hoặc kết quả của buổi học.
              </p>
            ) : detail.participants.length === 0 ? (
              <p className="text-body text-text-muted">
                Chưa có học sinh hoặc dữ liệu điểm danh trong buổi học này.
              </p>
            ) : (
              <ParticipantTable
                canViewAttendance={canViewAttendance}
                canViewResults={canViewResults}
                canViewStudents={canViewStudents}
                participants={detail.participants}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkbenchTile({
  hint,
  label,
  tone,
  value,
}: {
  hint?: string;
  label: string;
  tone: "success" | "warning" | "neutral";
  value: string;
}) {
  const dot =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-text-subtle";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="text-secondary text-text-muted">{label}</p>
        <p className="text-body font-semibold tabular-nums text-text-strong">
          {value}
          {hint ? <span className="ml-1.5 text-secondary font-normal text-text-muted">· {hint}</span> : null}
        </p>
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
    <div className="overflow-x-auto rounded-md border border-border-subtle">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-table-body">
        <thead className="bg-table-header text-table-header text-text-muted">
          <tr>
            <Th>Học sinh</Th>
            <Th>Hình thức đăng ký</Th>
            {canViewAttendance ? <Th>Điểm danh</Th> : null}
            {canViewResults ? (
              <>
                <Th numeric>Điểm kiểm tra</Th>
                <Th>Vở bài tập</Th>
                <Th>Nhận xét</Th>
              </>
            ) : null}
          </tr>
        </thead>

        <tbody className="[&>tr+tr>td]:border-t [&>tr+tr>td]:border-border-row">
          {participants.map((participant) => (
            <tr className="h-12 align-middle" key={participant.studentId}>
              <td className="px-3 py-1.5">
                <p className="font-semibold text-text-strong">
                  {canViewStudents
                    ? participant.studentName ?? "Chưa có tên học viên"
                    : "Học viên ẩn"}
                </p>
                {canViewStudents && participant.studentCode ? (
                  <p className="text-caption tabular-nums text-text-muted">{participant.studentCode}</p>
                ) : null}
              </td>
              <td className="px-3 text-secondary text-text-default">{formatRegisteredMode(participant.registeredMode)}</td>
              {canViewAttendance ? (
                <td className="px-3">
                  <AttendanceBadge status={participant.attendanceStatus} />
                  {participant.isLateUpdate ? (
                    <p className="mt-1 text-caption font-semibold text-warning">Cập nhật muộn</p>
                  ) : null}
                </td>
              ) : null}
              {canViewResults ? (
                <>
                  <td className="px-3 text-right font-semibold tabular-nums text-text-strong">{formatScore(participant.testScore)}</td>
                  <td className="px-3">
                    <p className="font-medium text-text-strong">{formatNotebookStatus(participant.notebookStatus)}</p>
                    <p className="text-caption text-text-muted">Điểm vở: {formatScore(participant.notebookScore)}</p>
                  </td>
                  <td className="max-w-[260px] px-3 text-secondary text-text-muted">
                    {participant.resultComment ?? "Chưa có nhận xét"}
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

function Th({ children, numeric }: { children: ReactNode; numeric?: boolean }) {
  return (
    <th className={`h-10 whitespace-nowrap px-3 font-semibold ${numeric ? "text-right" : "text-left"}`} scope="col">
      {children}
    </th>
  );
}

function AttendanceBadge({ status }: { status: SessionAttendanceStatus | null }) {
  if (!status) {
    return <Badge tone="neutral">Chưa điểm danh</Badge>;
  }

  const labels: Record<SessionAttendanceStatus, string> = {
    additional_study: "Học thêm",
    excused_absence: "Vắng có phép",
    present: "Có mặt",
    unexcused_absence: "Vắng không phép",
  };

  const tones: Record<SessionAttendanceStatus, "info" | "success" | "warning" | "danger"> = {
    additional_study: "warning",
    excused_absence: "info",
    present: "success",
    unexcused_absence: "danger",
  };

  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const labels: Record<SessionStatus, string> = {
    cancelled: "Đã hủy",
    completed: "Đã hoàn thành",
    in_progress: "Đang diễn ra",
    scheduled: "Sắp diễn ra",
  };

  const tones: Record<SessionStatus, "info" | "neutral" | "success"> = {
    cancelled: "neutral",
    completed: "success",
    in_progress: "info",
    scheduled: "info",
  };

  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-row pb-3 last:border-0 last:pb-0">
      <dt className="text-body text-text-muted">{label}</dt>
      <dd className="max-w-[65%] text-right text-body font-medium text-text-strong">{value}</dd>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function formatDateTime(value: string | null): string {
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

function formatKind(value: SessionKind): string {
  const labels: Record<SessionKind, string> = {
    additional: "Buổi bổ sung",
    makeup: "Buổi bù",
    regular: "Buổi chính khóa",
  };

  return labels[value];
}

function formatMode(value: SessionLearningMode): string {
  const labels: Record<SessionLearningMode, string> = {
    hybrid: "Kết hợp",
    offline: "Tại lớp",
    online: "Trực tuyến",
  };

  return labels[value];
}

function formatRegisteredMode(value: string | null): string {
  if (value === "online") {
    return "Online";
  }

  if (value === "offline") {
    return "Offline";
  }

  return "Học thêm/Chưa xác định";
}

function formatScore(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNotebookStatus(value: SessionNotebookStatus | null): string {
  if (!value) {
    return "Chưa có dữ liệu";
  }

  const labels: Record<SessionNotebookStatus, string> = {
    not_required: "Không yêu cầu",
    not_submitted: "Chưa nộp",
    submitted: "Đã nộp",
  };

  return labels[value];
}

function formatIsoDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
