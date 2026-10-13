"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import {
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

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-surface-base px-3 text-sm font-normal text-ink outline-none transition focus:border-action-primary focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

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
        setSelectedOperation(null);
        setReason("");
        setSuccessMessage(result.message || "Đã đổi trạng thái lớp.");
        router.refresh();
      }
    });
  };

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

          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Lý do đổi trạng thái</span>

            <textarea
              autoFocus
              className={`${inputClassName} min-h-28 resize-y py-3`}
              disabled={isPending}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nhập lý do thực hiện"
              required
              value={reason}
            />

            {actionState.fieldErrors?.reason?.[0] ? (
              <span className="text-xs font-medium text-danger">{actionState.fieldErrors.reason[0]}</span>
            ) : null}
          </label>

          {actionState.status === "error" && actionState.message ? (
            <div aria-live="polite" className="rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger">
              {actionState.message}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={isPending} onClick={closeDialog} type="button" variant="ghost">
              Hủy
            </Button>

            <Button
              disabled={isPending || reason.trim().length === 0}
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
