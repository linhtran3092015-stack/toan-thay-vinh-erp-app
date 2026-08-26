"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { resolvePayrollCorrectionAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";
import type { PayrollCorrectionRequestRead } from "@/features/payroll/read-models";

const textAreaClassName = "min-h-28 w-full rounded-md border border-border-subtle bg-surface-base px-3 py-3 text-control text-text-default outline-none focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring";

export function PayrollCorrectionResolutionDialog({
  request,
}: {
  request: PayrollCorrectionRequestRead;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [state, setState] = useState<PayrollActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const decide = (decision: "accepted" | "rejected") => {
    startTransition(async () => {
      const result = await resolvePayrollCorrectionAction({
        decision,
        requestId: request.id,
        responseMessage,
      });
      setState(result);
      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} ref={triggerRef} size="sm" type="button" variant="secondary">Xử lý yêu cầu</Button>
      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-xl" initialFocusRef={fieldRef} isOpen={isOpen} onClose={() => { if (!isPending) setIsOpen(false); }} returnFocusRef={triggerRef}>
        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <h2 className="text-section-title text-text-strong" id={titleId}>Xử lý yêu cầu điều chỉnh</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>{request.staffDisplayName}: {request.requestMessage}</p>
          </div>
          <ul className="grid gap-2" aria-label="Nội dung đề nghị">
            {request.items.map((item) => <li className="rounded-md border border-border-subtle bg-surface-raised p-3 text-secondary" key={item.id}><p className="font-semibold text-text-strong">{item.itemLabel}</p><p className="mt-1 text-text-default">Đề nghị: {item.requestedChange}</p>{item.evidenceUrl ? <a className="mt-1 inline-block text-action-link underline" href={item.evidenceUrl} rel="noreferrer" target="_blank">Mở bằng chứng</a> : null}</li>)}
          </ul>
          <label className="grid gap-1.5 text-label text-text-default"><span>Nội dung phản hồi</span><textarea className={textAreaClassName} disabled={isPending} maxLength={4000} onChange={(event) => setResponseMessage(event.target.value)} ref={fieldRef} value={responseMessage} /></label>
          {state?.status === "error" ? <ResultBanner description={state.message} title="Không thể xử lý yêu cầu" tone="error" /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={isPending} onClick={() => setIsOpen(false)} type="button" variant="ghost">Hủy</Button>
            <Button disabled={isPending || !responseMessage.trim()} onClick={() => decide("rejected")} type="button" variant="secondary">Không chấp nhận</Button>
            <Button disabled={isPending || !responseMessage.trim()} isLoading={isPending} onClick={() => decide("accepted")} type="button">Chấp nhận</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
