"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { StaffPayrollProfile } from "@/features/staff/payroll-profile-types";
import { decideStaffBankAccountChangeAction } from "@/features/staff/staff-actions";
import type { StaffManagementActionState } from "@/features/staff/staff-action-types";

export function StaffBankAccountDecisionDialog({
  request,
  staffId,
}: {
  request: StaffPayrollProfile["bankChangeRequests"][number];
  staffId: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [state, setState] = useState<StaffManagementActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const decide = (decision: "approved" | "rejected") => startTransition(async () => {
    const result = await decideStaffBankAccountChangeAction({ decision, requestId: request.id, reviewNote, staffId });
    setState(result);
    if (result.status === "success") { setIsOpen(false); router.refresh(); }
  });

  return <>
    <Button onClick={() => setIsOpen(true)} ref={triggerRef} size="sm" type="button" variant="secondary">Duyệt thông tin</Button>
    <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-lg" initialFocusRef={fieldRef} isOpen={isOpen} onClose={() => { if (!isPending) setIsOpen(false); }} returnFocusRef={triggerRef}>
      <div className="grid gap-4 p-4 sm:p-5">
        <div><h2 className="text-section-title text-text-strong" id={titleId}>Duyệt thông tin nhận lương</h2><p className="mt-1 text-secondary text-text-muted" id={descriptionId}>Kiểm tra kỹ trước khi chấp nhận.</p></div>
        <dl className="grid gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 text-secondary"><Row label="Ngân hàng" value={request.bankName} /><Row label="Số tài khoản" value={request.accountNumber} /><Row label="Chủ tài khoản" value={request.accountHolderName} /><Row label="Lý do" value={request.reason} /></dl>
        <label className="grid gap-1.5 text-label text-text-default"><span>Nội dung phản hồi</span><textarea className="min-h-28 rounded-md border border-border-subtle bg-surface-base px-3 py-3 text-control outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" disabled={isPending} maxLength={2000} onChange={(event) => setReviewNote(event.target.value)} ref={fieldRef} value={reviewNote} /></label>
        {state?.status === "error" ? <ResultBanner description={state.message} title="Không thể xử lý" tone="error" /> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={isPending} onClick={() => setIsOpen(false)} type="button" variant="ghost">Hủy</Button><Button disabled={isPending || !reviewNote.trim()} onClick={() => decide("rejected")} type="button" variant="secondary">Từ chối</Button><Button disabled={isPending || !reviewNote.trim()} isLoading={isPending} onClick={() => decide("approved")} type="button">Duyệt</Button></div>
      </div>
    </Dialog>
  </>;
}

function Row({ label, value }: { label: string; value: string }) { return <div><dt className="text-label text-text-muted">{label}</dt><dd className="mt-1 break-words font-medium text-text-strong">{value}</dd></div>; }
