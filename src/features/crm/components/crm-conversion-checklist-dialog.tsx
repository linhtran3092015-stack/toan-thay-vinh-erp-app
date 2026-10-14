"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { convertStudentAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionOverrides } from "@/features/crm/crm-action-overrides";
import { CRM_ACCOUNTANT_CONFIRM_HINT } from "@/features/crm/crm-presentation";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";
import type { EnrollmentChecklistReadModel } from "@/features/crm/read-models";

interface CrmConversionChecklistDialogProps {
  action?: CrmActionOverrides["convertStudent"];
  checklist: EnrollmentChecklistReadModel | null;
  classes: { id: string; name: string; code: string }[];
  crmCaseId: string;
  hasAccountantPermission: boolean;
  /** Primary only when the lead waits for enrollment confirmation (one primary per page). */
  triggerVariant?: "primary" | "secondary";
}

/** The conversion RPC accepts only these registered modes (REGISTERED_MODE_INVALID otherwise). */
type RegisteredMode = "online" | "offline";
const fieldClassName = "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

export function CrmConversionChecklistDialog({ action = convertStudentAction, checklist, classes, crmCaseId, hasAccountantPermission, triggerVariant = "primary" }: CrmConversionChecklistDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [officialStartDate, setOfficialStartDate] = useState("");
  const [registeredMode, setRegisteredMode] = useState<RegisteredMode>("offline");
  const [items, setItems] = useState({ item10CommunicationGroupReady: checklist?.item10CommunicationGroupReady ?? false, item1PaymentReceived: checklist?.item1PaymentReceived ?? false, item2SourceConfirmed: checklist?.item2SourceConfirmed ?? false, item3SaleConfirmed: checklist?.item3SaleConfirmed ?? false, item4ClassSelected: checklist?.item4ClassSelected ?? false, item5ModeConfirmed: checklist?.item5ModeConfirmed ?? false, item6FeeConfirmed: checklist?.item6FeeConfirmed ?? false, item7AssistantSessionsConfirmed: checklist?.item7AssistantSessionsConfirmed ?? false, item8AccountantTransactionConfirmed: checklist?.item8AccountantTransactionConfirmed ?? false, item9OfficialStartDateEntered: checklist?.item9OfficialStartDateEntered ?? false });
  const [actionState, setActionState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => { if (!isPending) setIsOpen(false); };
  const toggleItem = (key: keyof typeof items) => { if (key !== "item8AccountantTransactionConfirmed" || hasAccountantPermission) setItems((previous) => ({ ...previous, [key]: !previous[key] })); };
  const allChecked = Object.values(items).every(Boolean);
  const handleConvert = () => {
    if (isPending) return;
    setActionState(null);
    startTransition(async () => {
      const result = await action({ checklistItems: items, classId, crmCaseId, officialStartDate, registeredMode });
      setActionState(result);
      if (result.status === "success") { setIsOpen(false); router.refresh(); }
    });
  };
  return <>
    <Button onClick={() => { setActionState(null); setIsOpen(true); }} ref={triggerRef} variant={triggerVariant}>Xác nhận chuyển đổi</Button>
    <Dialog ariaDescribedBy="crm-conversion-dialog-description" ariaLabelledBy="crm-conversion-dialog-title" className="max-w-2xl" isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
      <div className="grid gap-5 p-5 sm:p-6"><div><h2 className="text-section-title font-semibold text-text-strong" id="crm-conversion-dialog-title">Xác nhận chuyển thành học viên chính thức</h2><p className="mt-1 text-secondary text-text-muted" id="crm-conversion-dialog-description">Thao tác chỉ hoàn tất khi đủ 10 tiêu chí checklist theo quy trình hiện có.</p></div>
        {actionState?.status === "error" ? <ResultBanner title={actionState.message} tone="error" /> : null}
        <section className="grid gap-4 rounded-lg border border-border-subtle bg-surface-sunken p-4 sm:grid-cols-2"><SelectField label="Chọn lớp chính thức" required value={classId} onChange={(value) => { setClassId(value); if (value) setItems((previous) => ({ ...previous, item4ClassSelected: true })); }}><option value="">-- Chọn lớp học --</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</SelectField><Field label="Ngày bắt đầu học chính" required><input className={fieldClassName} disabled={isPending} id="crm-conversion-start-date" onChange={(event) => { setOfficialStartDate(event.target.value); if (event.target.value) setItems((previous) => ({ ...previous, item9OfficialStartDateEntered: true })); }} type="date" value={officialStartDate} /></Field><SelectField className="sm:col-span-2" label="Hình thức đăng ký" required value={registeredMode} onChange={(value) => { setRegisteredMode(value as RegisteredMode); setItems((previous) => ({ ...previous, item5ModeConfirmed: true })); }}><option value="offline">Offline (Tại trung tâm)</option><option value="online">Online (Trực tuyến)</option></SelectField></section>
        <section className="grid gap-2"><h3 className="text-body font-semibold text-text-strong">Checklist nhập học</h3><ChecklistItem checked={items.item1PaymentReceived} disabled={isPending} label="1. Đã nhận học phí ban đầu" onToggle={() => toggleItem("item1PaymentReceived")} /><ChecklistItem checked={items.item2SourceConfirmed} disabled={isPending} label="2. Đã xác nhận nguồn lead" onToggle={() => toggleItem("item2SourceConfirmed")} /><ChecklistItem checked={items.item3SaleConfirmed} disabled={isPending} label="3. Đã xác nhận nhân sự Sale chốt" onToggle={() => toggleItem("item3SaleConfirmed")} /><ChecklistItem checked={items.item4ClassSelected} disabled={isPending} label="4. Đã chọn lớp chính" onToggle={() => toggleItem("item4ClassSelected")} /><ChecklistItem checked={items.item5ModeConfirmed} disabled={isPending} label="5. Đã xác nhận hình thức online/offline" onToggle={() => toggleItem("item5ModeConfirmed")} /><ChecklistItem checked={items.item6FeeConfirmed} disabled={isPending} label="6. Đã xác nhận mức học phí và ưu đãi" onToggle={() => toggleItem("item6FeeConfirmed")} /><ChecklistItem checked={items.item7AssistantSessionsConfirmed} disabled={isPending} label="7. Trợ lý đã xác nhận số buổi học" onToggle={() => toggleItem("item7AssistantSessionsConfirmed")} /><ChecklistItem checked={items.item8AccountantTransactionConfirmed} disabled={isPending || !hasAccountantPermission} hint={!hasAccountantPermission ? CRM_ACCOUNTANT_CONFIRM_HINT : undefined} label="8. Kế toán xác nhận giao dịch học phí" onToggle={() => toggleItem("item8AccountantTransactionConfirmed")} /><ChecklistItem checked={items.item9OfficialStartDateEntered} disabled={isPending} label="9. Đã nhập ngày học chính thức" onToggle={() => toggleItem("item9OfficialStartDateEntered")} /><ChecklistItem checked={items.item10CommunicationGroupReady} disabled={isPending} label="10. Sổ liên lạc / Nhóm Zalo phụ huynh đã sẵn sàng" onToggle={() => toggleItem("item10CommunicationGroupReady")} /></section>
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-secondary text-text-muted">{allChecked ? "Đã đủ 10 tiêu chí checklist." : "Chưa đủ 10 tiêu chí checklist."}</p><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button disabled={isPending} onClick={close} variant="outline">Hủy</Button><Button disabled={isPending || !allChecked || !classId || !officialStartDate} onClick={handleConvert}>{isPending ? "Đang xử lý…" : "Xác nhận chuyển đổi"}</Button></div></div>
      </div>
    </Dialog>
  </>;
}

function Field({ children, label, required = false }: { children: React.ReactNode; label: string; required?: boolean }) { const id = typeof children === "object" && children && "props" in children ? (children as { props: { id?: string } }).props.id : undefined; return <div className="grid gap-1.5"><label className="text-label font-medium text-text-muted" htmlFor={id}>{label}{required ? <span aria-hidden="true" className="text-danger"> *</span> : null}</label>{children}</div>; }
function SelectField({ children, className, label, onChange, required = false, value }: { children: React.ReactNode; className?: string; label: string; onChange: (value: string) => void; required?: boolean; value: string }) { const id = `crm-conversion-${label.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}`; return <div className={`grid gap-1.5 ${className ?? ""}`}><label className="text-label font-medium text-text-muted" htmlFor={id}>{label}{required ? <span aria-hidden="true" className="text-danger"> *</span> : null}</label><select className={fieldClassName} id={id} onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></div>; }
function ChecklistItem({ checked, disabled, hint, label, onToggle }: { checked: boolean; disabled: boolean; hint?: string; label: string; onToggle: () => void }) { const id = `crm-checklist-${label.slice(0, 2).replace(/\D/g, "")}`; return <div className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-base px-3 py-2.5"><input aria-describedby={hint ? `${id}-hint` : undefined} checked={checked} className="mt-0.5 h-4 w-4 accent-[var(--action-primary)]" disabled={disabled} id={id} onChange={onToggle} type="checkbox" /><div className="min-w-0"><label className="text-body text-text-default" htmlFor={id}>{label}</label>{hint ? <p className="mt-1 text-caption text-warning" id={`${id}-hint`}>{hint}</p> : null}</div></div>; }
