"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import type { SepayActionOverrides } from "@/features/finance/sepay-action-overrides";
import { reverseSepayAllocationAction } from "@/features/finance/sepay-allocation-reversal-actions";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

/** Statuses whose financial effects the reversal RPC can undo. */
export function isSepayTransactionReversible(transaction: SepayTransactionReadModel): boolean {
  return transaction.matchStatus === "auto_matched"
    || transaction.matchStatus === "manual_matched"
    || transaction.matchStatus === "split_allocated";
}

export function SepayAllocationReversalDialog({
  actions,
  transaction,
}: {
  /** Replacement for the reversal server action (dev preview only). */
  actions?: Pick<SepayActionOverrides, "reverseAllocation">;
  transaction: SepayTransactionReadModel;
}) {
  const router = useRouter();
  const reverseAllocation = actions?.reverseAllocation ?? reverseSepayAllocationAction;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isSepayTransactionReversible(transaction)) return null;

  const open = (): void => {
    setReason("");
    setError(null);
    setSuccess(null);
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
    startTransition(async () => {
      const result = await reverseAllocation({ reason, transactionId: transaction.id });
      if (result.ok) {
        setSuccess(result.message);
        router.refresh();
        return;
      }
      setError(result.message);
    });
  };

  const reference = transaction.matchedPaymentRequestCode ?? transaction.matchedStudentFullName ?? "nhiều học sinh";

  return (
    <>
      <Button
        aria-label={`Đảo phân bổ giao dịch ${transaction.bankTransactionId}`}
        onClick={open}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="danger"
      >
        Đảo phân bổ
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
            Đảo phân bổ giao dịch {transaction.bankTransactionId}
          </h2>
          <p className="mt-2 text-secondary text-text-muted" id={descriptionId}>
            {currencyFormatter.format(transaction.amountVnd)} ₫ · {reference}. Buổi đã cộng sẽ được trừ lại bằng bút toán
            đối ứng, phiếu thu quay về trạng thái trước khi thu, doanh thu và fact lương của giao dịch bị gỡ. Giao dịch
            trở về hàng đợi chưa khớp để phân bổ lại. Không đảo được nếu tháng tiền về đã duyệt lương.
          </p>

          {success ? (
            <div className="mt-4">
              <ResultBanner title={success} tone="success" />
            </div>
          ) : (
            <div className="mt-4">
              <label className="text-label font-medium text-text-strong" htmlFor={reasonId}>
                Lý do đảo phân bổ
              </label>
              <textarea
                className={`${inputClassName} mt-1 min-h-20 py-2`}
                disabled={isPending}
                id={reasonId}
                maxLength={1000}
                minLength={3}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: Chọn nhầm học sinh, phụ huynh xác nhận chuyển cho em khác."
                ref={reasonRef}
                required
                value={reason}
              />
            </div>
          )}

          {error ? (
            <div className="mt-4">
              <ResultBanner title={error} tone="error" />
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11" disabled={isPending} onClick={close} type="button" variant="outline">
              {success ? "Đóng" : "Giữ nguyên"}
            </Button>
            {success ? null : (
              <Button className="min-h-11" isLoading={isPending} type="submit" variant="danger">
                Xác nhận đảo
              </Button>
            )}
          </div>
        </form>
      </Dialog>
    </>
  );
}
