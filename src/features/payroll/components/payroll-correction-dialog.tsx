"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { submitPayrollCorrectionAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring";

export function PayrollCorrectionDialog({
  itemLabel,
  payrollLineItemId,
  payrollStatementId,
  triggerLabel = "Yêu cầu kiểm tra",
}: {
  itemLabel: string;
  payrollLineItemId: string | null;
  payrollStatementId: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestedChange, setRequestedChange] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [state, setState] = useState<PayrollActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const locked = isPending && state?.status !== "error";

  const close = (): void => {
    if (locked) return;
    setIsOpen(false);
    setState(null);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} ref={triggerRef} size="sm" type="button" variant="ghost">{triggerLabel}</Button>
      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-lg" initialFocusRef={firstFieldRef} isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
        <div className="grid gap-4 p-4 sm:p-5">
          <div><h2 className="text-section-title text-text-strong" id={titleId}>Yêu cầu điều chỉnh bảng lương</h2><p className="mt-1 text-secondary text-text-muted" id={descriptionId}>Khoản cần kiểm tra: <strong>{itemLabel}</strong></p></div>
          <Field label="Vấn đề đang gặp"><textarea className={`${inputClassName} min-h-24 py-3`} disabled={locked} maxLength={4000} onChange={(event) => setRequestMessage(event.target.value)} ref={firstFieldRef} value={requestMessage} /></Field>
          <Field label="Kết quả mong muốn"><textarea className={`${inputClassName} min-h-24 py-3`} disabled={locked} maxLength={4000} onChange={(event) => setRequestedChange(event.target.value)} value={requestedChange} /></Field>
          <Field label="Liên kết bằng chứng (nếu có)"><input className={inputClassName} disabled={locked} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://…" type="url" value={evidenceUrl} /></Field>
          {state?.status === "error" ? <ResultBanner description={state.message} title="Không thể gửi yêu cầu" tone="error" /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={locked} onClick={close} type="button" variant="ghost">Hủy</Button><Button disabled={locked} isLoading={locked} onClick={() => startTransition(async () => { const result = await submitPayrollCorrectionAction({ evidenceUrl, itemLabel, payrollLineItemId, payrollStatementId, requestMessage, requestedChange }); setState(result); if (result.status === "success") { setIsOpen(false); router.refresh(); } })} type="button">{locked ? "Đang gửi…" : "Gửi yêu cầu"}</Button></div>
        </div>
      </Dialog>
    </>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-label text-text-default"><span>{label}</span>{children}</label>;
}
