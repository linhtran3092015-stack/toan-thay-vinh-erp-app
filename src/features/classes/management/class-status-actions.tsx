"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
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

interface ClassStatusActionsProps {
  classCode: string;
  classId: string;
  className: string;
  status: ClassDetailReadModel["status"];
}

interface StatusOperationMeta {
  description: string;
  label: string;
  submitLabel: string;
  targetStatus: ClassTargetStatus;
}

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-surface-base px-3 text-sm font-normal text-ink outline-none transition focus:border-action-primary focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function getAvailableOperations(
  status: ClassDetailReadModel["status"],
): StatusOperationMeta[] {
  if (status === "draft") {
    return [
      {
        description:
          "Lớp sẽ chuyển sang trạng thái hoạt động. Năm học của lớp phải đang hoạt động.",
        label: "Kích hoạt",
        submitLabel: "Xác nhận kích hoạt",
        targetStatus: "active",
      },
      {
        description:
          "Lớp nháp sẽ được lưu trữ và không thể chỉnh sửa hoặc kích hoạt lại.",
        label: "Lưu trữ",
        submitLabel: "Xác nhận lưu trữ",
        targetStatus: "archived",
      },
    ];
  }

  if (status === "active") {
    return [
      {
        description:
          "Database chỉ cho đóng lớp khi không còn lịch học đang hiệu lực và không còn học viên đang học.",
        label: "Đóng lớp",
        submitLabel: "Xác nhận đóng lớp",
        targetStatus: "closed",
      },
    ];
  }

  if (status === "closed") {
    return [
      {
        description:
          "Lớp đã đóng sẽ được lưu trữ. Database tiếp tục kiểm tra lịch học và học viên đang hoạt động.",
        label: "Lưu trữ",
        submitLabel: "Xác nhận lưu trữ",
        targetStatus: "archived",
      },
    ];
  }

  return [];
}

function getDialogTitle(
  targetStatus: ClassTargetStatus,
): string {
  const titles: Record<
    ClassTargetStatus,
    string
  > = {
    active: "Kích hoạt lớp học",
    archived: "Lưu trữ lớp học",
    closed: "Đóng lớp học",
  };

  return titles[targetStatus];
}

export function ClassStatusActions({
  classCode,
  classId,
  className,
  status,
}: ClassStatusActionsProps) {
  const router = useRouter();

  const operations =
    getAvailableOperations(status);

  const [selectedOperation, setSelectedOperation] =
    useState<StatusOperationMeta | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [reason, setReason] = useState("");

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialClassManagementActionState,
    );

  const [isPending, startTransition] =
    useTransition();

  const closeDialog = (): void => {
    if (isPending) {
      return;
    }

    setSelectedOperation(null);
    setReason("");
    setActionState(
      initialClassManagementActionState,
    );
  };

  const openDialog = (
    operation: StatusOperationMeta,
  ): void => {
    setSelectedOperation(operation);
    setReason("");
    setActionState(
      initialClassManagementActionState,
    );
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    if (!selectedOperation) {
      return;
    }

    startTransition(async () => {
      const result =
        await changeClassStatusAction({
          classId,
          reason,
          targetStatus:
            selectedOperation.targetStatus,
        });

      setActionState(result);

      if (result.status === "success") {
        setSelectedOperation(null);
        setReason("");
        router.refresh();
      }
    });
  };

  if (operations.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {operations.map((operation) => (
          <Button
            key={operation.targetStatus}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              openDialog(operation);
            }}
            type="button"
            variant={
              operation.targetStatus ===
              "active"
                ? "secondary"
                : "ghost"
            }
          >
            {operation.label}
          </Button>
        ))}
      </div>

      <Dialog
        ariaDescribedBy="class-status-action-description"
        ariaLabelledBy="class-status-action-title"
        className="max-w-lg p-5"
        isOpen={selectedOperation !== null}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        {selectedOperation ? (
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-section-title font-semibold text-text-strong" id="class-status-action-title">
                {getDialogTitle(
                  selectedOperation.targetStatus,
                )}
              </h2>

              <p className="mt-1 text-sm font-medium text-ink">
                {classCode}
                {" — "}
                {className}
              </p>

              <p className="mt-3 text-secondary text-text-muted" id="class-status-action-description">
                {selectedOperation.description}
              </p>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Lý do đổi trạng thái</span>

              <textarea
                autoFocus
                className={`${inputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                placeholder="Nhập lý do thực hiện"
                required
                value={reason}
              />

              {actionState.fieldErrors
                ?.reason?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {
                    actionState.fieldErrors
                      .reason[0]
                  }
                </span>
              ) : null}
            </label>

            {actionState.message ? (
              <div
                aria-live="polite"
                className={
                  actionState.status === "error"
                    ? "rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger"
                    : "rounded-md border border-success-border bg-success-bg p-3 text-sm text-success"
                }
              >
                {actionState.message}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                disabled={isPending}
                onClick={closeDialog}
                type="button"
                variant="ghost"
              >
                Hủy
              </Button>

              <Button
                disabled={
                  isPending ||
                  reason.trim().length === 0
                }
                type="submit"
              >
                {isPending
                  ? "Đang xử lý..."
                  : selectedOperation.submitLabel}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
