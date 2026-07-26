"use client";

import type { ReactNode } from "react";
import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { lockSessionAction } from "@/features/sessions/actions/session-result-actions";
import type {
  SessionAttendanceStatus,
  SessionParticipantReadModel,
} from "@/features/sessions/detail-read-models";
import type { SessionLockActionState } from "@/features/sessions/forms/result-action-types";
import type {
  SessionKind,
  SessionStatus,
} from "@/features/sessions/read-models";

interface SessionLockActionsProps {
  lockedAt: string | null;
  lockReason: string | null;
  participants: SessionParticipantReadModel[];
  sessionId: string;
  sessionKind: SessionKind;
  sessionStatus: SessionStatus;
}

export function SessionLockActions({
  lockedAt,
  lockReason,
  participants,
  sessionId,
  sessionKind,
  sessionStatus,
}: SessionLockActionsProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] =
    useState(false);

  const [reason, setReason] =
    useState("");

  const [actionState, setActionState] =
    useState<SessionLockActionState | null>(
      null,
    );

  const [isPending, startTransition] =
    useTransition();

  const readiness = useMemo(
    () =>
      getSessionLockReadiness(
        participants,
        sessionKind,
      ),
    [participants, sessionKind],
  );

  const isReady =
    sessionStatus === "completed" &&
    lockedAt === null &&
    readiness.attendanceCount > 0 &&
    readiness.missingRosterAttendance ===
      0 &&
    readiness.missingResults === 0;

  const closePanel = () => {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    setReason("");
    setActionState(null);
  };

  const submitLock = () => {
    setActionState(null);

    startTransition(async () => {
      const result =
        await lockSessionAction({
          reason,
          sessionId,
        });

      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        setReason("");
        router.refresh();
      }
    });
  };

  if (lockedAt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Khóa dữ liệu buổi học
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3">
          <Notice tone="success">
            Buổi học đã được khóa. Điểm danh,
            kết quả và thông tin buổi học không
            thể thay đổi thêm.
          </Notice>

          <div className="rounded-md border border-hairline bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">
              Lý do khóa
            </p>

            <p className="mt-1 text-sm text-ink-muted">
              {lockReason ??
                "Không có nội dung lý do."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessionStatus !== "completed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Khóa dữ liệu buổi học
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Notice tone="neutral">
            Chỉ buổi học đã hoàn thành mới có
            thể khóa dữ liệu.
          </Notice>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Kiểm tra và khóa buổi học
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        <Notice
          tone={
            isReady
              ? "success"
              : "warning"
          }
        >
          {isReady
            ? "Buổi học đã đáp ứng các điều kiện cơ bản để khóa."
            : "Buổi học chưa đáp ứng đầy đủ điều kiện khóa."}
        </Notice>

        <div className="grid gap-3 sm:grid-cols-3">
          <ReadinessItem
            description="Database yêu cầu có ít nhất một bản ghi điểm danh."
            isComplete={
              readiness.attendanceCount > 0
            }
            label="Bản ghi điểm danh"
            value={readiness.attendanceCount}
          />

          <ReadinessItem
            description={
              sessionKind === "additional"
                ? "Buổi bổ sung không bắt buộc đầy đủ roster."
                : "Buổi chính và buổi bù phải điểm danh đầy đủ roster."
            }
            isComplete={
              readiness
                .missingRosterAttendance === 0
            }
            label="Thiếu điểm danh roster"
            value={
              readiness
                .missingRosterAttendance
            }
          />

          <ReadinessItem
            description="Học viên có mặt hoặc học thêm phải có điểm kiểm tra."
            isComplete={
              readiness.missingResults === 0
            }
            label="Thiếu kết quả"
            value={
              readiness.missingResults
            }
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            tone={
              readiness.attendanceCount > 0
                ? "success"
                : "neutral"
            }
          >
            Điểm danh:{" "}
            {readiness.attendanceCount}
          </Badge>

          <Badge
            tone={
              readiness
                .missingRosterAttendance ===
              0
                ? "success"
                : "neutral"
            }
          >
            Thiếu roster:{" "}
            {
              readiness
                .missingRosterAttendance
            }
          </Badge>

          <Badge
            tone={
              readiness.missingResults === 0
                ? "success"
                : "neutral"
            }
          >
            Thiếu điểm kiểm tra:{" "}
            {readiness.missingResults}
          </Badge>
        </div>

        {!isReady ? (
          <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {readiness.attendanceCount ===
            0 ? (
              <p>
                • Buổi học chưa có dữ liệu điểm
                danh.
              </p>
            ) : null}

            {readiness
              .missingRosterAttendance >
            0 ? (
              <p>
                • Còn{" "}
                {
                  readiness
                    .missingRosterAttendance
                }{" "}
                học viên trong roster chưa được
                điểm danh hợp lệ.
              </p>
            ) : null}

            {readiness.missingResults > 0 ? (
              <p>
                • Còn{" "}
                {readiness.missingResults} học
                viên có mặt/học thêm chưa có điểm
                kiểm tra.
              </p>
            ) : null}
          </div>
        ) : null}

        {isReady && !isOpen ? (
          <div className="flex justify-end">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={() => {
                setIsOpen(true);
                setActionState(null);
              }}
              type="button"
            >
              Khóa buổi học
            </button>
          </div>
        ) : null}

        {isOpen ? (
          <div className="grid gap-4 rounded-md border border-red-200 bg-red-50 p-4">
            <div>
              <h3 className="font-semibold text-red-800">
                Xác nhận khóa vĩnh viễn
              </h3>

              <p className="mt-1 text-sm text-red-700">
                Sau khi khóa, điểm danh, kết quả
                và dữ liệu buổi học không thể
                chỉnh sửa hoặc mở khóa trở lại.
              </p>
            </div>

            <label className="grid gap-1.5 text-sm font-semibold text-ink">
              <span>
                Lý do khóa
                <span className="text-red-600">
                  {" "}
                  *
                </span>
              </span>

              <textarea
                className="min-h-28 rounded-md border border-hairline bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-surface-2"
                disabled={isPending}
                maxLength={500}
                onChange={(event) => {
                  setReason(
                    event.target.value,
                  );
                  setActionState(null);
                }}
                placeholder="Ví dụ: Đã hoàn tất đối soát điểm danh và kết quả cuối buổi..."
                value={reason}
              />

              <span className="text-xs font-normal text-ink-muted">
                {reason.trim().length}/500 ký
                tự
              </span>
            </label>

            {actionState?.status ===
            "error" ? (
              <div
                className="rounded-md border border-red-300 bg-white p-3 text-sm font-medium text-red-700"
                role="alert"
              >
                {actionState.message}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={isPending}
                onClick={closePanel}
                type="button"
                variant="ghost"
              >
                Quay lại
              </Button>

              <button
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isPending ||
                  reason.trim().length < 3
                }
                onClick={submitLock}
                type="button"
              >
                {isPending
                  ? "Đang khóa..."
                  : "Xác nhận khóa"}
              </button>
            </div>
          </div>
        ) : null}

        {actionState?.status ===
        "success" ? (
          <div
            className="rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700"
            role="status"
          >
            {actionState.message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadinessItem({
  description,
  isComplete,
  label,
  value,
}: {
  description: string;
  isComplete: boolean;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-hairline bg-surface-1 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {label}
        </p>

        <Badge
          tone={
            isComplete
              ? "success"
              : "neutral"
          }
        >
          {value}
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-5 text-ink-muted">
        {description}
      </p>
    </div>
  );
}

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "neutral" | "success" | "warning";
}) {
  const classNames = {
    neutral:
      "border-hairline bg-surface-2 text-ink-muted",
    success:
      "border-green-200 bg-green-50 text-green-800",
    warning:
      "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div
      className={`rounded-md border p-3 text-sm ${classNames[tone]}`}
    >
      {children}
    </div>
  );
}

function getSessionLockReadiness(
  participants: SessionParticipantReadModel[],
  sessionKind: SessionKind,
): {
  attendanceCount: number;
  missingResults: number;
  missingRosterAttendance: number;
} {
  const attendanceCount =
    participants.filter(
      (participant) =>
        participant.attendanceId !== null,
    ).length;

  const missingRosterAttendance =
    sessionKind === "additional"
      ? 0
      : participants.filter(
          (participant) =>
            participant.enrollmentId !==
              null &&
            !isMainRosterAttendance(
              participant.attendanceStatus,
            ),
        ).length;

  const missingResults =
    participants.filter(
      (participant) =>
        isResultRequired(
          participant.attendanceStatus,
        ) &&
        (
          participant.resultId === null ||
          participant.testScore === null
        ),
    ).length;

  return {
    attendanceCount,
    missingResults,
    missingRosterAttendance,
  };
}

function isMainRosterAttendance(
  status:
    | SessionAttendanceStatus
    | null,
): boolean {
  return (
    status === "present" ||
    status === "excused_absence" ||
    status === "unexcused_absence"
  );
}

function isResultRequired(
  status:
    | SessionAttendanceStatus
    | null,
): boolean {
  return (
    status === "present" ||
    status === "additional_study"
  );
}
