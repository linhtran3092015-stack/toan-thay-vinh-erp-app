"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { transferLeadAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";
import type { SaleOwnerOption } from "@/features/crm/read-models";

interface CrmLeadTransferDialogProps { crmCaseId: string; currentSaleOwnerId: string | null; saleOwners: SaleOwnerOption[]; }
const fieldClassName = "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

export function CrmLeadTransferDialog({ crmCaseId, currentSaleOwnerId, saleOwners }: CrmLeadTransferDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [newSaleOwnerId, setNewSaleOwnerId] = useState("");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonId = "crm-transfer-reason";
  const reasonError = actionState?.status === "error" ? actionState.fieldErrors?.reason?.[0] : undefined;
  const close = () => { if (!isPending) setIsOpen(false); };
  const handleTransfer = () => {
    if (isPending) return;
    setActionState(null);
    startTransition(async () => {
      const result = await transferLeadAction({ crmCaseId, newSaleOwnerId, reason });
      setActionState(result);
      if (result.status === "success") { setIsOpen(false); setReason(""); setNewSaleOwnerId(""); router.refresh(); }
    });
  };
  const eligibleOwners = saleOwners.filter((sale) => sale.id !== currentSaleOwnerId);
  return <>
    <Button onClick={() => { setActionState(null); setIsOpen(true); }} ref={triggerRef} size="sm" variant="outline">Chuyển giao Lead</Button>
    <Dialog ariaDescribedBy="crm-transfer-dialog-description" ariaLabelledBy="crm-transfer-dialog-title" className="max-w-md" isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
      <div className="grid gap-5 p-5 sm:p-6"><div><h2 className="text-section-title font-semibold text-text-strong" id="crm-transfer-dialog-title">Xác nhận chuyển giao Lead</h2><p className="mt-1 text-secondary text-text-muted" id="crm-transfer-dialog-description">Lịch sử chuyển giao lead sẽ được lưu vết theo quy trình hiện có.</p></div>
        {actionState?.status === "error" ? <ResultBanner title={actionState.message} tone="error" /> : null}
        <div className="grid gap-4"><div className="grid gap-1.5"><label className="text-label font-medium text-text-muted" htmlFor="crm-transfer-owner">Chọn Sale nhận Lead <span aria-hidden="true" className="text-danger">*</span></label><select className={fieldClassName} disabled={isPending} id="crm-transfer-owner" onChange={(event) => setNewSaleOwnerId(event.target.value)} value={newSaleOwnerId}><option value="">-- Chọn nhân sự Sale --</option>{eligibleOwners.map((sale) => <option key={sale.id} value={sale.id}>{sale.fullName}</option>)}</select></div>
          <div className="grid gap-1.5"><label className="text-label font-medium text-text-muted" htmlFor={reasonId}>Lý do chuyển giao <span aria-hidden="true" className="text-danger">*</span></label><textarea aria-describedby={reasonError ? `${reasonId}-error` : undefined} className="min-h-28 rounded-md border border-border-subtle bg-field-bg p-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring" disabled={isPending} id={reasonId} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do chuyển giao…" value={reason} />{reasonError ? <p className="text-caption text-danger" id={`${reasonId}-error`}>{reasonError}</p> : null}</div></div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={isPending} onClick={close} variant="outline">Hủy</Button><Button disabled={isPending || !newSaleOwnerId || reason.trim().length < 3} onClick={handleTransfer}>{isPending ? "Đang xử lý…" : "Xác nhận chuyển giao"}</Button></div>
      </div>
    </Dialog>
  </>;
}
