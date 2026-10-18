"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button, type ButtonSize } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cancelPaymentRequestAction } from "@/features/finance/actions/finance-actions";
import type { PaymentRequestActionOverrides } from "@/features/finance/payment-request-action-overrides";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";
import { formatVnd } from "@/lib/format";

/** Same bounds as the action's zod schema (3–1000 characters after trimming). */
const REASON_MIN_LENGTH = 3;
const REASON_MAX_LENGTH = 1000;
const REASON_TOO_SHORT = `Nhập lý do hủy ít nhất ${REASON_MIN_LENGTH} ký tự.`;

/**
 * `outline-hidden` (rather than removing the outline) keeps it visible in
 * forced-colors mode; the focus ring is the 3px `--focus-ring`.
 */
const textareaClassName =
  "min-h-24 w-full resize-y rounded-md border border-border-strong bg-surface-base px-3 py-2 text-control text-text-default outline-hidden transition-colors placeholder:text-text-subtle hover:border-border-strong-hover focus-visible:border-border-focus focus-visible:ring-[3px] focus-visible:ring-focus-ring aria-[invalid=true]:border-danger disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

interface PaymentRequestCancelDialogProps {
  /** Server-action override for the /dev preview; the real page passes nothing. */
  actions?: Pick<PaymentRequestActionOverrides, "cancelPaymentRequest">;
  item: PaymentRequestReadModel;
  /** Called when the cancel succeeded (the dialog has closed, before the refresh): the page says so and takes focus. */
  onCancelled?: (item: PaymentRequestReadModel) => void;
  /** Called when the trigger opens the dialog (the page drops its last notice). */
  onOpen?: () => void;
  triggerClassName?: string;
  /** Table rows pass `sm` (32px), cards `lg` (44px touch). */
  triggerSize?: ButtonSize;
}

/**
 * "Hủy phiếu" for a pending request with nothing paid. One alert at most (the
 * action's message); the reason error is a plain line tied to the field. On
 * success the dialog closes and the route refreshes (the action revalidates it).
 */
export function PaymentRequestCancelDialog({
  actions,
  item,
  onCancelled,
  onOpen,
  triggerClassName,
  triggerSize = "sm",
}: PaymentRequestCancelDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  /**
   * Where focus goes once a refused cancel settles. The field and the submit are
   * disabled while pending, so focus has fallen to <body>; without this, Escape
   * (handled on the dialog) and the focus trap would stop working.
   */
  const refocusAfterErrorRef = useRef<"banner" | "reason" | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const reasonErrorId = `${reasonId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cancelPaymentRequest = actions?.cancelPaymentRequest ?? cancelPaymentRequestAction;

  // After the commit that ends the transition, when the field is enabled again.
  useEffect(() => {
    const target = refocusAfterErrorRef.current;
    if (isPending || !target) return;
    refocusAfterErrorRef.current = null;
    (target === "reason" ? reasonRef.current : errorRef.current)?.focus();
  }, [error, fieldError, isPending]);

  const open = (): void => {
    setReason("");
    setError(null);
    setFieldError(null);
    setIsOpen(true);
    onOpen?.();
  };

  const close = (): void => {
    if (isPending) return;
    setIsOpen(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isPending) return;
    setError(null);
    if (reason.trim().length < REASON_MIN_LENGTH) {
      setFieldError(REASON_TOO_SHORT);
      reasonRef.current?.focus();
      return;
    }
    setFieldError(null);
    startTransition(async () => {
      const result = await cancelPaymentRequest({ reason, requestId: item.id });
      if (result.status === "success") {
        setIsOpen(false);
        onCancelled?.(item);
        router.refresh();
        return;
      }
      const reasonError = result.fieldErrors?.reason?.[0] ?? null;
      refocusAfterErrorRef.current = reasonError ? "reason" : "banner";
      setFieldError(reasonError);
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
        size={triggerSize}
        type="button"
        variant="danger-outline"
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
        {/* noValidate: the reason rule is checked here so its message stays the field's own line. */}
        <form noValidate onSubmit={submit}>
          <div className="grid gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
            <div>
              <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
                Hủy phiếu thu {item.publicCode}
              </h2>
              <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
                {item.studentFullName} · {formatVnd(item.expectedAmountVnd)}. Mã chuyển khoản của phiếu sẽ không khớp tự
                động nữa; tiền về theo mã cũ sẽ vào hàng đợi đối soát.
              </p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-label font-medium text-text-strong" htmlFor={reasonId}>
                Lý do hủy
              </label>
              <textarea
                aria-describedby={fieldError ? reasonErrorId : undefined}
                aria-invalid={fieldError ? true : undefined}
                className={textareaClassName}
                disabled={isPending}
                id={reasonId}
                maxLength={REASON_MAX_LENGTH}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: Tạo nhầm số buổi, đã lập phiếu mới."
                ref={reasonRef}
                required
                value={reason}
              />
              {fieldError ? (
                <p className="text-caption font-medium text-danger" id={reasonErrorId}>{fieldError}</p>
              ) : null}
            </div>

            {error ? (
              <div
                className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                ref={errorRef}
                tabIndex={-1}
              >
                <ResultBanner title={error} tone="error" />
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border-subtle px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
            <Button className="max-md:h-11" disabled={isPending} onClick={close} type="button" variant="secondary">
              Giữ phiếu
            </Button>
            <Button className="max-md:h-11" isLoading={isPending} type="submit" variant="danger-solid">
              Xác nhận hủy
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
