"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { TimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { initialTimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { retireWorkShiftAction } from "@/features/timekeeping/timekeeping-actions";
import { formInputClassName } from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingWorkShift } from "@/features/timekeeping/types";

interface WorkShiftRetireActionProps {
  workShift: TimekeepingWorkShift;
}

export function WorkShiftRetireAction({ workShift }: WorkShiftRetireActionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<TimekeepingManagementActionState>(
    initialTimekeepingManagementActionState,
  );

  const openDialog = (): void => {
    setReason("");
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
      const result = await retireWorkShiftAction({
        reason,
        workShiftId: workShift.id,
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
      <Button className="w-full" onClick={openDialog} size="lg" type="button" variant="ghost">
        Ngừng dùng
      </Button>

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
              <h2 className="text-lg font-semibold text-ink">Ngừng dùng ca làm</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Ca <span className="font-semibold text-ink">{workShift.code}</span> sẽ không còn được
                phân công mới. Lịch sử hiện có vẫn được giữ nguyên.
              </p>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Lý do ngừng dùng</span>
              <textarea
                autoFocus
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Nhập lý do ngừng dùng ca"
                required
                value={reason}
              />
              {actionState.fieldErrors?.reason?.[0] ? (
                <span className="text-xs font-medium text-red-600">
                  {actionState.fieldErrors.reason[0]}
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
              <Button disabled={isPending} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending || reason.trim().length === 0} size="lg" type="submit">
                {isPending ? "Đang ngừng dùng..." : "Xác nhận ngừng dùng"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
