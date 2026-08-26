"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { submitStaffBankAccountChangeAction } from "@/features/staff/staff-actions";
import {
  initialStaffManagementActionState,
  type StaffManagementActionState,
} from "@/features/staff/staff-action-types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function StaffBankAccountDialog({ staffId }: { staffId: string }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<StaffManagementActionState>(initialStaffManagementActionState);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const locked = isPending && state.status !== "error";

  const close = (): void => {
    if (locked) return;
    setIsOpen(false);
    setState(initialStaffManagementActionState);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (locked) return;
    setState(initialStaffManagementActionState);
    startTransition(async () => {
      const result = await submitStaffBankAccountChangeAction({
        accountHolderName,
        accountNumber,
        bankName,
        effectiveFrom,
        reason,
        staffId,
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
      <Button onClick={() => setIsOpen(true)} ref={triggerRef} type="button" variant="secondary">Cập nhật ngân hàng</Button>
      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-lg" initialFocusRef={firstFieldRef} isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
        <form className="grid gap-4 p-4 sm:p-5" onSubmit={submit}>
          <div>
            <h2 className="text-section-title text-text-strong" id={titleId}>Thông tin nhận lương</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>Thông tin mới chỉ có hiệu lực sau khi kế toán hoặc chủ trung tâm duyệt.</p>
          </div>
          <Field error={state.fieldErrors?.bankName?.[0]} label="Ngân hàng"><input className={inputClassName} disabled={locked} maxLength={160} onChange={(event) => setBankName(event.target.value)} ref={firstFieldRef} required value={bankName} /></Field>
          <Field error={state.fieldErrors?.accountNumber?.[0]} label="Số tài khoản"><input autoComplete="off" className={inputClassName} disabled={locked} maxLength={40} onChange={(event) => setAccountNumber(event.target.value)} required value={accountNumber} /></Field>
          <Field error={state.fieldErrors?.accountHolderName?.[0]} label="Chủ tài khoản"><input className={inputClassName} disabled={locked} maxLength={160} onChange={(event) => setAccountHolderName(event.target.value)} required value={accountHolderName} /></Field>
          <Field error={state.fieldErrors?.effectiveFrom?.[0]} label="Hiệu lực từ"><input className={inputClassName} disabled={locked} onChange={(event) => setEffectiveFrom(event.target.value)} required type="date" value={effectiveFrom} /></Field>
          <Field error={state.fieldErrors?.reason?.[0]} label="Lý do"><textarea className={`${inputClassName} min-h-24 py-3`} disabled={locked} maxLength={2000} onChange={(event) => setReason(event.target.value)} required value={reason} /></Field>
          {state.status === "error" ? <ResultBanner description={state.message} title="Không thể gửi thông tin ngân hàng" tone="error" /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={locked} onClick={close} type="button" variant="ghost">Hủy</Button><Button disabled={locked} isLoading={locked} type="submit">{locked ? "Đang gửi…" : "Gửi để duyệt"}</Button></div>
        </form>
      </Dialog>
    </>
  );
}

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return <label className="grid gap-1.5 text-label text-text-default"><span>{label}</span>{children}{error ? <span className="text-caption font-medium text-danger">{error}</span> : null}</label>;
}
