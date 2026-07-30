"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type {
  ReplaceStaffShiftAssignmentActionInput,
  TimekeepingManagementActionState,
} from "@/features/timekeeping/timekeeping-action-types";
import { initialTimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { replaceStaffShiftAssignmentAction } from "@/features/timekeeping/timekeeping-actions";
import {
  formInputClassName,
  getVietnamBusinessDate,
} from "@/features/timekeeping/timekeeping-client-utils";
import type {
  TimekeepingScheduleEntry,
  TimekeepingWorkShift,
} from "@/features/timekeeping/types";

interface StaffShiftReplaceActionProps {
  entry: TimekeepingScheduleEntry;
  workShifts: readonly TimekeepingWorkShift[];
}

function createInitialValues(
  entry: TimekeepingScheduleEntry,
  workShifts: readonly TimekeepingWorkShift[],
): ReplaceStaffShiftAssignmentActionInput {
  return {
    effectiveFrom: getVietnamBusinessDate(),
    reason: "",
    staffShiftAssignmentId: entry.assignmentId,
    workShiftId: workShifts.find((shift) => shift.id !== entry.workShiftId)?.id ?? "",
  };
}

export function StaffShiftReplaceAction({ entry, workShifts }: StaffShiftReplaceActionProps) {
  const router = useRouter();
  const businessDate = getVietnamBusinessDate();
  const canReplaceToday = entry.effectiveFrom < businessDate;
  const replacementWorkShifts = workShifts.filter((shift) => shift.id !== entry.workShiftId);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<ReplaceStaffShiftAssignmentActionInput>(() =>
    createInitialValues(entry, replacementWorkShifts),
  );
  const [actionState, setActionState] = useState<TimekeepingManagementActionState>(
    initialTimekeepingManagementActionState,
  );

  const canReplace = canReplaceToday && replacementWorkShifts.length > 0;

  const openDialog = (): void => {
    if (!canReplace) {
      return;
    }

    setValues(createInitialValues(entry, replacementWorkShifts));
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
      const result = await replaceStaffShiftAssignmentAction(values);
      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button className="w-full" disabled={!canReplace} onClick={openDialog} size="lg" type="button" variant="outline">
        Thay ca
      </Button>
      {!canReplaceToday ? (
        <p className="mt-2 text-xs text-amber-700">Lịch bắt đầu hôm nay nên chưa thể thay ca.</p>
      ) : replacementWorkShifts.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700">Cần tạo thêm một ca khác trước khi thay lịch.</p>
      ) : null}

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="my-auto grid w-full max-w-xl gap-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">Thay ca trong lịch phân công</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Lịch cũ sẽ kết thúc vào hôm qua và được giữ nguyên trong lịch sử.
              </p>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Ca thay thế</span>
              <select
                className={formInputClassName}
                disabled={isPending}
                onChange={(event) =>
                  setValues((current) => ({ ...current, workShiftId: event.target.value }))
                }
                required
                value={values.workShiftId}
              >
                {replacementWorkShifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.code} - {shift.name} ({shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)})
                  </option>
                ))}
              </select>
              {actionState.fieldErrors?.workShiftId?.[0] ? (
                <span className="text-xs font-medium text-red-600">
                  {actionState.fieldErrors.workShiftId[0]}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Ngày bắt đầu hiệu lực</span>
              <input className={formInputClassName} disabled type="date" value={values.effectiveFrom} />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Lý do thay ca</span>
              <textarea
                autoFocus
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) =>
                  setValues((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="Nhập lý do thay ca"
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
              <Button disabled={isPending} size="lg" type="submit">
                {isPending ? "Đang thay ca..." : "Xác nhận thay ca"}
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
