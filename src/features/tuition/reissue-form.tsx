"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { reissueTuitionItemAction, type TuitionActionResult } from "@/features/tuition/actions";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

const UNCERTAIN_RESULT = "Không rõ phiếu đã được phát hành lại chưa; tải lại trang để kiểm tra trước khi thử lại.";

/**
 * Reissue a locked notice (design 15b, `tuition_periods.adjust`): the
 * original is never edited; a replacement with a new amount is created and
 * the old pending request is cancelled by the RPC. The result banner takes
 * its tone from the action's status (error = alert, success = status) and
 * receives focus when it arrives.
 *
 * Submitted through `onSubmit`, not a function `action`: React resets a form
 * after every action, so an error would put the original amount back in the
 * field and a retry could send it. The typed values stay until a success.
 *
 * A successful reissue revalidates the page, which re-renders this notice as
 * replaced. The notice page keeps this form mounted for adjusters either way,
 * so the result survives that re-render: once `replaced`, the fields are gone
 * and only the banner shows (with a link to the current replacement when
 * known), or nothing at all when there is no result to show.
 */
export function TuitionReissueForm({
  amountVnd,
  itemId,
  reissueAction = reissueTuitionItemAction,
  replaced = false,
  replacementHref = null,
}: {
  amountVnd: number;
  itemId: string;
  /** Inert stand-in for previews; defaults to the real server action. */
  reissueAction?: typeof reissueTuitionItemAction;
  /** The notice already has a replacement: no new reissue is offered. */
  replaced?: boolean;
  /** The current replacement's notice page, when known. */
  replacementHref?: string | null;
}) {
  const titleId = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TuitionActionResult | null>(null);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Number(data.get("amount"));
    const reason = String(data.get("reason") ?? "");
    setResult(null);
    start(async () => {
      let outcome: TuitionActionResult;
      try {
        outcome = await reissueAction(itemId, amount, reason);
      } catch {
        outcome = { message: UNCERTAIN_RESULT, status: "error" };
      }
      // Marked as part of the transition again (it does not carry across an
      // await), so the banner lands in the same commit as the button.
      start(() => {
        setResult(outcome);
        if (outcome.status === "success") form.reset();
      });
    });
  }

  if (replaced && !result) return null;

  // One element type and child order in both modes, so the banner keeps its
  // DOM node (and focus) when the page re-renders the notice as replaced.
  return (
    <form
      aria-labelledby={replaced ? undefined : titleId}
      className={cn(
        "@container grid gap-4",
        !replaced && "rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)] md:p-5",
      )}
      onSubmit={submit}
    >
      {replaced ? null : (
        <div>
          <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
            Điều chỉnh / phát hành lại
          </h2>
          <p className="mt-1 text-secondary text-text-muted">
            Phiếu gốc không bị sửa; yêu cầu thanh toán cũ bị hủy. Phiếu thay thế có yêu cầu tái phí và QR mới nếu số tiền lớn hơn 0.
          </p>
        </div>
      )}
      {replaced ? null : (
        <div className="grid gap-3 @min-[520px]:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Label htmlFor={`reissue-amount-${itemId}`} required>
              Số tiền mới (₫)
            </Label>
            <Input
              aria-describedby={`reissue-amount-hint-${itemId}`}
              className="tabular-nums max-md:h-11"
              defaultValue={amountVnd}
              id={`reissue-amount-${itemId}`}
              inputMode="numeric"
              min="0"
              name="amount"
              required
              step="1"
              type="number"
            />
            <p className="text-caption text-text-muted" id={`reissue-amount-hint-${itemId}`}>
              Hiện tại {formatVnd(amountVnd)}. Nhập 0 nếu phiếu thay thế không cần thanh toán.
            </p>
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor={`reissue-reason-${itemId}`} required>
              Lý do điều chỉnh
            </Label>
            <Input
              className="max-md:h-11"
              id={`reissue-reason-${itemId}`}
              name="reason"
              placeholder="Ví dụ: Giảm 2 buổi nghỉ có phép"
              required
            />
          </div>
        </div>
      )}
      {replaced ? null : (
        <div>
          <Button className="max-md:h-11" isLoading={pending} type="submit" variant="secondary">
            Tạo phiếu thay thế
          </Button>
        </div>
      )}
      {result ? (
        <div
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          ref={resultRef}
          tabIndex={-1}
        >
          <ResultBanner
            action={
              replaced && replacementHref ? (
                <Link
                  className="inline-flex min-h-11 items-center rounded-sm font-semibold text-action-link! underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
                  href={replacementHref}
                >
                  Mở bản thay thế hiện hành
                </Link>
              ) : undefined
            }
            title={result.message}
            tone={result.status === "success" ? "success" : "error"}
          />
        </div>
      ) : null}
    </form>
  );
}
