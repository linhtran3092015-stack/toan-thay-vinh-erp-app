"use client";

import type { ReactNode } from "react";
import {
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ResultBanner } from "@/components/shared/result-banner";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isInteractionLocked =
    isPending && actionState?.status !== "error";

  const openIntent = (
    nextIntent: LifecycleIntent,
    trigger: HTMLButtonElement,
  ) => {
    triggerRef.current = trigger;
    setActionState(null);
    setIntent(nextIntent);

    if (nextIntent !== "cancel") {
      setCancelReason("");
    }
  };

  const closeIntent = () => {
    if (isInteractionLocked) {
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
    if (isInteractionLocked) {
      return;
    }

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

        <div aria-hidden={intent !== null} className="flex flex-wrap gap-2" hidden={intent !== null}>
            {status === "scheduled" ? (
              <Button
                disabled={isInteractionLocked}
                onClick={(event) => openIntent("start", event.currentTarget)}
                type="button"
              >
                Bắt đầu buổi học
              </Button>
            ) : null}

            {status === "in_progress" ? (
              <Button
                disabled={isInteractionLocked}
                onClick={(event) => openIntent("complete", event.currentTarget)}
                type="button"
              >
                Hoàn thành buổi học
              </Button>
            ) : null}

            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-danger-border bg-danger-bg px-4 text-control font-semibold text-danger transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isInteractionLocked}
              onClick={(event) => openIntent("cancel", event.currentTarget)}
              type="button"
            >
              Hủy buổi học
            </button>
          </div>

        <Dialog ariaDescribedBy="session-lifecycle-dialog-description" ariaLabelledBy="session-lifecycle-dialog-title" isOpen={intent !== null} onClose={closeIntent} returnFocusRef={triggerRef}>
          <>
          {intent === "start" ? <ConfirmationPanel
            description="Sau khi bắt đầu, trợ giảng có thể nhập điểm danh và kết quả cho học viên."
            isInteractionLocked={isInteractionLocked}
            onCancel={closeIntent}
            onConfirm={() =>
              runLifecycleAction("start")
            }
            title="Xác nhận bắt đầu buổi học?"
          /> : null}

          {intent === "complete" ? <ConfirmationPanel
            description="Sau khi hoàn thành, buổi học không thể quay lại trạng thái đang diễn ra. Điểm danh và kết quả vẫn có thể được bổ sung trước khi khóa."
            isInteractionLocked={isInteractionLocked}
            onCancel={closeIntent}
            onConfirm={() =>
              runLifecycleAction("complete")
            }
            title="Xác nhận hoàn thành buổi học?"
          /> : null}

          {intent === "cancel" ? (
          <div className="grid gap-3 p-5">
            <div>
              <h3 className="text-section-title font-semibold text-text-strong" id="session-lifecycle-dialog-title">
                Xác nhận hủy buổi học
              </h3>

              <p className="mt-1 text-secondary text-text-muted" id="session-lifecycle-dialog-description">
                Hành động này thay đổi trạng thái
                buổi học thành đã hủy. Bắt buộc
                ghi rõ lý do.
              </p>
            </div>

            <label className="grid gap-1.5 text-label font-semibold text-text-strong">
              <span>
                Lý do hủy
                <span className="text-danger">
                  {" "}
                  *
                </span>
              </span>

              <textarea
                className="min-h-28 rounded-md border border-border-subtle bg-field-bg px-3 py-2 text-body font-normal text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:bg-disabled-bg"
                disabled={isInteractionLocked}
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
                disabled={isInteractionLocked}
                onClick={closeIntent}
                type="button"
                variant="ghost"
              >
                Quay lại
              </Button>

              <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-danger bg-danger px-4 text-control font-semibold text-text-on-danger transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isInteractionLocked ||
                  cancelReason.trim().length < 3
                }
                onClick={() =>
                  runLifecycleAction("cancel")
                }
                type="button"
              >
                {isInteractionLocked
                  ? "Đang hủy..."
                  : "Xác nhận hủy"}
              </button>
            </div>
          </div>
          ) : null}
          {actionState?.status === "error" ? (
            <ResultBanner
              description={actionState.message}
              title="Không thể cập nhật trạng thái buổi học"
              tone="error"
            />
          ) : null}
          </>
        </Dialog>

        {actionState?.status === "success" ? (
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
  isInteractionLocked,
  onCancel,
  onConfirm,
  title,
}: {
  description: string;
  isInteractionLocked: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <div className="grid gap-3 p-5">
      <div>
        <h3 className="text-section-title font-semibold text-text-strong" id="session-lifecycle-dialog-title">
          {title}
        </h3>

        <p className="mt-1 text-secondary text-text-muted" id="session-lifecycle-dialog-description">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          disabled={isInteractionLocked}
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          Quay lại
        </Button>

        <Button
          disabled={isInteractionLocked}
          onClick={onConfirm}
          type="button"
        >
          {isInteractionLocked
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
        className="rounded-md border border-success-border bg-success-bg p-3 text-body font-medium text-success"
        role="status"
      >
        {state.message}
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-danger-border bg-danger-bg p-3 text-body font-medium text-danger"
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
    <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-body text-warning">
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
    <div className="rounded-md border border-success-border bg-success-bg p-3 text-body text-success">
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
