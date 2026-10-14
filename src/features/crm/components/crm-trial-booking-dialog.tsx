"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { bookTrialAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionOverrides } from "@/features/crm/crm-action-overrides";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";

interface CrmTrialBookingDialogProps { action?: CrmActionOverrides["bookTrial"]; crmCaseId: string; }
const fieldClassName = "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

export function CrmTrialBookingDialog({ action = bookTrialAction, crmCaseId }: CrmTrialBookingDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [trialDate, setTrialDate] = useState("");
  const [learningMode, setLearningMode] = useState<"online" | "offline">("offline");
  const [saleNotes, setSaleNotes] = useState("");
  const [actionState, setActionState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const trialDateError = actionState?.status === "error" ? actionState.fieldErrors?.trialDate?.[0] : undefined;
  const close = () => { if (!isPending) setIsOpen(false); };
  const handleBookTrial = () => {
    if (isPending) return;
    setActionState(null);
    startTransition(async () => {
      const result = await action({ crmCaseId, learningMode, saleNotes, trialDate });
      setActionState(result);
      if (result.status === "success") { setIsOpen(false); setTrialDate(""); setSaleNotes(""); router.refresh(); }
    });
  };
  return <>
    <Button onClick={() => { setActionState(null); setIsOpen(true); }} ref={triggerRef} size="sm" variant="secondary">Đặt lịch học thử</Button>
    <Dialog ariaDescribedBy="crm-trial-dialog-description" ariaLabelledBy="crm-trial-dialog-title" className="max-w-md" isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
      <div className="grid gap-5 p-5 sm:p-6"><div><h2 className="text-section-title font-semibold text-text-strong" id="crm-trial-dialog-title">Đặt lịch học thử</h2><p className="mt-1 text-secondary text-text-muted" id="crm-trial-dialog-description">Lịch học thử không ảnh hưởng tới bảng điểm danh chính thức của lớp.</p></div>
        {actionState?.status === "error" ? <ResultBanner title={actionState.message} tone="error" /> : null}
        <div className="grid gap-4"><div className="grid gap-1.5"><label className="text-label font-medium text-text-muted" htmlFor="crm-trial-date">Ngày học thử dự kiến <span aria-hidden="true" className="text-danger">*</span></label><input aria-describedby={trialDateError ? "crm-trial-date-error" : undefined} aria-invalid={Boolean(trialDateError)} className={fieldClassName} disabled={isPending} id="crm-trial-date" onChange={(event) => setTrialDate(event.target.value)} type="date" value={trialDate} />{trialDateError ? <p className="text-caption text-danger" id="crm-trial-date-error">{trialDateError}</p> : null}</div><div className="grid gap-1.5"><label className="text-label font-medium text-text-muted" htmlFor="crm-trial-mode">Hình thức học thử <span aria-hidden="true" className="text-danger">*</span></label><select className={fieldClassName} disabled={isPending} id="crm-trial-mode" onChange={(event) => setLearningMode(event.target.value as "online" | "offline")} value={learningMode}><option value="offline">Offline (Tại trung tâm)</option><option value="online">Online (Trực tuyến)</option></select></div><div className="grid gap-1.5"><label className="text-label font-medium text-text-muted" htmlFor="crm-trial-notes">Ghi chú cho buổi học thử</label><textarea className="min-h-28 rounded-md border border-border-subtle bg-field-bg p-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring" disabled={isPending} id="crm-trial-notes" onChange={(event) => setSaleNotes(event.target.value)} placeholder="Ghi chú về trình độ, mong muốn của phụ huynh…" value={saleNotes} /></div></div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={isPending} onClick={close} variant="outline">Hủy</Button><Button disabled={isPending || !trialDate} onClick={handleBookTrial}>{isPending ? "Đang lưu…" : "Xác nhận đặt lịch"}</Button></div>
      </div>
    </Dialog>
  </>;
}
