"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode, RefObject } from "react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { changeClassStatusAction } from "@/features/classes/actions/class-actions";
import type {
  ClassManagementActionState,
  ClassTargetStatus,
} from "@/features/classes/forms/class-action-types";
import { initialClassManagementActionState } from "@/features/classes/forms/class-action-types";
import { textAreaControlClass } from "@/features/students/form/components/form-controls";
import type {
  ClassDetailReadModel,
} from "@/features/classes/read-models";

interface ClassStatusOperationsOptions {
  classCode: string;
  classId: string;
  className: string;
  status: ClassDetailReadModel["status"];
  /**
   * Scheduled sessions that change_class_status cancels when the class closes;
   * `null` when the viewer cannot read sessions.
   */
  scheduledSessionCount?: number | null;
  /**
   * Focusable (tabIndex -1) wrapper of the page's success banner. Focus moves there
   * when the new status leaves no operations, since the "…" trigger then unmounts.
   */
  successFocusRef?: RefObject<HTMLElement | null>;
}

export interface ClassStatusOperation {
  /** What happens, in the owner's words; shown in the danger-soft consequence box. */
  consequence: string;
  /** Preconditions the database checks; shown under the consequence. */
  conditions: string | null;
  danger: boolean;
  label: string;
  submitLabel: string;
  targetStatus: ClassTargetStatus;
}

/** Transitions change_class_status allows from each status; unknown statuses get none. */
export function getClassStatusOperations(
  status: ClassDetailReadModel["status"],
  scheduledSessionCount: number | null = null,
): ClassStatusOperation[] {
  if (status === "draft") {
    return [
      {
        conditions: "Năm học của lớp phải đang hoạt động.",
        consequence: "Lớp chuyển sang Đang hoạt động: có thể ghi danh học sinh và xếp lịch.",
        danger: false,
        label: "Kích hoạt lớp",
        submitLabel: "Xác nhận kích hoạt",
        targetStatus: "active",
      },
      {
        conditions: null,
        consequence: "Lớp nháp được lưu trữ và không thể chỉnh sửa hoặc kích hoạt lại.",
        danger: true,
        label: "Lưu trữ lớp",
        submitLabel: "Xác nhận lưu trữ",
        targetStatus: "archived",
      },
    ];
  }

  if (status === "active") {
    return [
      {
        conditions:
          "Chỉ đóng được khi lớp không còn lịch học đang hiệu lực, không còn học sinh đang học và không có buổi đang diễn ra.",
        consequence:
          scheduledSessionCount && scheduledSessionCount > 0
            ? `Lớp ngừng hoạt động. ${scheduledSessionCount} buổi đã lên lịch còn lại sẽ bị hủy tự động.`
            : "Lớp ngừng hoạt động. Mọi buổi đã lên lịch còn lại sẽ bị hủy tự động.",
        danger: true,
        label: "Đóng lớp",
        submitLabel: "Xác nhận đóng lớp",
        targetStatus: "closed",
      },
    ];
  }

  if (status === "closed") {
    return [
      {
        conditions: "Database tiếp tục kiểm tra lịch học và học sinh đang hoạt động.",
        consequence: "Lớp đã đóng được lưu trữ và không thể mở lại.",
        danger: true,
        label: "Lưu trữ lớp",
        submitLabel: "Xác nhận lưu trữ",
        targetStatus: "archived",
      },
    ];
  }

  return [];
}

const dialogTitles: Record<ClassTargetStatus, string> = {
  active: "Kích hoạt lớp học",
  archived: "Lưu trữ lớp học",
  closed: "Đóng lớp học",
};

/**
 * Class status changes for the "…" menu (design 03): the hook owns one shared
 * consequence dialog with a required reason; the page decides where items go.
 */
export function useClassStatusOperations({
  classCode,
  classId,
  className,
  scheduledSessionCount = null,
  status,
  successFocusRef,
}: ClassStatusOperationsOptions): {
  dialog: ReactNode;
  open: (targetStatus: ClassTargetStatus, trigger: HTMLElement) => void;
  operations: ClassStatusOperation[];
  successMessage: string | null;
} {
  const router = useRouter();
  const operations = getClassStatusOperations(status, scheduledSessionCount);
  const [selectedOperation, setSelectedOperation] = useState<ClassStatusOperation | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<ClassManagementActionState>(initialClassManagementActionState);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  /** Set when the new status has no further operations: the "…" trigger is about to unmount. */
  const focusSuccessRef = useRef(false);

  // Runs after the dialog's own cleanup returned focus to the trigger, so it wins.
  useEffect(() => {
    if (successMessage && focusSuccessRef.current) {
      focusSuccessRef.current = false;
      successFocusRef?.current?.focus();
    }
  }, [successFocusRef, successMessage]);

  const closeDialog = (): void => {
    if (isPending) {
      return;
    }

    setSelectedOperation(null);
    setReason("");
    setActionState(initialClassManagementActionState);
  };

  const open = (targetStatus: ClassTargetStatus, trigger: HTMLElement): void => {
    const operation = operations.find((item) => item.targetStatus === targetStatus);

    if (!operation) {
      return;
    }

    triggerRef.current = trigger;
    setSelectedOperation(operation);
    setReason("");
    setActionState(initialClassManagementActionState);
    setSuccessMessage(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!selectedOperation) {
      return;
    }

    startTransition(async () => {
      const result = await changeClassStatusAction({
        classId,
        reason,
        targetStatus: selectedOperation.targetStatus,
      });

      setActionState(result);

      if (result.status === "success") {
        focusSuccessRef.current = getClassStatusOperations(selectedOperation.targetStatus).length === 0;
        setSelectedOperation(null);
        setReason("");
        setSuccessMessage(result.message || "Đã đổi trạng thái lớp.");
        router.refresh();
      }
    });
  };

  const reasonError = actionState.fieldErrors?.reason?.[0];

  const dialog = (
    <Dialog
      ariaDescribedBy="class-status-action-description"
      ariaLabelledBy="class-status-action-title"
      className="max-w-lg p-5"
      isOpen={selectedOperation !== null}
      onClose={closeDialog}
      returnFocusRef={triggerRef}
    >
      {selectedOperation ? (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id="class-status-action-title">
              {dialogTitles[selectedOperation.targetStatus]}
            </h2>

            <p className="mt-1 text-sm font-medium text-ink">
              {classCode}
              {" — "}
              {className}
            </p>

            <div className="mt-3 grid gap-1.5" id="class-status-action-description">
              <p
                className={
                  selectedOperation.danger
                    ? "rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-secondary font-semibold text-danger-ink"
                    : "rounded-md border border-border-subtle bg-surface-subtle px-3 py-2.5 text-secondary font-semibold text-text-strong"
                }
              >
                {selectedOperation.consequence}
              </p>
              {selectedOperation.conditions ? (
                <p className="text-secondary text-text-muted">{selectedOperation.conditions}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-semibold text-ink-muted" htmlFor="class-status-action-reason">
              Lý do đổi trạng thái<span className="ml-1 text-danger">*</span>
            </label>

            <textarea
              aria-describedby={reasonError ? "class-status-action-reason-error" : undefined}
              aria-invalid={reasonError ? true : undefined}
              autoFocus
              className={textAreaControlClass(reasonError, "min-h-28 resize-y")}
              disabled={isPending}
              id="class-status-action-reason"
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nhập lý do thực hiện"
              required
              value={reason}
            />

            {reasonError ? (
              <p className="text-xs font-semibold leading-5 text-danger" id="class-status-action-reason-error">
                {reasonError}
              </p>
            ) : null}
          </div>

          {actionState.status === "error" && actionState.message ? (
            <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-secondary font-semibold text-danger-ink" role="alert">
              {actionState.message}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={isPending} onClick={closeDialog} type="button" variant="ghost">
              Hủy
            </Button>

            <Button
              disabled={isPending || reason.trim().length === 0}
              disabledReason={isPending ? undefined : reason.trim().length === 0 ? "Nhập lý do đổi trạng thái" : undefined}
              type="submit"
              variant={selectedOperation.danger ? "danger-solid" : "primary"}
            >
              {isPending ? "Đang xử lý..." : selectedOperation.submitLabel}
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );

  return { dialog, open, operations, successMessage };
}
