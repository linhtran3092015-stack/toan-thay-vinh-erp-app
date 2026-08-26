"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { decidePayrollImportBatchAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";
import type { PayrollImportBatchRead } from "@/features/payroll/read-models";

export function PayrollImportDecisionDialog({ batch }: { batch: PayrollImportBatchRead }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [state, setState] = useState<PayrollActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const decide = (decision: "approved" | "rejected") => startTransition(async () => { const result = await decidePayrollImportBatchAction({ batchId: batch.id, decision, reviewNote }); setState(result); if (result.status === "success") { setIsOpen(false); router.refresh(); } });
  return <><Button onClick={() => setIsOpen(true)} ref={triggerRef} size="sm" type="button" variant="secondary">Kiểm tra & duyệt</Button><Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-lg" initialFocusRef={noteRef} isOpen={isOpen} onClose={() => { if (!isPending) setIsOpen(false); }} returnFocusRef={triggerRef}><div className="grid gap-4 p-4 sm:p-5"><div><h2 className="text-section-title text-text-strong" id={titleId}>Duyệt tệp dữ liệu</h2><p className="mt-1 text-secondary text-text-muted" id={descriptionId}>{batch.fileName} · {batch.totalRows} dòng</p></div><dl className="grid grid-cols-3 gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 text-center"><Stat label="Hợp lệ" value={batch.validRows} /><Stat label="Lỗi" value={batch.errorRows} /><Stat label="Xung đột" value={batch.conflictRows} /></dl>{batch.errorRows || batch.conflictRows ? <ResultBanner description="Chỉ có thể duyệt sau khi mọi dòng lỗi và xung đột được xử lý." title="Tệp chưa sẵn sàng" tone="warning" /> : null}<label className="grid gap-1.5 text-label"><span>Nội dung phản hồi</span><textarea className="min-h-28 rounded-md border border-border-subtle bg-surface-base px-3 py-3 text-control outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" disabled={isPending} maxLength={2000} onChange={(event) => setReviewNote(event.target.value)} ref={noteRef} value={reviewNote} /></label>{state?.status === "error" ? <ResultBanner description={state.message} title="Không thể xử lý tệp" tone="error" /> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={isPending} onClick={() => setIsOpen(false)} type="button" variant="ghost">Hủy</Button><Button disabled={isPending || !reviewNote.trim()} onClick={() => decide("rejected")} type="button" variant="secondary">Từ chối</Button><Button disabled={isPending || !reviewNote.trim() || batch.errorRows > 0 || batch.conflictRows > 0} isLoading={isPending} onClick={() => decide("approved")} type="button">Duyệt nhập</Button></div></div></Dialog></>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div><dt className="text-caption text-text-muted">{label}</dt><dd className="mt-1 text-body font-semibold tabular-nums text-text-strong">{value}</dd></div>; }
