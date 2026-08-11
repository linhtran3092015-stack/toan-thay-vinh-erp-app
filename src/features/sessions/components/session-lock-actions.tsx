"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResultBanner } from "@/components/shared/result-banner";
import { lockSessionAction } from "@/features/sessions/actions/session-result-actions";
import type { SessionLockActionState } from "@/features/sessions/forms/result-action-types";
import type { SessionStatus } from "@/features/sessions/read-models";

interface SessionLockActionsProps {
  lockedAt: string | null;
  lockReason: string | null;
  sessionId: string;
  sessionStatus: SessionStatus;
}

export function SessionLockActions({
  lockedAt,
  lockReason,
  sessionId,
  sessionStatus,
}: SessionLockActionsProps) {
  const router = useRouter();
  const confirmationTriggerRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);
  const dialogDescriptionId = useId();
  const dialogTitleId = useId();
  const reasonErrorId = useId();
  const reasonHelpId = useId();
  const reasonInputId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionState, setActionState] =
    useState<SessionLockActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked =
    isPending && actionState?.status !== "error";

  const isLockable =
    sessionStatus === "completed" && lockedAt === null;
  const reasonError =
    actionState?.status === "error"
      ? actionState.fieldErrors?.reason?.[0]
      : undefined;

  useEffect(() => {
    if (actionState?.status === "success") {
      feedbackRef.current?.focus();
    }
  }, [actionState]);

  const closeConfirmation = () => {
    if (isInteractionLocked) {
      return;
    }

    setIsOpen(false);
    setReason("");
    setActionState(null);
  };

  const openConfirmation = () => {
    setActionState(null);
    setIsOpen(true);
  };

  const submitLock = () => {
    setActionState(null);

    startTransition(async () => {
      const result = await lockSessionAction({
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
          <CardTitle>Khóa dữ liệu buổi học</CardTitle>
          <Badge tone="neutral">Đã khóa</Badge>
        </CardHeader>

        <CardContent className="grid gap-4">
          <ResultBanner
            description="Điểm danh, kết quả và dữ liệu buổi học hiện ở trạng thái chỉ đọc theo quy định hiện có."
            title="Buổi học đã được khóa và không thể hoàn tác."
            tone="success"
          />

          <div className="grid gap-3 rounded-md border border-border-subtle bg-surface-raised p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-label font-semibold text-text-strong">
                Thông tin khóa
              </p>
              <p className="text-caption text-text-muted">
                Trạng thái buổi học: {formatSessionStatus(sessionStatus)}
              </p>
            </div>

            <div className="grid gap-1 text-body">
              <p className="text-text-muted">Thời điểm khóa</p>
              <p className="font-medium text-text-strong">
                {formatLockedAt(lockedAt)}
              </p>
            </div>

            <div className="grid gap-1 text-body">
              <p className="text-text-muted">Lý do khóa</p>
              <p className="text-text-strong">
                {lockReason ?? "Không có nội dung lý do."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLockable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Khóa dữ liệu buổi học</CardTitle>
        </CardHeader>

        <CardContent>
          <ResultBanner
            description="Hệ thống sẽ chỉ cho phép khóa khi trạng thái buổi học đáp ứng điều kiện hiện có."
            title="Chỉ buổi học đã hoàn thành mới có thể khóa dữ liệu."
            tone="warning"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Khóa dữ liệu buổi học</CardTitle>
        <Badge tone="warning">Không thể hoàn tác</Badge>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-3 rounded-md border border-danger-border bg-danger-bg p-4">
          <div className="flex items-start gap-3">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-danger"
              size={20}
              strokeWidth={1.8}
            />
            <div className="grid gap-1.5">
              <p className="text-label font-semibold text-text-strong">
                Khóa buổi học là thao tác không thể hoàn tác.
              </p>
              <p className="text-body text-text-muted">
                Sau khi khóa, điểm danh và kết quả được chuyển sang trạng thái chỉ đọc theo quy định hiện có.
              </p>
            </div>
          </div>
        </div>

        <ResultBanner
          description="Hãy hoàn tất điểm danh theo yêu cầu trước khi khóa. Kết quả và điểm kiểm tra không phải là điều kiện khóa."
          title="Hệ thống sẽ kiểm tra điều kiện khóa khi xác nhận."
          tone="info"
        />

        {actionState?.status === "success" ? (
          <div ref={feedbackRef} tabIndex={-1}>
            <ResultBanner title={actionState.message} tone="success" />
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            aria-haspopup="dialog"
            onClick={openConfirmation}
            ref={confirmationTriggerRef}
            size="lg"
            variant="danger"
          >
            Khóa buổi học
          </Button>
        </div>
      </CardContent>

      <Dialog
        ariaDescribedBy={dialogDescriptionId}
        ariaLabelledBy={dialogTitleId}
        className="max-w-lg"
        initialFocusRef={reasonInputRef}
        isOpen={isOpen}
        onClose={closeConfirmation}
        returnFocusRef={confirmationTriggerRef}
      >
        <div className="grid gap-5 p-5 sm:p-6">
          <div className="grid gap-2">
            <div className="flex items-start gap-3">
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-danger"
                size={20}
                strokeWidth={1.8}
              />
              <div>
                <h3
                  className="text-section-title font-semibold text-text-strong"
                  id={dialogTitleId}
                >
                  Xác nhận khóa vĩnh viễn
                </h3>
                <p
                  className="mt-1 text-body text-text-muted"
                  id={dialogDescriptionId}
                >
                  Sau khi khóa, điểm danh, kết quả và dữ liệu buổi học không thể chỉnh sửa hoặc mở khóa trở lại.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label
              className="text-label font-semibold text-text-strong"
              htmlFor={reasonInputId}
            >
              Lý do khóa <span className="text-danger">*</span>
            </label>
            <textarea
              aria-describedby={
                reasonError
                  ? `${reasonHelpId} ${reasonErrorId}`
                  : reasonHelpId
              }
              aria-invalid={reasonError ? true : undefined}
              className="min-h-28 rounded-md border border-border-subtle bg-field-bg px-3 py-2 text-body font-normal text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled"
              disabled={isInteractionLocked}
              id={reasonInputId}
              maxLength={500}
              onChange={(event) => {
                setReason(event.target.value);
                setActionState(null);
              }}
              placeholder="Ví dụ: Đã hoàn tất đối soát điểm danh và kết quả cuối buổi..."
              ref={reasonInputRef}
              value={reason}
            />
            <p className="text-caption text-text-muted" id={reasonHelpId}>
              {reason.trim().length}/500 ký tự
            </p>
            {reasonError ? (
              <p className="text-caption font-medium text-danger" id={reasonErrorId}>
                {reasonError}
              </p>
            ) : null}
          </div>

          {actionState?.status === "error" ? (
            <ResultBanner title={actionState.message} tone="error" />
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={isInteractionLocked}
              onClick={closeConfirmation}
              type="button"
              variant="ghost"
            >
              Quay lại
            </Button>
            <Button
              disabled={isInteractionLocked || reason.trim().length < 3}
              isLoading={isInteractionLocked}
              onClick={submitLock}
              size="lg"
              type="button"
              variant="danger"
            >
              {isInteractionLocked ? "Đang khóa..." : "Xác nhận khóa"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

function formatLockedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSessionStatus(status: SessionStatus): string {
  const labels: Record<SessionStatus, string> = {
    cancelled: "Đã hủy",
    completed: "Đã hoàn thành",
    in_progress: "Đang diễn ra",
    scheduled: "Đã lên lịch",
  };

  return labels[status];
}
