"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cancelPaymentRequestAction } from "@/features/finance/actions/finance-actions";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function PaymentRequestCancelDialog({
  item,
  triggerClassName,
}: {
  item: PaymentRequestReadModel;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = (): void => {
    setReason("");
    setError(null);
    setFieldError(null);
    setIsOpen(true);
  };

  const close = (): void => {
    if (isPending) return;
    setIsOpen(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isPending) return;
    setError(null);
    setFieldError(null);
    startTransition(async () => {
      const result = await cancelPaymentRequestAction({ reason, requestId: item.id });
      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
        return;
      }
      setFieldError(result.fieldErrors?.reason?.[0] ?? null);
      setError(result.message);
    });
  };

  return (
    <>
      <Button
        aria-label={`Hủy phiếu thu ${item.publicCode}`}
        className={triggerClassName}
        onClick={open}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="danger"
      >
        Hủy phiếu
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-md"
        initialFocusRef={reasonRef}
        isOpen={isOpen}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        <form className="p-4 sm:p-5" onSubmit={submit}>
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Hủy phiếu thu {item.publicCode}
          </h2>
          <p className="mt-2 text-secondary text-text-muted" id={descriptionId}>
            {item.studentFullName} · {new Intl.NumberFormat("vi-VN").format(item.expectedAmountVnd)} ₫. Mã chuyển khoản của phiếu
            sẽ không khớp tự động nữa; tiền về theo mã cũ sẽ vào hàng đợi đối soát.
          </p>

          <div className="mt-4">
            <label className="text-label font-medium text-text-strong" htmlFor={reasonId}>
              Lý do hủy
            </label>
            <textarea
              aria-invalid={fieldError ? true : undefined}
              className={`${inputClassName} mt-1 min-h-20 py-2`}
              disabled={isPending}
              id={reasonId}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ví dụ: Tạo nhầm số buổi, đã lập phiếu mới."
              ref={reasonRef}
              required
              value={reason}
            />
            {fieldError ? (
              <p className="mt-1 text-caption text-danger" role="alert">{fieldError}</p>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4">
              <ResultBanner title={error} tone="error" />
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11" disabled={isPending} onClick={close} type="button" variant="outline">
              Giữ phiếu
            </Button>
            <Button className="min-h-11" isLoading={isPending} type="submit" variant="danger">
              Xác nhận hủy
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
