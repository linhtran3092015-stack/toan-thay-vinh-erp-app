"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PayrollActionMessage } from "@/features/payroll/components/payroll-action-message";
import { PayrollModal } from "@/features/payroll/components/payroll-modal";
import { addPayrollManualLineAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";

type ManualLineType = "manual_deduction" | "manual_reward";

interface PayrollManualLineDialogProps {
  payrollStatementId: string;
  staffDisplayName: string;
}

export function PayrollManualLineDialog({
  payrollStatementId,
  staffDisplayName,
}: PayrollManualLineDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amountVnd, setAmountVnd] = useState("");
  const [lineType, setLineType] = useState<ManualLineType>("manual_reward");
  const [note, setNote] = useState("");
  const [actionState, setActionState] = useState<PayrollActionState | null>(null);

  const openDialog = (): void => {
    setAmountVnd("");
    setLineType("manual_reward");
    setNote("");
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
      const result = await addPayrollManualLineAction({
        amountVnd: Number(amountVnd),
        lineType,
        note,
        payrollStatementId,
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
      <Button onClick={openDialog} size="sm" type="button" variant="outline">
        Điều chỉnh
      </Button>

      {isOpen ? (
        <PayrollModal
          description={`Thêm thưởng hoặc khấu trừ thủ công cho ${staffDisplayName}. Khoản đã ghi không thể sửa trực tiếp.`}
          title="Điều chỉnh bảng lương"
        >
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              Loại điều chỉnh
              <select
                className={formInputClassName}
                disabled={isPending}
                onChange={(event) => setLineType(event.target.value as ManualLineType)}
                value={lineType}
              >
                <option value="manual_reward">Thưởng thủ công</option>
                <option value="manual_deduction">Khấu trừ thủ công</option>
              </select>
              {actionState?.fieldErrors?.lineType?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {actionState.fieldErrors.lineType[0]}
                </span>
              ) : null}
            </label>

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
              Nội dung
              <textarea
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                required
                value={note}
              />
              {actionState?.fieldErrors?.note?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {actionState.fieldErrors.note[0]}
                </span>
              ) : null}
            </label>

            <PayrollActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending} size="lg" type="submit">
                {isPending ? "Đang ghi..." : "Ghi điều chỉnh"}
              </Button>
            </div>
          </form>
        </PayrollModal>
      ) : null}
    </>
  );
}
