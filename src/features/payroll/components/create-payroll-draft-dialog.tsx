"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PayrollActionMessage } from "@/features/payroll/components/payroll-action-message";
import { PayrollModal } from "@/features/payroll/components/payroll-modal";
import { createPayrollDraftAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";

function getPreviousMonthValue(): string {
  const currentDate = new Date();
  currentDate.setMonth(currentDate.getMonth() - 1);
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
}

export function CreatePayrollDraftDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [periodMonth, setPeriodMonth] = useState(getPreviousMonthValue);
  const [actionState, setActionState] = useState<PayrollActionState | null>(null);

  const openDialog = (): void => {
    setPeriodMonth(getPreviousMonthValue());
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
      const result = await createPayrollDraftAction({
        periodMonth: `${periodMonth}-01`,
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
        Lập bảng lương
      </Button>

      {isOpen ? (
        <PayrollModal
          description="Chỉ có thể lập kỳ lương cho tháng đã kết thúc. Mỗi lượt chấm công đã kết thúc được tính là 1 công, tương đương 9 giờ."
          title="Lập bảng lương tháng"
        >
          <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              Kỳ lương
              <input
                className={formInputClassName}
                disabled={isPending}
                onChange={(event) => setPeriodMonth(event.target.value)}
                required
                type="month"
                value={periodMonth}
              />
              {actionState?.fieldErrors?.periodMonth?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {actionState.fieldErrors.periodMonth[0]}
                </span>
              ) : null}
            </label>

            <PayrollActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending} size="lg" type="submit">
                {isPending ? "Đang lập..." : "Lập bảng lương"}
              </Button>
            </div>
          </form>
        </PayrollModal>
      ) : null}
    </>
  );
}
