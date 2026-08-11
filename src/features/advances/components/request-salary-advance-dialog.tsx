"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { requestSalaryAdvanceAction } from "@/features/advances/actions/advance-actions";
import { AdvanceActionMessage } from "@/features/advances/components/advance-action-message";
import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function getCurrentMonthValue(): string {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
}

/** Collects a Salary Advance request without deciding eligibility or Payroll effects. */
export function RequestSalaryAdvanceDialog() {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const amountId = useId();
  const deductionMonthId = useId();
  const requestNoteId = useId();
  const amountErrorId = `${amountId}-error`;
  const deductionMonthErrorId = `${deductionMonthId}-error`;
  const deductionMonthHelpId = `${deductionMonthId}-help`;
  const requestNoteErrorId = `${requestNoteId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amountVnd, setAmountVnd] = useState("");
  const [deductionMonth, setDeductionMonth] = useState(getCurrentMonthValue);
  const [requestNote, setRequestNote] = useState("");
  const [actionState, setActionState] = useState<AdvanceActionState | null>(null);
  const isInteractionLocked = isPending && actionState?.status !== "error";
  const amountError = actionState?.status === "error" ? actionState.fieldErrors?.amountVnd?.[0] : undefined;
  const deductionMonthError = actionState?.status === "error"
    ? actionState.fieldErrors?.deductionPeriodMonth?.[0]
    : undefined;
  const requestNoteError = actionState?.status === "error"
    ? actionState.fieldErrors?.requestNote?.[0]
    : undefined;
  const deductionMonthDescribedBy = deductionMonthError
    ? `${deductionMonthHelpId} ${deductionMonthErrorId}`
    : deductionMonthHelpId;

  const openDialog = (): void => {
    setAmountVnd("");
    setDeductionMonth(getCurrentMonthValue());
    setRequestNote("");
    setActionState(null);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setIsOpen(false);
    setActionState(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isInteractionLocked) {
      return;
    }

    setActionState(null);
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
      <Button className="min-h-11" onClick={openDialog} ref={triggerRef} size="lg" type="button">
        Yêu cầu tạm ứng
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={amountRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Yêu cầu tạm ứng lương
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            Hệ thống sẽ xác minh yêu cầu và kỳ khấu trừ trước khi ghi nhận.
          </p>

          <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <label className="text-label text-text-default" htmlFor={amountId}>
                Số tiền (VND)
              </label>
              <input
                aria-describedby={amountError ? amountErrorId : undefined}
                aria-invalid={Boolean(amountError)}
                className={formInputClassName}
                disabled={isInteractionLocked}
                id={amountId}
                inputMode="numeric"
                min="1"
                onChange={(event) => setAmountVnd(event.target.value)}
                ref={amountRef}
                required
                step="1"
                type="number"
                value={amountVnd}
              />
              {amountError ? <FieldError id={amountErrorId}>{amountError}</FieldError> : null}
            </div>

            <div className="grid gap-1.5">
              <label className="text-label text-text-default" htmlFor={deductionMonthId}>
                Kỳ khấu trừ
              </label>
              <input
                aria-describedby={deductionMonthDescribedBy}
                aria-invalid={Boolean(deductionMonthError)}
                className={formInputClassName}
                disabled={isInteractionLocked}
                id={deductionMonthId}
                onChange={(event) => setDeductionMonth(event.target.value)}
                required
                type="month"
                value={deductionMonth}
              />
              <p className="text-caption text-text-muted" id={deductionMonthHelpId}>
                Kỳ được chọn sẽ được hệ thống kiểm tra khi gửi yêu cầu.
              </p>
              {deductionMonthError ? (
                <FieldError id={deductionMonthErrorId}>{deductionMonthError}</FieldError>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <label className="text-label text-text-default" htmlFor={requestNoteId}>
                Lý do tạm ứng
              </label>
              <textarea
                aria-describedby={requestNoteError ? requestNoteErrorId : undefined}
                aria-invalid={Boolean(requestNoteError)}
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isInteractionLocked}
                id={requestNoteId}
                maxLength={2000}
                onChange={(event) => setRequestNote(event.target.value)}
                required
                value={requestNote}
              />
              {requestNoteError ? (
                <FieldError id={requestNoteErrorId}>{requestNoteError}</FieldError>
              ) : null}
            </div>

            <AdvanceActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} size="lg" type="submit">
                {isInteractionLocked ? "Đang gửi yêu cầu…" : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function FieldError({ children, id }: { children: string; id: string }) {
  return <p className="text-caption font-medium text-danger" id={id}>{children}</p>;
}
