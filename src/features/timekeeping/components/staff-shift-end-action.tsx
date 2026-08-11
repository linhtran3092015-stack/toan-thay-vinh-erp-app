"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { EndStaffShiftAssignmentActionInput, TimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { initialTimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { endStaffShiftAssignmentAction } from "@/features/timekeeping/timekeeping-actions";
import { getVietnamBusinessDate } from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingScheduleEntry } from "@/features/timekeeping/types";

const inputClassName = "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";
function initialValues(entry: TimekeepingScheduleEntry): EndStaffShiftAssignmentActionInput { return { effectiveTo: getVietnamBusinessDate(), reason: "", staffShiftAssignmentId: entry.assignmentId }; }

/** Ends an assignment without creating a successor; all date validity remains server-owned. */
export function StaffShiftEndAction({ entry }: { entry: TimekeepingScheduleEntry }) {
  const router = useRouter(); const triggerRef = useRef<HTMLButtonElement>(null); const effectiveToRef = useRef<HTMLInputElement>(null);
  const titleId = useId(); const descriptionId = useId(); const effectiveToId = useId(); const reasonId = useId();
  const [isOpen, setIsOpen] = useState(false); const [values, setValues] = useState<EndStaffShiftAssignmentActionInput>(() => initialValues(entry)); const [actionState, setActionState] = useState<TimekeepingManagementActionState>(initialTimekeepingManagementActionState); const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error"; const errors = actionState.status === "error" ? actionState.fieldErrors ?? {} : {};
  const open = (): void => { setValues(initialValues(entry)); setActionState(initialTimekeepingManagementActionState); setIsOpen(true); };
  const close = (): void => { if (isInteractionLocked) return; setIsOpen(false); setActionState(initialTimekeepingManagementActionState); };
  const submit = (): void => { if (isInteractionLocked) return; setActionState(initialTimekeepingManagementActionState); startTransition(async () => { const result = await endStaffShiftAssignmentAction(values); setActionState(result); if (result.status === "success") { setIsOpen(false); router.refresh(); } }); };
  const onSubmit = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); submit(); };
  const effectiveToErrorId = `${effectiveToId}-error`; const reasonErrorId = `${reasonId}-error`;
  return <><Button className="min-h-11 w-full" onClick={open} ref={triggerRef} type="button" variant="ghost">Kết thúc lịch</Button><Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-lg" initialFocusRef={effectiveToRef} isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}><div className="p-4 sm:p-5"><h2 className="text-section-title text-text-strong" id={titleId}>Kết thúc lịch phân công</h2><p className="mt-1 text-secondary text-text-muted" id={descriptionId}>Lịch sẽ ngừng hiệu lực và được giữ nguyên trong dữ liệu. Thao tác này không tạo lịch thay thế.</p><form className="mt-5 grid gap-4" onSubmit={onSubmit}><div className="grid gap-1.5"><label className="text-label text-text-default" htmlFor={effectiveToId}>Ngày kết thúc hiệu lực</label><input aria-describedby={errors.effectiveTo?.[0] ? effectiveToErrorId : undefined} aria-invalid={Boolean(errors.effectiveTo?.[0])} className={inputClassName} disabled={isInteractionLocked} id={effectiveToId} onChange={(event) => setValues((current) => ({ ...current, effectiveTo: event.target.value }))} ref={effectiveToRef} required type="date" value={values.effectiveTo} />{errors.effectiveTo?.[0] ? <p className="text-caption font-medium text-danger" id={effectiveToErrorId}>{errors.effectiveTo[0]}</p> : null}</div><div className="grid gap-1.5"><label className="text-label text-text-default" htmlFor={reasonId}>Lý do kết thúc</label><textarea aria-describedby={errors.reason?.[0] ? reasonErrorId : undefined} aria-invalid={Boolean(errors.reason?.[0])} className={`${inputClassName} min-h-24 resize-y py-3`} disabled={isInteractionLocked} id={reasonId} maxLength={2000} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} required value={values.reason} />{errors.reason?.[0] ? <p className="text-caption font-medium text-danger" id={reasonErrorId}>{errors.reason[0]}</p> : null}</div>{actionState.status === "error" ? <ResultBanner description={actionState.message} title="Không thể kết thúc lịch phân công" tone="error" /> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button className="min-h-11" disabled={isInteractionLocked} onClick={close} type="button" variant="ghost">Hủy</Button><Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} type="submit">{isInteractionLocked ? "Đang kết thúc phân công…" : "Xác nhận kết thúc"}</Button></div></form></div></Dialog></>;
}
