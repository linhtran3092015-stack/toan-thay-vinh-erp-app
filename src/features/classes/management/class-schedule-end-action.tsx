"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import {
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
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
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";

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
        type="button"
        variant="ghost"
      >
        {canEndToday
          ? "Kết thúc lịch"
          : "Chưa thể kết thúc"}
      </Button>

      {!canEndToday ? (
        <p className="text-xs text-amber-700">
          Lịch chưa đến ngày bắt đầu nên chưa
          thể kết thúc.
        </p>
      ) : null}

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="w-full max-w-lg space-y-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Kết thúc lịch học
              </h2>

              <p className="mt-1 text-sm text-ink-muted">
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
                <span className="text-xs font-medium text-red-600">
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
                <span className="text-xs font-medium text-red-600">
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
                    ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
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
        </div>
      ) : null}
    </>
  );
}
