"use client";

import type { ReactNode } from "react";
import {
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  cancelSessionAction,
  completeSessionAction,
  startSessionAction,
} from "@/features/sessions/actions/session-lifecycle-actions";
import type { SessionLifecycleActionState } from "@/features/sessions/forms/session-action-types";
import type { SessionStatus } from "@/features/sessions/read-models";

type LifecycleIntent =
  | "start"
  | "complete"
  | "cancel"
  | null;

interface SessionLifecycleActionsProps {
  classCode: string;
  lockedAt: string | null;
  sessionDate: string;
  sessionId: string;
  status: SessionStatus;
}

export function SessionLifecycleActions({
  classCode,
  lockedAt,
  sessionDate,
  sessionId,
  status,
}: SessionLifecycleActionsProps) {
  const router = useRouter();

  const [intent, setIntent] =
    useState<LifecycleIntent>(null);

  const [cancelReason, setCancelReason] =
    useState("");

  const [actionState, setActionState] =
    useState<
      SessionLifecycleActionState | null
    >(null);

  const [isPending, startTransition] =
    useTransition();

  const openIntent = (
    nextIntent: LifecycleIntent,
  ) => {
    setActionState(null);
    setIntent(nextIntent);

    if (nextIntent !== "cancel") {
      setCancelReason("");
    }
  };

  const closeIntent = () => {
    if (isPending) {
      return;
    }

    setIntent(null);
    setCancelReason("");
    setActionState(null);
  };

  const runLifecycleAction = (
    action:
      | "start"
      | "complete"
      | "cancel",
  ) => {
    setActionState(null);

    startTransition(async () => {
      const result =
        action === "start"
          ? await startSessionAction({
              sessionId,
            })
          : action === "complete"
            ? await completeSessionAction({
                sessionId,
              })
            : await cancelSessionAction({
                reason: cancelReason,
                sessionId,
              });

      setActionState(result);

      if (result.status === "success") {
        setIntent(null);
        setCancelReason("");
        router.refresh();
      }
    });
  };

  if (lockedAt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Thao tác buổi học
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Notice>
            Buổi học đã khóa. Không thể bắt đầu,
            hoàn thành, hủy hoặc thay đổi dữ liệu.
          </Notice>
        </CardContent>
      </Card>
    );
  }

  if (status === "completed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Thao tác buổi học
          </CardTitle>
        </CardHeader>

        <CardContent>
          <SuccessNotice>
            Buổi học đã hoàn thành. Tiếp tục kiểm
            tra điểm danh, kết quả và điều kiện
            khóa dữ liệu.
          </SuccessNotice>
        </CardContent>
      </Card>
    );
  }

  if (status === "cancelled") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Thao tác buổi học
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Notice>
            Buổi học đã hủy và không còn thao tác
            lifecycle. Buổi này có thể được chọn
            làm nguồn khi tạo buổi bù.
          </Notice>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Thao tác buổi học
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div>
          <p className="font-semibold text-ink">
            {classCode} ·{" "}
            {formatDate(sessionDate)}
          </p>

          <p className="mt-1 text-sm text-ink-muted">
            {status === "scheduled"
              ? "Buổi học đang ở trạng thái đã lên lịch."
              : "Buổi học đang diễn ra."}
          </p>
        </div>

        {intent === null ? (
          <div className="flex flex-wrap gap-2">
            {status === "scheduled" ? (
              <Button
                disabled={isPending}
                onClick={() =>
                  openIntent("start")
                }
                type="button"
              >
                Bắt đầu buổi học
              </Button>
            ) : null}

            {status === "in_progress" ? (
              <Button
                disabled={isPending}
                onClick={() =>
                  openIntent("complete")
                }
                type="button"
              >
                Hoàn thành buổi học
              </Button>
            ) : null}

            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={() =>
                openIntent("cancel")
              }
              type="button"
            >
              Hủy buổi học
            </button>
          </div>
        ) : null}

        {intent === "start" ? (
          <ConfirmationPanel
            description="Sau khi bắt đầu, trợ giảng có thể nhập điểm danh và kết quả cho học viên."
            isPending={isPending}
            onCancel={closeIntent}
            onConfirm={() =>
              runLifecycleAction("start")
            }
            title="Xác nhận bắt đầu buổi học?"
          />
        ) : null}

        {intent === "complete" ? (
          <ConfirmationPanel
            description="Sau khi hoàn thành, buổi học không thể quay lại trạng thái đang diễn ra. Điểm danh và kết quả vẫn có thể được bổ sung trước khi khóa."
            isPending={isPending}
            onCancel={closeIntent}
            onConfirm={() =>
              runLifecycleAction("complete")
            }
            title="Xác nhận hoàn thành buổi học?"
          />
        ) : null}

        {intent === "cancel" ? (
          <div className="grid gap-3 rounded-md border border-red-200 bg-red-50 p-4">
            <div>
              <h3 className="font-semibold text-red-800">
                Xác nhận hủy buổi học
              </h3>

              <p className="mt-1 text-sm text-red-700">
                Hành động này thay đổi trạng thái
                buổi học thành đã hủy. Bắt buộc
                ghi rõ lý do.
              </p>
            </div>

            <label className="grid gap-1.5 text-sm font-semibold text-ink">
              <span>
                Lý do hủy
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
                  setCancelReason(
                    event.target.value,
                  );
                  setActionState(null);
                }}
                placeholder="Ví dụ: Trung tâm thông báo nghỉ do thời tiết..."
                value={cancelReason}
              />

              <span className="text-xs font-normal text-ink-muted">
                {cancelReason.trim().length}/500
                ký tự
              </span>
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={isPending}
                onClick={closeIntent}
                type="button"
                variant="ghost"
              >
                Quay lại
              </Button>

              <button
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isPending ||
                  cancelReason.trim().length < 3
                }
                onClick={() =>
                  runLifecycleAction("cancel")
                }
                type="button"
              >
                {isPending
                  ? "Đang hủy..."
                  : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        ) : null}

        {actionState ? (
          <ActionMessage
            state={actionState}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ConfirmationPanel({
  description,
  isPending,
  onCancel,
  onConfirm,
  title,
}: {
  description: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
      <div>
        <h3 className="font-semibold text-amber-900">
          {title}
        </h3>

        <p className="mt-1 text-sm text-amber-800">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          disabled={isPending}
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          Quay lại
        </Button>

        <Button
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          {isPending
            ? "Đang xử lý..."
            : "Xác nhận"}
        </Button>
      </div>
    </div>
  );
}

function ActionMessage({
  state,
}: {
  state: SessionLifecycleActionState;
}) {
  if (state.status === "success") {
    return (
      <div
        className="rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700"
        role="status"
      >
        {state.message}
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
      role="alert"
    >
      {state.message}
    </div>
  );
}

function Notice({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      {children}
    </div>
  );
}

function SuccessNotice({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
      {children}
    </div>
  );
}

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(
    new Date(`${value}T00:00:00+07:00`),
  );
}
