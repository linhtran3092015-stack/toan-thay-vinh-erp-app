"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { configureStaffPayrollCompensationAction } from "@/features/staff/staff-actions";
import {
  payrollPositionCodes,
  payrollPositionLabels,
  type PayrollPositionCode,
} from "@/features/staff/payroll-profile-types";
import {
  initialStaffManagementActionState,
  type StaffManagementActionState,
} from "@/features/staff/staff-action-types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

export function StaffPayrollCompensationDialog({ staffId }: { staffId: string }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [positionCode, setPositionCode] = useState<PayrollPositionCode>("teaching_assistant");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [offlineDailyRateVnd, setOfflineDailyRateVnd] = useState(0);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<StaffManagementActionState>(initialStaffManagementActionState);
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
      const result = await configureStaffPayrollCompensationAction({
        effectiveFrom,
        note,
        offlineDailyRateVnd,
        positionCode,
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
      <Button onClick={() => setIsOpen(true)} ref={triggerRef} type="button">
        Thêm cấu hình lương
      </Button>
      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-xl"
        initialFocusRef={firstFieldRef}
        isOpen={isOpen}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        <form className="grid gap-4 p-4 sm:p-5" onSubmit={submit}>
          <div>
            <h2 className="text-section-title text-text-strong" id={titleId}>Cấu hình vị trí và lương ngày</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Mỗi lần lưu tạo một phiên bản mới theo ngày hiệu lực. Một ngày công tương đương 9 giờ.
            </p>
          </div>

          <Field label="Vị trí tính lương" error={state.fieldErrors?.positionCode?.[0]}>
            <select
              className={inputClassName}
              disabled={locked}
              onChange={(event) => setPositionCode(event.target.value as PayrollPositionCode)}
              ref={firstFieldRef}
              value={positionCode}
            >
              {payrollPositionCodes.map((code) => <option key={code} value={code}>{payrollPositionLabels[code]}</option>)}
            </select>
          </Field>
          <Field label="Hiệu lực từ" error={state.fieldErrors?.effectiveFrom?.[0]}>
            <input className={inputClassName} disabled={locked} onChange={(event) => setEffectiveFrom(event.target.value)} required type="date" value={effectiveFrom} />
          </Field>
          <Field label="Lương ngày offline 9 giờ" error={state.fieldErrors?.offlineDailyRateVnd?.[0]}>
            <input className={inputClassName} disabled={locked} min={0} onChange={(event) => setOfflineDailyRateVnd(Number(event.target.value))} required step={1} type="number" value={offlineDailyRateVnd} />
          </Field>
          <div className="rounded-md border border-info-border bg-info-bg px-3 py-3">
            <p className="text-label text-info">Lương ngày online 9 giờ (50%)</p>
            <p className="mt-1 tabular-nums font-semibold text-text-strong">{moneyFormatter.format(offlineDailyRateVnd / 2)}</p>
          </div>
          <Field label="Ghi chú" error={state.fieldErrors?.note?.[0]}>
            <textarea className={`${inputClassName} min-h-20 py-3`} disabled={locked} maxLength={1000} onChange={(event) => setNote(event.target.value)} value={note} />
          </Field>
          <Field label="Lý do thay đổi" error={state.fieldErrors?.reason?.[0]}>
            <textarea className={`${inputClassName} min-h-24 py-3`} disabled={locked} maxLength={2000} onChange={(event) => setReason(event.target.value)} required value={reason} />
          </Field>

          {state.status === "error" ? <ResultBanner description={state.message} title="Không thể lưu cấu hình lương" tone="error" /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={locked} onClick={close} type="button" variant="ghost">Hủy</Button>
            <Button disabled={locked} isLoading={locked} type="submit">{locked ? "Đang lưu…" : "Lưu cấu hình"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return (
    <label className="grid gap-1.5 text-label text-text-default">
      <span>{label}</span>
      {children}
      {error ? <span className="text-caption font-medium text-danger">{error}</span> : null}
    </label>
  );
}
