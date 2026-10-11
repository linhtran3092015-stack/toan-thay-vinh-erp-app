"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { markPayrollPeriodPaidAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function getVietnamToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function MarkPayrollPaidDialog({
  payrollPeriodId,
  periodMonth,
}: {
  payrollPeriodId: string;
  periodMonth: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dateId = useId();
  const referenceId = useId();
  const noteId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [paidOn, setPaidOn] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<PayrollActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const locked = isPending && state?.status !== "error";
  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;

  const open = (): void => {
    setPaidOn(getVietnamToday());
    setReference("");
    setNote("");
    setState(null);
    setIsOpen(true);
  };

  const close = (): void => {
    if (locked) return;
    setIsOpen(false);
    setState(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (locked) return;
    setState(null);
    startTransition(async () => {
      const result = await markPayrollPeriodPaidAction({ note, paidOn, payrollPeriodId, reference });
      setState(result);
      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button className="min-h-11" onClick={open} ref={triggerRef} type="button" variant="primary">
        Ghi nhận đã trả lương
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-md"
        initialFocusRef={dateRef}
        isOpen={isOpen}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        <form className="p-4 sm:p-5" onSubmit={submit}>
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Ghi nhận đã trả lương {formatMonth(periodMonth)}
          </h2>
          <p className="mt-2 text-secondary text-text-muted" id={descriptionId}>
            Sau bước này kỳ lương được khóa hẳn: không mở lại, không tính lại. Hãy chắc chắn tiền đã chuyển cho nhân sự.
          </p>

          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-label font-medium text-text-strong" htmlFor={dateId}>Ngày trả lương</label>
              <input
                aria-invalid={fieldErrors?.paidOn ? true : undefined}
                className={`${inputClassName} mt-1`}
                disabled={locked}
                id={dateId}
                max={getVietnamToday()}
                onChange={(event) => setPaidOn(event.target.value)}
                ref={dateRef}
                required
                type="date"
                value={paidOn}
              />
              {fieldErrors?.paidOn?.[0] ? <p className="mt-1 text-caption text-danger" role="alert">{fieldErrors.paidOn[0]}</p> : null}
            </div>
            <div>
              <label className="text-label font-medium text-text-strong" htmlFor={referenceId}>Tham chiếu chuyển khoản (tùy chọn)</label>
              <input
                className={`${inputClassName} mt-1`}
                disabled={locked}
                id={referenceId}
                maxLength={160}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Ví dụ: mã lô chuyển khoản ngân hàng"
                value={reference}
              />
            </div>
            <div>
              <label className="text-label font-medium text-text-strong" htmlFor={noteId}>Ghi chú (tùy chọn)</label>
              <textarea
                className={`${inputClassName} mt-1 min-h-20 py-2`}
                disabled={locked}
                id={noteId}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                value={note}
              />
            </div>
          </div>

          {state?.status === "error" ? (
            <div className="mt-4">
              <ResultBanner title={state.message} tone="error" />
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11" disabled={locked} onClick={close} type="button" variant="outline">Hủy</Button>
            <Button className="min-h-11" isLoading={locked} type="submit" variant="primary">Xác nhận đã trả</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
