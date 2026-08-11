"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { TimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { initialTimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { retireWorkShiftAction } from "@/features/timekeeping/timekeeping-actions";
import type { TimekeepingWorkShift } from "@/features/timekeeping/types";

const inputClassName = "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function WorkShiftRetireAction({ workShift }: { workShift: TimekeepingWorkShift }) {
  const router = useRouter(); const triggerRef = useRef<HTMLButtonElement>(null); const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId(); const descriptionId = useId(); const reasonId = useId();
  const [isOpen, setIsOpen] = useState(false); const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<TimekeepingManagementActionState>(initialTimekeepingManagementActionState);
  const [isPending, startTransition] = useTransition(); const isInteractionLocked = isPending && actionState.status !== "error"; const error = actionState.status === "error" ? actionState.fieldErrors?.reason?.[0] : undefined;
  const open = (): void => { setReason(""); setActionState(initialTimekeepingManagementActionState); setIsOpen(true); };
  const close = (): void => { if (isInteractionLocked) return; setIsOpen(false); setActionState(initialTimekeepingManagementActionState); };
  const submit = (): void => { if (isInteractionLocked) return; setActionState(initialTimekeepingManagementActionState); startTransition(async () => { const result = await retireWorkShiftAction({ reason, workShiftId: workShift.id }); setActionState(result); if (result.status === "success") { setIsOpen(false); router.refresh(); } }); };
  const onSubmit = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); submit(); };
  const errorId = `${reasonId}-error`;
  return <><Button className="min-h-11 w-full" onClick={open} ref={triggerRef} type="button" variant="ghost">Ngừng dùng</Button><Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-lg" initialFocusRef={reasonRef} isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}><div className="p-4 sm:p-5"><h2 className="text-section-title text-text-strong" id={titleId}>Ngừng dùng ca làm</h2><p className="mt-1 text-secondary text-text-muted" id={descriptionId}>Ca <span className="font-semibold text-text-strong">{workShift.code}</span> sẽ không còn được phân công mới. Ca vẫn hiện trong danh mục.</p><form className="mt-5 grid gap-4" onSubmit={onSubmit}><div className="grid gap-1.5"><label className="text-label text-text-default" htmlFor={reasonId}>Lý do ngừng dùng</label><textarea aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} className={`${inputClassName} min-h-24 resize-y py-3`} disabled={isInteractionLocked} id={reasonId} maxLength={2000} onChange={(event) => setReason(event.target.value)} ref={reasonRef} required value={reason} />{error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : null}</div>{actionState.status === "error" ? <ResultBanner description={actionState.message} title="Không thể ngừng dùng ca làm" tone="error" /> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button className="min-h-11" disabled={isInteractionLocked} onClick={close} type="button" variant="ghost">Hủy</Button><Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} type="submit">{isInteractionLocked ? "Đang ngừng sử dụng…" : "Xác nhận ngừng dùng"}</Button></div></form></div></Dialog></>;
}
