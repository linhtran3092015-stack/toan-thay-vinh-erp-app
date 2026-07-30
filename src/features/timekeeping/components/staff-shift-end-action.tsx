"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type {
  EndStaffShiftAssignmentActionInput,
  TimekeepingManagementActionState,
} from "@/features/timekeeping/timekeeping-action-types";
import { initialTimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { endStaffShiftAssignmentAction } from "@/features/timekeeping/timekeeping-actions";
import {
  formInputClassName,
  getVietnamBusinessDate,
} from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingScheduleEntry } from "@/features/timekeeping/types";

interface StaffShiftEndActionProps {
  entry: TimekeepingScheduleEntry;
}

function createInitialValues(entry: TimekeepingScheduleEntry): EndStaffShiftAssignmentActionInput {
  return {
    effectiveTo: getVietnamBusinessDate(),
    reason: "",
    staffShiftAssignmentId: entry.assignmentId,
  };
}

export function StaffShiftEndAction({ entry }: StaffShiftEndActionProps) {
  const router = useRouter();
  const businessDate = getVietnamBusinessDate();
  const canEndToday = entry.effectiveFrom <= businessDate;
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<EndStaffShiftAssignmentActionInput>(() =>
    createInitialValues(entry),
  );
  const [actionState, setActionState] = useState<TimekeepingManagementActionState>(
    initialTimekeepingManagementActionState,
  );

  const openDialog = (): void => {
    if (!canEndToday) {
      return;
    }

    setValues(createInitialValues(entry));
    setActionState(initialTimekeepingManagementActionState);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (!isPending) {
      setIsOpen(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    startTransition(async () => {
      const result = await endStaffShiftAssignmentAction(values);
      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button className="w-full" disabled={!canEndToday} onClick={openDialog} size="lg" type="button" variant="ghost">
        Kết thúc lịch
      </Button>
      {!canEndToday ? (
        <p className="mt-2 text-xs text-amber-700">Lịch chưa đến ngày bắt đầu nên chưa thể kết thúc.</p>
      ) : null}

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="my-auto grid w-full max-w-lg gap-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">Kết thúc lịch phân công</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Lịch sẽ ngừng hiệu lực và được giữ nguyên trong lịch sử. Thao tác này không tạo lịch thay thế.
              </p>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Ngày kết thúc hiệu lực</span>
              <input
                className={formInputClassName}
                disabled={isPending}
                max={businessDate}
                min={entry.effectiveFrom}
                onChange={(event) =>
                  setValues((current) => ({ ...current, effectiveTo: event.target.value }))
                }
                required
                type="date"
                value={values.effectiveTo}
              />
              {actionState.fieldErrors?.effectiveTo?.[0] ? (
                <span className="text-xs font-medium text-red-600">
                  {actionState.fieldErrors.effectiveTo[0]}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Lý do kết thúc</span>
              <textarea
                autoFocus
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) =>
                  setValues((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="Nhập lý do kết thúc lịch"
                required
                value={values.reason}
              />
              {actionState.fieldErrors?.reason?.[0] ? (
                <span className="text-xs font-medium text-red-600">
                  {actionState.fieldErrors.reason[0]}
                </span>
              ) : null}
            </label>

            <ActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending || values.reason.trim().length === 0} size="lg" type="submit">
                {isPending ? "Đang kết thúc..." : "Xác nhận kết thúc"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function ActionMessage({
  actionState,
}: {
  actionState: TimekeepingManagementActionState;
}) {
  if (!actionState.message) {
    return null;
  }

  return (
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
  );
}
