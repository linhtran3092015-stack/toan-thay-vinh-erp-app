"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { requestSalaryAdvanceAction } from "@/features/advances/actions/advance-actions";
import { AdvanceActionMessage } from "@/features/advances/components/advance-action-message";
import { AdvanceModal } from "@/features/advances/components/advance-modal";
import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";

function getCurrentMonthValue(): string {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
}

export function RequestSalaryAdvanceDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amountVnd, setAmountVnd] = useState("");
  const [deductionMonth, setDeductionMonth] = useState(getCurrentMonthValue);
  const [requestNote, setRequestNote] = useState("");
  const [actionState, setActionState] = useState<AdvanceActionState | null>(null);

  const openDialog = (): void => {
    setAmountVnd("");
    setDeductionMonth(getCurrentMonthValue());
    setRequestNote("");
    setActionState(null);
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
      const result = await requestSalaryAdvanceAction({
        amountVnd: Number(amountVnd),
        deductionPeriodMonth: `${deductionMonth}-01`,
        requestNote,
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
      <Button onClick={openDialog} size="lg" type="button">
        Yêu cầu tạm ứng
      </Button>

      {isOpen ? (
        <AdvanceModal
          description="Khoản được duyệt sẽ bị khấu trừ một lần khi lập bảng lương của kỳ đã chọn."
          title="Yêu cầu tạm ứng lương"
        >
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              Số tiền (VND)
              <input
                className={formInputClassName}
                disabled={isPending}
                inputMode="numeric"
                min="1"
                onChange={(event) => setAmountVnd(event.target.value)}
                required
                step="1"
                type="number"
                value={amountVnd}
              />
              {actionState?.fieldErrors?.amountVnd?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {actionState.fieldErrors.amountVnd[0]}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              Kỳ khấu trừ
              <input
                className={formInputClassName}
                disabled={isPending}
                onChange={(event) => setDeductionMonth(event.target.value)}
                required
                type="month"
                value={deductionMonth}
              />
              {actionState?.fieldErrors?.deductionPeriodMonth?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {actionState.fieldErrors.deductionPeriodMonth[0]}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              Lý do tạm ứng
              <textarea
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) => setRequestNote(event.target.value)}
                required
                value={requestNote}
              />
              {actionState?.fieldErrors?.requestNote?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {actionState.fieldErrors.requestNote[0]}
                </span>
              ) : null}
            </label>

            <AdvanceActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending} size="lg" type="submit">
                {isPending ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </AdvanceModal>
      ) : null}
    </>
  );
}
