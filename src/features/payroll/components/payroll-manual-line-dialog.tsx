"use client";

import { useRouter } from "next/navigation";
import { cloneElement, useId, useRef, useState, useTransition, type FormEvent, type ReactElement } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { addPayrollManualLineAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

type ManualLineType = "manual_deduction" | "manual_reward";

interface PayrollManualLineDialogProps {
  payrollStatementId: string;
  staffDisplayName: string;
}

/** Appends one existing manual reward/deduction action to an authoritative statement. */
export function PayrollManualLineDialog({
  payrollStatementId,
  staffDisplayName,
}: PayrollManualLineDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lineTypeRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const lineTypeId = useId();
  const amountId = useId();
  const noteId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amountVnd, setAmountVnd] = useState("");
  const [lineType, setLineType] = useState<ManualLineType>("manual_reward");
  const [note, setNote] = useState("");
  const [actionState, setActionState] = useState<PayrollActionState | null>(null);
  const isInteractionLocked = isPending && actionState?.status !== "error";
  const fieldErrors = actionState?.status === "error" ? actionState.fieldErrors ?? {} : {};

  const openDialog = (): void => {
    setAmountVnd("");
    setLineType("manual_reward");
    setNote("");
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
      <Button className="min-h-11" onClick={openDialog} ref={triggerRef} type="button" variant="outline">
        Điều chỉnh
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={lineTypeRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Điều chỉnh bảng lương
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            Thêm điều chỉnh tăng hoặc giảm cho {staffDisplayName}. Điều chỉnh tăng cộng vào, điều chỉnh giảm trừ vào Thực nhận. Hệ thống xác minh kỳ lương còn có thể cập nhật trước khi lưu.
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <SelectField error={fieldErrors.lineType?.[0]} id={lineTypeId} label="Loại điều chỉnh">
              <select
                className={formInputClassName}
                disabled={isInteractionLocked}
                id={lineTypeId}
                onChange={(event) => setLineType(event.target.value as ManualLineType)}
                ref={lineTypeRef}
                value={lineType}
              >
                <option value="manual_reward">Điều chỉnh tăng</option>
                <option value="manual_deduction">Điều chỉnh giảm</option>
              </select>
            </SelectField>

            <InputField
              error={fieldErrors.amountVnd?.[0]}
              id={amountId}
              label="Số tiền (VND)"
            >
              <input
                className={formInputClassName}
                disabled={isInteractionLocked}
                id={amountId}
                inputMode="numeric"
                min="1"
                onChange={(event) => setAmountVnd(event.target.value)}
                required
                step="1"
                type="number"
                value={amountVnd}
              />
            </InputField>

            <TextAreaField
              error={fieldErrors.note?.[0]}
              hint="Nhân sự thấy nội dung này trên phiếu lương, ở mục Điều chỉnh."
              id={noteId}
              label="Nội dung"
            >
              <textarea
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isInteractionLocked}
                id={noteId}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                required
                value={note}
              />
            </TextAreaField>

            {actionState?.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title="Không thể ghi điều chỉnh"
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} size="lg" type="submit">
                {isInteractionLocked ? "Đang ghi điều chỉnh…" : "Ghi điều chỉnh"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function SelectField({
  children,
  error,
  hint,
  id,
  label,
}: {
  children: ReactElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  error?: string;
  hint?: string;
  id: string;
  label: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="grid gap-1.5">
      <label className="text-label text-text-default" htmlFor={id}>{label}</label>
      {cloneElement(children, {
        "aria-describedby": error ? errorId : hint ? hintId : undefined,
        "aria-invalid": Boolean(error),
      })}
      {error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : hint ? <p className="text-caption text-text-muted" id={hintId}>{hint}</p> : null}
    </div>
  );
}

function InputField({
  children,
  error,
  id,
  label,
}: {
  children: ReactElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  error?: string;
  id: string;
  label: string;
}) {
  return <SelectField error={error} id={id} label={label}>{children}</SelectField>;
}

function TextAreaField({
  children,
  error,
  hint,
  id,
  label,
}: {
  children: ReactElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  error?: string;
  hint?: string;
  id: string;
  label: string;
}) {
  return <SelectField error={error} hint={hint} id={id} label={label}>{children}</SelectField>;
}
