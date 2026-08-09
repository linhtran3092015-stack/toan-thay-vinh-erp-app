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
import { endClassScheduleAction } from "@/features/classes/actions/class-schedule-actions";
import type { ClassManagementActionState } from "@/features/classes/forms/class-action-types";
import { initialClassManagementActionState } from "@/features/classes/forms/class-action-types";
import type { ClassScheduleReadModel } from "@/features/classes/read-models";

interface ClassScheduleEndActionProps {
  schedule: ClassScheduleReadModel;
}

interface EndScheduleFormValues {
  effectiveTo: string;
  reason: string;
}

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-surface-base px-3 text-sm font-normal text-ink outline-none transition focus:border-action-primary focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function getVietnamBusinessDate(): string {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
    },
  ).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;

  const month = parts.find(
    (part) => part.type === "month",
  )?.value;

  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Không xác định được ngày hiện tại theo giờ Việt Nam.",
    );
  }

  return `${year}-${month}-${day}`;
}

function createInitialValues(): EndScheduleFormValues {
  return {
    effectiveTo:
      getVietnamBusinessDate(),
    reason: "",
  };
}

export function ClassScheduleEndAction({
  schedule,
}: ClassScheduleEndActionProps) {
  const router = useRouter();

  const businessDate =
    getVietnamBusinessDate();

  const canEndToday =
    schedule.effectiveFrom <= businessDate;

  const [isOpen, setIsOpen] =
    useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [isPending, startTransition] =
    useTransition();

  const [values, setValues] =
    useState<EndScheduleFormValues>(
      createInitialValues,
    );

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialClassManagementActionState,
    );

  const openDialog = (): void => {
    if (!canEndToday) {
      return;
    }

    setValues(createInitialValues());

    setActionState(
      initialClassManagementActionState,
    );

    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isPending) {
      return;
    }

    setIsOpen(false);

    setActionState(
      initialClassManagementActionState,
    );
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    startTransition(async () => {
      const result =
        await endClassScheduleAction({
          effectiveTo:
            values.effectiveTo,
          reason: values.reason,
          scheduleTemplateId:
            schedule.id,
        });

      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        className="w-full"
        disabled={!canEndToday}
        onClick={openDialog}
        ref={triggerRef}
        type="button"
        variant="ghost"
      >
        {canEndToday
          ? "Kết thúc lịch"
          : "Chưa thể kết thúc"}
      </Button>

      {!canEndToday ? (
        <p className="text-xs text-warning">
          Lịch chưa đến ngày bắt đầu nên chưa
          thể kết thúc.
        </p>
      ) : null}

      <Dialog ariaDescribedBy="end-schedule-description" ariaLabelledBy="end-schedule-title" className="max-w-lg p-5" isOpen={isOpen} onClose={closeDialog} returnFocusRef={triggerRef}>
        {isOpen ? (
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-section-title font-semibold text-text-strong" id="end-schedule-title">
                Kết thúc lịch học
              </h2>

              <p className="mt-1 text-secondary text-text-muted" id="end-schedule-description">
                Lịch sẽ ngừng hiệu lực và được
                giữ nguyên trong lịch sử. Thao
                tác này không tạo lịch thay thế.
              </p>

              {schedule.componentCode ? (
                <p className="mt-2 text-sm font-semibold text-ink">
                  Mã thành phần:{" "}
                  {schedule.componentCode}
                </p>
              ) : null}
            </div>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Ngày kết thúc hiệu lực</span>

              <input
                className={inputClassName}
                disabled={isPending}
                max={businessDate}
                min={schedule.effectiveFrom}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    effectiveTo:
                      event.target.value,
                  }))
                }
                required
                type="date"
                value={values.effectiveTo}
              />

              {actionState.fieldErrors
                ?.effectiveTo?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {
                    actionState.fieldErrors
                      .effectiveTo[0]
                  }
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Lý do kết thúc</span>

              <textarea
                autoFocus
                className={`${inputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    reason:
                      event.target.value,
                  }))
                }
                placeholder="Nhập lý do kết thúc lịch học"
                required
                value={values.reason}
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
                  values.reason.trim().length ===
                    0
                }
                type="submit"
              >
                {isPending
                  ? "Đang kết thúc..."
                  : "Xác nhận kết thúc"}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
