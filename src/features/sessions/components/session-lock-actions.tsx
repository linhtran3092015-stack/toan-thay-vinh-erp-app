"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { GuardedActionPanel, type GuardedCondition } from "@/components/patterns/guarded-action-panel";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { ResultBanner } from "@/components/shared/result-banner";
import { lockSessionAction } from "@/features/sessions/actions/session-result-actions";
import type { SessionLockActionState } from "@/features/sessions/forms/result-action-types";
import type { SessionStatus } from "@/features/sessions/read-models";

interface SessionLockActionsProps {
  /** Roster students marked only additional_study (already masked by the caller); named in the checklist. */
  additionalStudyRosterNames?: string[];
  /** Shows the "Hoàn buổi" path after lock (permission session_ledger.reverse). */
  canReverseLedger?: boolean;
  /** Shows the payroll correction path after lock (permission payroll.view). */
  canViewPayroll?: boolean;
  lockedAt: string | null;
  lockReason: string | null;
  /** Roster students with a lock-counted status (present or either absence); with `rosterCount` it drives the checklist. */
  markedCount?: number;
  /** Everyone on the page, walk-ins included; with `rosterCount === 0` the roster is known empty (walk-ins only, or nobody) and lock is blocked. */
  participantCount?: number;
  rosterCount?: number;
  sessionId: string;
  sessionStatus: SessionStatus;
}

/**
 * Lock panel (design 04/4b). Lock is permanent: there is no unlock. The server
 * remains the authority on lock conditions; the checklist only previews what is
 * known client-side. Results are not a lock condition in this system.
 */
export function SessionLockActions({
  additionalStudyRosterNames = [],
  canReverseLedger = false,
  canViewPayroll = false,
  lockedAt,
  lockReason,
  markedCount,
  participantCount,
  rosterCount,
  sessionId,
  sessionStatus,
}: SessionLockActionsProps) {
  const router = useRouter();
  const confirmationTriggerRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);
  const dialogDescriptionId = useId();
  const dialogTitleId = useId();
  const panelTitleId = useId();
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

  const isCompleted = sessionStatus === "completed";
  const isLockable = isCompleted && lockedAt === null;
  // The lock RPC raises SESSION_HAS_NO_ELIGIBLE_ROSTER whenever the roster is empty: walk-ins only, or nobody at all.
  const hasNoRoster = rosterCount === 0 && participantCount !== undefined;
  const hasWalkInsOnly = hasNoRoster && participantCount > 0;
  const attendanceKnown = markedCount !== undefined && rosterCount !== undefined && rosterCount > 0;
  const attendanceComplete = attendanceKnown ? markedCount >= rosterCount : undefined;
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
      <GuardedActionPanel
        badge={<Badge tone="neutral">Đã khóa</Badge>}
        consequence={
          <>
            Khóa lúc <strong>{formatLockedAt(lockedAt)}</strong>. Điểm danh, kết quả và dữ liệu buổi học ở trạng thái chỉ đọc; buổi không mở lại được.
          </>
        }
        icon={<LockKeyhole aria-hidden="true" strokeWidth={1.8} />}
        result={
          <div className="grid gap-3">
            <dl className="grid gap-1 text-body">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-text-muted">Lý do</dt>
                <dd className="text-text-strong">{lockReason ?? "Không có nội dung lý do."}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-text-muted">Trạng thái</dt>
                <dd className="text-text-strong">Trạng thái buổi học: {formatSessionStatus(sessionStatus)}</dd>
              </div>
            </dl>
            <div className="rounded-md border border-border-subtle bg-surface-sunken p-3 text-body text-text-default">
              <p className="font-semibold text-text-strong">Phát hiện sai sót sau khi khóa?</p>
              <p className="mt-1">
                Buổi không mở lại được. Sai sót đi qua yêu cầu điều chỉnh có duyệt và nhật ký: hoàn buổi cho một lượt điểm danh trong sổ buổi học, hoặc yêu cầu điều chỉnh lương trên phiếu lương. Dữ liệu gốc của buổi giữ nguyên.
              </p>
              {canReverseLedger || canViewPayroll ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canReverseLedger ? (
                    <Link className={getButtonClassName({ size: "sm", variant: "secondary" })} href="/finance/session-ledger">
                      Hoàn buổi cho một học sinh…
                    </Link>
                  ) : null}
                  {canViewPayroll ? (
                    <Link className={getButtonClassName({ size: "sm", variant: "secondary" })} href="/payroll">
                      Yêu cầu điều chỉnh lương
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-secondary text-text-muted">
                  Gửi yêu cầu điều chỉnh kèm lý do cho quản lý vận hành; quản lý sẽ duyệt trên sổ buổi học hoặc bảng lương.
                </p>
              )}
            </div>
          </div>
        }
        title="Buổi đã khóa vĩnh viễn"
        titleId={panelTitleId}
      />
    );
  }

  const attendanceCondition: GuardedCondition = hasNoRoster
    ? {
        label: hasWalkInsOnly
          ? "Buổi không có học sinh trong roster — chỉ có học sinh học thêm nên chưa thể khóa"
          : "Buổi không có học sinh trong roster nên chưa thể khóa.",
        state: "unmet",
      }
    : attendanceKnown
      ? {
          label: attendanceComplete ? (
            `Điểm danh đủ ${markedCount}/${rosterCount} học sinh`
          ) : (
            <>
              Điểm danh đủ roster (có mặt hoặc vắng) — <strong>thiếu {rosterCount - markedCount}/{rosterCount}</strong>
              {additionalStudyRosterNames.length > 0
                ? `. ${formatNames(additionalStudyRosterNames)} đang là Học thêm — đổi sang Có mặt hoặc Vắng để khóa`
                : null}
            </>
          ),
          state: attendanceComplete ? "met" : "unmet",
        }
      : {
          label: "Điểm danh đủ roster của buổi học (hệ thống kiểm tra khi xác nhận)",
          state: "unknown",
        };

  const conditions: GuardedCondition[] = [
    {
      label: isCompleted ? "Buổi đã kết thúc" : "Buổi chưa kết thúc — cần hoàn thành buổi trước khi khóa",
      state: isCompleted ? "met" : "unmet",
    },
    attendanceCondition,
  ];

  if (!isLockable) {
    return (
      <GuardedActionPanel
        badge={<Badge tone="neutral">Chưa thể khóa</Badge>}
        conditions={conditions}
        consequence={
          <>
            Khi khóa, điểm danh và kết quả của buổi này <strong>không thể sửa</strong>. Khóa là vĩnh viễn, không thể mở lại.
          </>
        }
        icon={<LockKeyhole aria-hidden="true" strokeWidth={1.8} />}
        title="Khóa buổi học"
        titleId={panelTitleId}
      >
        <ResultBanner
          className="mt-4"
          description="Hệ thống sẽ chỉ cho phép khóa khi trạng thái buổi học đáp ứng điều kiện hiện có."
          title="Chỉ buổi học đã hoàn thành mới có thể khóa dữ liệu."
          tone="warning"
        />
      </GuardedActionPanel>
    );
  }

  const blockedByAttendance = attendanceComplete === false;
  const isBlocked = hasNoRoster || blockedByAttendance;

  return (
    <>
      <GuardedActionPanel
        action={
          <Button
            aria-haspopup="dialog"
            disabled={isBlocked}
            disabledReason={
              hasNoRoster
                ? "Buổi không có học sinh trong roster nên chưa thể khóa."
                : blockedByAttendance
                  ? "Bật khi tất cả điều kiện khóa đạt."
                  : undefined
            }
            onClick={openConfirmation}
            ref={confirmationTriggerRef}
          >
            <LockKeyhole aria-hidden="true" size={16} strokeWidth={2} />
            Khóa buổi học
          </Button>
        }
        badge={
          isBlocked ? (
            <Badge tone="neutral">Chưa thể khóa</Badge>
          ) : (
            <Badge tone="success">Đủ điều kiện</Badge>
          )
        }
        conditions={conditions}
        consequence={
          <>
            Khi khóa, điểm danh và kết quả của buổi này <strong>không thể sửa</strong>. Hệ thống trừ 1 buổi cho mỗi học sinh có mặt hoặc vắng (có phép, không phép) nếu là buổi chính khóa hoặc buổi bù, và ghi nhận công cho nhân sự. Khóa là vĩnh viễn, không thể mở lại; sai sót sau khóa chỉ sửa bằng yêu cầu điều chỉnh (số dư buổi / bảng lương) có duyệt và nhật ký.
          </>
        }
        emphasized={isOpen}
        icon={<LockKeyhole aria-hidden="true" strokeWidth={1.8} />}
        result={
          actionState?.status === "success" ? (
            <div ref={feedbackRef} tabIndex={-1}>
              <ResultBanner title={actionState.message} tone="success" />
            </div>
          ) : (
            <p className="text-secondary text-text-muted">
              {blockedByAttendance ? "Hãy hoàn tất điểm danh theo yêu cầu trước khi khóa. " : null}
              Kết quả và điểm kiểm tra không phải là điều kiện khóa.
            </p>
          )
        }
        title="Khóa buổi học"
        titleId={panelTitleId}
      />

      <Dialog
        ariaDescribedBy={dialogDescriptionId}
        ariaLabelledBy={dialogTitleId}
        className="max-w-[480px]"
        initialFocusRef={reasonInputRef}
        isOpen={isOpen}
        onClose={closeConfirmation}
        returnFocusRef={confirmationTriggerRef}
      >
        <div className="grid gap-4 p-5">
          <div>
            <h3
              className="text-section-title font-semibold text-text-strong"
              id={dialogTitleId}
            >
              Xác nhận khóa vĩnh viễn
            </h3>
            <div
              className="mt-3 rounded-md border border-danger-border bg-danger-bg p-3 text-body text-danger-ink"
              id={dialogDescriptionId}
            >
              <strong className="font-semibold">Hậu quả:</strong> điểm danh và kết quả bị đóng băng; mỗi học sinh có mặt hoặc vắng (có phép, không phép) bị trừ 1 buổi nếu là buổi chính khóa hoặc buổi bù; công của nhân sự được ghi vào kỳ lương. Không thể mở khóa trở lại.
            </div>
          </div>

          <div className="grid gap-1.5">
            <label
              className="text-label font-medium text-text-strong"
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
              className="min-h-24 rounded-md border border-border-strong bg-field-bg px-3 py-2 text-body font-normal text-text-strong outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--focus-ring)] disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled"
              disabled={isInteractionLocked}
              id={reasonInputId}
              maxLength={500}
              onChange={(event) => {
                setReason(event.target.value);
                setActionState(null);
              }}
              placeholder="Ví dụ: Đã đối soát điểm danh và kết quả cuối buổi..."
              ref={reasonInputRef}
              value={reason}
            />
            <p className="text-caption text-text-muted" id={reasonHelpId}>
              {reason.trim().length}/500 ký tự · tối thiểu 3 ký tự
            </p>
            {reasonError ? (
              <p className="text-caption font-medium text-danger" id={reasonErrorId}>
                {reasonError}
              </p>
            ) : null}
          </div>

          {actionState?.status === "error" ? (
            <ResultBanner
              action={
                <Button onClick={() => router.refresh()} size="sm" variant="secondary">
                  Tải lại dữ liệu
                </Button>
              }
              title={actionState.message}
              tone="error"
            />
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={isInteractionLocked}
              onClick={closeConfirmation}
              type="button"
              variant="secondary"
            >
              Quay lại
            </Button>
            <Button
              disabled={isInteractionLocked || reason.trim().length < 3}
              disabledReason={!isInteractionLocked && reason.trim().length < 3 ? "Cần lý do khóa từ 3 ký tự." : undefined}
              isLoading={isInteractionLocked}
              onClick={submitLock}
              type="button"
            >
              {isInteractionLocked ? "Đang khóa..." : "Xác nhận khóa"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
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
    timeZone: "Asia/Ho_Chi_Minh",
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

/** Names at most three students, then counts the rest. */
function formatNames(names: string[]): string {
  return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} và ${names.length - 3} học sinh khác`;
}
