"use client";

import { useRouter } from "next/navigation";
import { cloneElement, isValidElement, useId, useRef, useState, useTransition, type FormEvent, type ReactElement, type ReactNode } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { TimekeepingManagementActionState, WorkShiftWriteFields } from "@/features/timekeeping/timekeeping-action-types";
import { initialTimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { createWorkShiftAction, updateWorkShiftAction } from "@/features/timekeeping/timekeeping-actions";
import type { TimekeepingWorkShift } from "@/features/timekeeping/types";

interface WorkShiftDialogProps { workShift?: TimekeepingWorkShift; }

const inputClassName = "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function createInitialValues(workShift?: TimekeepingWorkShift): WorkShiftWriteFields {
  return { breakMinutes: workShift?.breakMinutes ?? 0, code: workShift?.code ?? "", crossesMidnight: workShift?.crossesMidnight ?? false, endTime: workShift?.endTime.slice(0, 5) ?? "17:00", name: workShift?.name ?? "", notes: workShift?.notes ?? "", reason: "", startTime: workShift?.startTime.slice(0, 5) ?? "08:00" };
}

/** Presents the existing create/edit bindings. The server owns shift lifecycle rules. */
export function WorkShiftDialog({ workShift }: WorkShiftDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const codeId = useId(); const nameId = useId(); const startTimeId = useId(); const endTimeId = useId(); const breakMinutesId = useId(); const notesId = useId(); const reasonId = useId();
  const isEditing = Boolean(workShift);
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<WorkShiftWriteFields>(() => createInitialValues(workShift));
  const [actionState, setActionState] = useState<TimekeepingManagementActionState>(initialTimekeepingManagementActionState);
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error";
  const fieldErrors = actionState.status === "error" ? actionState.fieldErrors ?? {} : {};

  const openDialog = (): void => { setValues(createInitialValues(workShift)); setActionState(initialTimekeepingManagementActionState); setIsOpen(true); };
  const closeDialog = (): void => { if (isInteractionLocked) return; setIsOpen(false); setActionState(initialTimekeepingManagementActionState); };
  const updateValue = <Key extends keyof WorkShiftWriteFields>(key: Key, value: WorkShiftWriteFields[Key]): void => setValues((current) => ({ ...current, [key]: value }));
  const submit = (): void => {
    if (isInteractionLocked) return;
    setActionState(initialTimekeepingManagementActionState);
    startTransition(async () => {
      const result = workShift ? await updateWorkShiftAction({ ...values, workShiftId: workShift.id }) : await createWorkShiftAction(values);
      setActionState(result);
      if (result.status === "success") { setIsOpen(false); router.refresh(); }
    });
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); submit(); };

  return <>
    <Button className={isEditing ? "min-h-11 w-full" : "min-h-11"} onClick={openDialog} ref={triggerRef} type="button" variant={isEditing ? "outline" : "primary"}>{isEditing ? "Sửa ca" : "Thêm ca làm"}</Button>
    <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-2xl" initialFocusRef={codeRef} isOpen={isOpen} onClose={closeDialog} returnFocusRef={triggerRef}>
      <div className="p-4 sm:p-5"><div><h2 className="text-section-title text-text-strong" id={titleId}>{isEditing ? "Cập nhật ca làm" : "Tạo ca làm"}</h2><p className="mt-1 text-secondary text-text-muted" id={descriptionId}>{isEditing ? "Ca đã có lịch sử phân công sẽ được hệ thống từ chối chỉnh sửa trực tiếp." : "Ca mới sẽ sẵn sàng để phân công sau khi lưu."}</p></div>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <Field error={fieldErrors.code?.[0]} id={codeId} label="Mã ca"><input className={inputClassName} disabled={isInteractionLocked} id={codeId} maxLength={64} onChange={(event) => updateValue("code", event.target.value.toUpperCase())} ref={codeRef} required value={values.code} /></Field>
          <Field error={fieldErrors.name?.[0]} id={nameId} label="Tên ca"><input className={inputClassName} disabled={isInteractionLocked} id={nameId} maxLength={160} onChange={(event) => updateValue("name", event.target.value)} required value={values.name} /></Field>
          <Field error={fieldErrors.startTime?.[0]} id={startTimeId} label="Giờ bắt đầu"><input className={inputClassName} disabled={isInteractionLocked} id={startTimeId} onChange={(event) => updateValue("startTime", event.target.value)} required type="time" value={values.startTime} /></Field>
          <Field error={fieldErrors.endTime?.[0]} id={endTimeId} label="Giờ kết thúc"><input className={inputClassName} disabled={isInteractionLocked} id={endTimeId} onChange={(event) => updateValue("endTime", event.target.value)} required type="time" value={values.endTime} /></Field>
          <Field error={fieldErrors.breakMinutes?.[0]} id={breakMinutesId} label="Nghỉ giữa ca (phút)"><input className={inputClassName} disabled={isInteractionLocked} id={breakMinutesId} min={0} onChange={(event) => updateValue("breakMinutes", Number(event.target.value))} required type="number" value={values.breakMinutes} /></Field>
          <label className="flex min-h-11 items-center gap-3 rounded-md border border-border-subtle px-3 text-label text-text-default"><input checked={values.crossesMidnight} disabled={isInteractionLocked} onChange={(event) => updateValue("crossesMidnight", event.target.checked)} type="checkbox" />Ca kết thúc vào ngày hôm sau</label>
          <Field className="sm:col-span-2" error={fieldErrors.notes?.[0]} id={notesId} label="Ghi chú"><textarea className={`${inputClassName} min-h-24 resize-y py-3`} disabled={isInteractionLocked} id={notesId} maxLength={2000} onChange={(event) => updateValue("notes", event.target.value)} value={values.notes} /></Field>
          <Field className="sm:col-span-2" error={fieldErrors.reason?.[0]} id={reasonId} label="Lý do thao tác"><textarea className={`${inputClassName} min-h-24 resize-y py-3`} disabled={isInteractionLocked} id={reasonId} maxLength={2000} onChange={(event) => updateValue("reason", event.target.value)} required value={values.reason} /></Field>
          {actionState.status === "error" ? <ResultBanner className="sm:col-span-2" description={actionState.message} title={isEditing ? "Không thể cập nhật ca làm" : "Không thể tạo ca làm"} tone="error" /> : null}
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end"><Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} type="button" variant="ghost">Hủy</Button><Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} type="submit">{isInteractionLocked ? isEditing ? "Đang cập nhật ca…" : "Đang tạo ca…" : isEditing ? "Lưu ca làm" : "Tạo ca làm"}</Button></div>
        </form>
      </div>
    </Dialog>
  </>;
}

function Field({ children, className, error, id, label }: { children: ReactNode; className?: string; error?: string; id: string; label: string }) {
  const errorId = `${id}-error`;
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>, { "aria-describedby": error ? errorId : undefined, "aria-invalid": Boolean(error) }) : children;
  return <div className={`grid gap-1.5 ${className ?? ""}`}><label className="text-label text-text-default" htmlFor={id}>{label}</label>{control}{error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : null}</div>;
}
