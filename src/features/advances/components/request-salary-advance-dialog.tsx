"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { requestSalaryAdvanceAction } from "@/features/advances/actions/advance-actions";
import type { AdvanceActionOverrides } from "@/features/advances/advance-action-overrides";
import { AdvanceActionMessage } from "@/features/advances/components/advance-action-message";
import {
  advanceFieldClassName,
  advanceTextareaClassName,
} from "@/features/advances/components/advance-field";
import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";
import { getVietnamToday } from "@/lib/datetime";

/**
 * The current Vietnam month (`YYYY-MM`): the server rejects a month before it,
 * so the browser's own time zone must not pick the default.
 */
function getCurrentMonthValue(): string {
  return getVietnamToday().slice(0, 7);
}

/** Collects a Salary Advance request without deciding eligibility or Payroll effects. */
export function RequestSalaryAdvanceDialog({
  actions,
  onOpen,
  onSuccess,
}: {
  /** Server-action override for the /dev preview; the real page passes nothing. */
  actions?: Pick<AdvanceActionOverrides, "requestSalaryAdvance">;
  /** Called when the trigger opens the dialog (the page drops its last action notice). */
  onOpen?: () => void;
  /** Called with the action's message once the request is recorded (the dialog has closed). */
  onSuccess?: (message: string) => void;
} = {}) {
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
    onOpen?.();
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
      const request = actions?.requestSalaryAdvance ?? requestSalaryAdvanceAction;
      const result = await request({
        amountVnd: Number(amountVnd),
        deductionPeriodMonth: `${deductionMonth}-01`,
        requestNote,
      });
      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        onSuccess?.(result.message);
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
          <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
            Yêu cầu tạm ứng lương
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            Hệ thống sẽ xác minh yêu cầu và kỳ khấu trừ trước khi ghi nhận.
          </p>

          <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <label className="text-label font-medium text-text-strong" htmlFor={amountId}>
                Số tiền (VND)
              </label>
              <input
                aria-describedby={amountError ? amountErrorId : undefined}
                aria-invalid={Boolean(amountError)}
                className={advanceFieldClassName}
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
              <label className="text-label font-medium text-text-strong" htmlFor={deductionMonthId}>
                Kỳ khấu trừ
              </label>
              <input
                aria-describedby={deductionMonthDescribedBy}
                aria-invalid={Boolean(deductionMonthError)}
                className={advanceFieldClassName}
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
              <label className="text-label font-medium text-text-strong" htmlFor={requestNoteId}>
                Lý do tạm ứng
              </label>
              <textarea
                aria-describedby={requestNoteError ? requestNoteErrorId : undefined}
                aria-invalid={Boolean(requestNoteError)}
                className={advanceTextareaClassName}
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

            <div className="flex flex-col-reverse gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-end">
              <Button className="max-md:h-11" disabled={isInteractionLocked} onClick={closeDialog} type="button" variant="secondary">
                Hủy
              </Button>
              <Button className="max-md:h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} type="submit">
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
