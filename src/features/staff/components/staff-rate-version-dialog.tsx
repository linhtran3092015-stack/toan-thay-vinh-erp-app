"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createStaffRateVersionAction } from "@/features/staff/staff-actions";
import {
  initialStaffManagementActionState,
  type StaffManagementActionState,
} from "@/features/staff/staff-action-types";

interface StaffRateVersionDialogProps {
  staffId: string;
}

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

/** Presents the existing append-only rate workflow; Staff owns all mutation policy. */
export function StaffRateVersionDialog({
  staffId,
}: StaffRateVersionDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const effectiveFromRef = useRef<HTMLInputElement>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const effectiveFromId = useId();
  const offlineRateId = useId();
  const offlineRateHintId = useId();
  const noteId = useId();
  const reasonId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [offlineHourlyRateVnd, setOfflineHourlyRateVnd] = useState(0);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<StaffManagementActionState>(
    initialStaffManagementActionState,
  );
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error";
  const fieldErrors = actionState.status === "error" ? actionState.fieldErrors ?? {} : {};

  const closeDialog = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setIsOpen(false);
    setActionState(initialStaffManagementActionState);
  };

  const openDialog = (): void => {
    setEffectiveFrom("");
    setOfflineHourlyRateVnd(0);
    setNote("");
    setReason("");
    setActionState(initialStaffManagementActionState);
    setIsOpen(true);
  };

  const handleSubmit = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setActionState(initialStaffManagementActionState);
    startTransition(async () => {
      const result = await createStaffRateVersionAction({
        effectiveFrom,
        note,
        offlineHourlyRateVnd,
        reason,
        staffId,
      });

      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        className="min-h-11"
        onClick={openDialog}
        ref={triggerRef}
        type="button"
        variant="secondary"
      >
        Thêm phiên bản đơn giá
      </Button>

      <Dialog
        ariaDescribedBy={dialogDescriptionId}
        ariaLabelledBy={dialogTitleId}
        className="max-w-lg"
        initialFocusRef={effectiveFromRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <div>
            <h2 className="text-section-title text-text-strong" id={dialogTitleId}>
              Thêm phiên bản đơn giá
            </h2>
            <p className="mt-1 text-secondary text-text-muted" id={dialogDescriptionId}>
              Lưu sẽ tạo một phiên bản đơn giá mới và không thể chỉnh sửa sau đó.
              Mức online được xem trước bằng 50% mức offline.
            </p>
          </div>

          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <InputField
              disabled={isInteractionLocked}
              error={fieldErrors.effectiveFrom?.[0]}
              id={effectiveFromId}
              inputRef={effectiveFromRef}
              label="Hiệu lực từ"
              onChange={setEffectiveFrom}
              required
              type="date"
              value={effectiveFrom}
            />
            <InputField
              disabled={isInteractionLocked}
              error={fieldErrors.offlineHourlyRateVnd?.[0]}
              helpId={offlineRateHintId}
              helpText="Nhập số nguyên VND không âm và là số chẵn để xem trước mức online 50%."
              id={offlineRateId}
              label="Đơn giá offline / giờ (VND)"
              min={0}
              onChange={(value) => setOfflineHourlyRateVnd(Number(value))}
              required
              step={2}
              type="number"
              value={offlineHourlyRateVnd}
            />
            <div className="rounded-md border border-info-border bg-info-bg px-3 py-3">
              <p className="text-label text-info">Đơn giá online / giờ (xem trước)</p>
              <p className="mt-1 tabular-nums text-secondary font-semibold text-text-strong">
                {moneyFormatter.format(offlineHourlyRateVnd / 2)}
              </p>
            </div>
            <TextAreaField
              disabled={isInteractionLocked}
              error={fieldErrors.note?.[0]}
              id={noteId}
              label="Ghi chú"
              maxLength={1000}
              onChange={setNote}
              value={note}
            />
            <TextAreaField
              disabled={isInteractionLocked}
              error={fieldErrors.reason?.[0]}
              id={reasonId}
              label="Lý do thêm phiên bản"
              maxLength={2000}
              onChange={setReason}
              required
              value={reason}
            />

            {actionState.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title="Không thể thêm phiên bản đơn giá"
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                className="min-h-11"
                disabled={isInteractionLocked}
                onClick={closeDialog}
                type="button"
                variant="ghost"
              >
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} type="submit">
                {isInteractionLocked ? "Đang lưu..." : "Thêm phiên bản"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function InputField({
  disabled,
  error,
  helpId,
  helpText,
  id,
  inputRef,
  label,
  min,
  onChange,
  required = false,
  step,
  type,
  value,
}: {
  disabled: boolean;
  error?: string;
  helpId?: string;
  helpText?: string;
  id: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  label: string;
  min?: number;
  onChange: (value: string) => void;
  required?: boolean;
  step?: number;
  type: "date" | "number";
  value: number | string;
}) {
  const errorId = `${id}-error`;
  const describedBy = [helpId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <label className="text-label text-text-default" htmlFor={id}>{label}</label>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        className={inputClassName}
        disabled={disabled}
        id={id}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        required={required}
        step={step}
        type={type}
        value={value}
      />
      {helpText ? <p className="text-caption text-text-muted" id={helpId}>{helpText}</p> : null}
      {error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : null}
    </div>
  );
}

function TextAreaField({
  disabled,
  error,
  id,
  label,
  maxLength,
  onChange,
  required = false,
  value,
}: {
  disabled: boolean;
  error?: string;
  id: string;
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-1.5">
      <label className="text-label text-text-default" htmlFor={id}>{label}</label>
      <textarea
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className={`${inputClassName} min-h-24 resize-y py-3`}
        disabled={disabled}
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
      {error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : null}
    </div>
  );
}
