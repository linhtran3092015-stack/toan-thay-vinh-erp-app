"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createPayrollDraftAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function getPreviousMonthValue(): string {
  const currentDate = new Date();
  currentDate.setMonth(currentDate.getMonth() - 1);
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
}

/** Collects the existing create-draft input without deciding payroll eligibility. */
export function CreatePayrollDraftDialog() {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const periodMonthRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const periodMonthId = useId();
  const periodMonthErrorId = `${periodMonthId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [periodMonth, setPeriodMonth] = useState(getPreviousMonthValue);
  const [actionState, setActionState] = useState<PayrollActionState | null>(null);
  const isInteractionLocked = isPending && actionState?.status !== "error";
  const fieldError = actionState?.status === "error"
    ? actionState.fieldErrors?.periodMonth?.[0]
    : undefined;

  const openDialog = (): void => {
    setPeriodMonth(getPreviousMonthValue());
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
      <Button className="min-h-11" onClick={openDialog} ref={triggerRef} size="lg" type="button">
        Lập bảng lương
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={periodMonthRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Lập bảng lương tháng
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            Hệ thống kiểm tra kỳ lương, dữ liệu nguồn và đơn giá hiệu lực trước khi lập.
          </p>

          <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <label className="text-label text-text-default" htmlFor={periodMonthId}>
                Kỳ lương
              </label>
              <input
                aria-describedby={fieldError ? periodMonthErrorId : undefined}
                aria-invalid={Boolean(fieldError)}
                className={formInputClassName}
                disabled={isInteractionLocked}
                id={periodMonthId}
                onChange={(event) => setPeriodMonth(event.target.value)}
                ref={periodMonthRef}
                required
                type="month"
                value={periodMonth}
              />
              {fieldError ? (
                <p className="text-caption font-medium text-danger" id={periodMonthErrorId}>
                  {fieldError}
                </p>
              ) : null}
            </div>

            {actionState?.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title="Không thể lập bảng lương"
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} size="lg" type="submit">
                {isInteractionLocked ? "Đang lập bảng lương…" : "Lập bảng lương"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}
