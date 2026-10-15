"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useRef, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type {
  TimekeepingAdjustmentActionState,
  TimekeepingAdjustmentRequestInput,
} from "@/features/timekeeping/timekeeping-adjustment-action-types";
import { initialTimekeepingAdjustmentActionState } from "@/features/timekeeping/timekeeping-adjustment-action-types";
import { requestTimeEntryAdjustmentAction } from "@/features/timekeeping/timekeeping-adjustment-actions";
import {
  formatVietnamDate,
  formatVietnamDateTimeInput,
  getTimeEntryModeLabel,
  vietnamDatetimeInputToIso,
} from "@/features/timekeeping/timekeeping-adjustment-utils";
import type { TimekeepingActionOverrides } from "@/features/timekeeping/timekeeping-action-overrides";
import {
  formatShortWorkDate,
  formatVietnamClockTime,
} from "@/features/timekeeping/timekeeping-staff-presentation";
import type { TimekeepingAdjustableEntry } from "@/features/timekeeping/types";

interface TimekeepingAdjustmentRequestDialogProps {
  /** Inert replacements for the /dev/timekeeping preview; real pages pass nothing. */
  actions?: TimekeepingActionOverrides;
  entries: readonly TimekeepingAdjustableEntry[];
  /** Entry selected when the sheet opens (a shift card's own trigger); defaults to the first. */
  initialEntryId?: string;
  /**
   * Called with the entry the request was sent for, after the server accepted
   * it (the sheet has closed and the route refreshes). The entry can differ
   * from `initialEntryId`: the sheet's entry select stays editable.
   */
  onSubmitted?: (timeEntryId: string) => void;
  /** Accessible name when the visible label is shared by several triggers. */
  triggerAriaLabel?: string;
  triggerClassName?: string;
  triggerVariant?: ButtonVariant;
}

// Theme tokens (the shared timekeeping form class is light-only).
const inputClassName =
  "min-h-11 w-full rounded-md border border-border-strong bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-border-focus focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

interface AdjustmentFormValues {
  requestReason: string;
  requestedCheckInAt: string;
  requestedCheckInMode: "online" | "offline";
  requestedCheckOutAt: string;
  requestedCheckOutMode: "online" | "offline";
  timeEntryId: string;
}

function getInitialValues(entry?: TimekeepingAdjustableEntry): AdjustmentFormValues {
  return {
    requestReason: "",
    requestedCheckInAt: entry ? formatVietnamDateTimeInput(entry.checkInAt) : "",
    requestedCheckInMode: entry?.checkInMode ?? "offline",
    requestedCheckOutAt: entry ? formatVietnamDateTimeInput(entry.checkOutAt) : "",
    requestedCheckOutMode:
      entry?.checkOutMode === "online" ? "online" : "offline",
    timeEntryId: entry?.id ?? "",
  };
}

export function TimekeepingAdjustmentRequestDialog({
  actions,
  entries,
  initialEntryId,
  onSubmitted,
  triggerAriaLabel,
  triggerClassName,
  triggerVariant,
}: TimekeepingAdjustmentRequestDialogProps) {
  const router = useRouter();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<AdjustmentFormValues>(() =>
    getInitialValues(),
  );
  const [actionState, setActionState] = useState<TimekeepingAdjustmentActionState>(
    initialTimekeepingAdjustmentActionState,
  );
  const isInteractionLocked =
    isPending && actionState.status !== "error";

  // Authoritative entry selection uses server-returned entries directly (no client eligibility filtering).
  const selectedEntry = entries.find(
    (entry) => entry.id === values.timeEntryId,
  );

  const openDialog = (): void => {
    setValues(getInitialValues(
      entries.find((entry) => entry.id === initialEntryId) ?? entries[0],
    ));
    setActionState(initialTimekeepingAdjustmentActionState);
    setIsOpen(true);
  };

  const selectEntry = (timeEntryId: string): void => {
    const entry = entries.find(
      (candidate) => candidate.id === timeEntryId,
    );

    setValues(getInitialValues(entry));
    setActionState(initialTimekeepingAdjustmentActionState);
  };

  const updateValue = <Key extends keyof AdjustmentFormValues>(
    key: Key,
    value: AdjustmentFormValues[Key],
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const closeDialog = (): void => {
    if (!isInteractionLocked) {
      setIsOpen(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isInteractionLocked) {
      return;
    }

    if (!values.requestedCheckInAt || !values.requestedCheckOutAt) {
      setActionState({
        message: "Cần nhập đủ thời điểm check-in và check-out đề xuất.",
        status: "error",
      });
      return;
    }

    const isoIn = vietnamDatetimeInputToIso(values.requestedCheckInAt);
    const isoOut = vietnamDatetimeInputToIso(values.requestedCheckOutAt);

    // Simple input chronology validation: check-out must not precede check-in (<, not <=).
    if (isoOut < isoIn) {
      setActionState({
        fieldErrors: {
          requestedCheckOutAt: [
            "Check-out đề xuất không được trước check-in đề xuất.",
          ],
        },
        message: "Vui lòng kiểm tra lại thời gian check-in và check-out đề xuất.",
        status: "error",
      });
      return;
    }

    const input: TimekeepingAdjustmentRequestInput = {
      requestReason: values.requestReason,
      requestedCheckInAt: isoIn,
      requestedCheckInMode: values.requestedCheckInMode,
      requestedCheckOutAt: isoOut,
      requestedCheckOutMode: values.requestedCheckOutMode,
      timeEntryId: values.timeEntryId,
    };

    setActionState(initialTimekeepingAdjustmentActionState);

    startTransition(async () => {
      try {
        const result = await (actions?.requestTimeEntryAdjustment ?? requestTimeEntryAdjustmentAction)(input);
        setActionState(result);

        if (result.status === "success") {
          setIsOpen(false);
          router.refresh();
          onSubmitted?.(input.timeEntryId);
        }
      } catch {
        // A lost connection must not reach the route error page and wipe the
        // typed reason; the request may not have been saved, so say so.
        setActionState({
          message: "Chưa có xác nhận từ hệ thống. Tải lại trang và xem mục Điều chỉnh chấm công; nếu chưa có yêu cầu chờ duyệt thì gửi lại.",
          status: "error",
        });
      }
    });
  };

  return (
    <>
      <Button
        aria-label={triggerAriaLabel}
        className={triggerClassName}
        disabled={entries.length === 0}
        onClick={openDialog}
        ref={openButtonRef}
        size="lg"
        variant={triggerVariant}
      >
        Yêu cầu điều chỉnh
      </Button>

      {/* Mounted only while open: a month can hold one closed sheet per card. */}
      {isOpen ? <Dialog
        ariaDescribedBy="adj-request-dialog-desc"
        ariaLabelledBy="adj-request-dialog-title"
        className="sm:max-w-2xl"
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={openButtonRef}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong-hover sm:hidden" />
        <form className="grid gap-4 p-4 pb-[calc(16px+var(--safe-area-bottom))] sm:gap-5 sm:p-5" onSubmit={handleSubmit}>
          <div>
            <h2
              className="text-section-title font-semibold text-text-strong"
              id="adj-request-dialog-title"
            >
              Yêu cầu điều chỉnh công
            </h2>
            <p
              className="mt-1 text-secondary text-text-muted"
              id="adj-request-dialog-desc"
            >
              Dữ liệu chấm công gốc được giữ nguyên. Thời điểm đề xuất hiển
              thị theo giờ Việt Nam.
            </p>
            {selectedEntry ? (
              <p className="mt-1 text-label font-medium text-text-default tabular-nums">
                {formatShortWorkDate(selectedEntry.workDate)} · ghi nhận{" "}
                {formatVietnamClockTime(selectedEntry.checkInAt)} →{" "}
                {formatVietnamClockTime(selectedEntry.checkOutAt)}
                {selectedEntry.checkOutMode === "auto_end" ? " (tự động kết thúc)" : ""}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4">
            <FormField
              error={actionState.fieldErrors?.timeEntryId?.[0]}
              errorId="adj-request-entry-id-error"
              id="adj-request-entry-id"
              label="Lượt chấm công cần điều chỉnh"
            >
              <select
                aria-describedby={
                  actionState.fieldErrors?.timeEntryId?.[0]
                    ? "adj-request-entry-id-error"
                    : undefined
                }
                aria-invalid={
                  actionState.fieldErrors?.timeEntryId?.[0] ? true : undefined
                }
                className={inputClassName}
                disabled={isInteractionLocked}
                id="adj-request-entry-id"
                onChange={(event) => selectEntry(event.target.value)}
                value={values.timeEntryId}
              >
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {formatVietnamDate(entry.workDate)} · {entry.workShiftName
                      ? `${entry.workShiftCode ? `${entry.workShiftCode} · ` : ""}${entry.workShiftName}`
                      : "Không có ca được phân công"}
                  </option>
                ))}
              </select>
            </FormField>

            {selectedEntry ? (
              <div
                className="rounded-md border border-border-subtle bg-surface-raised p-4 text-sm max-sm:hidden"
                role="note"
              >
                <p className="font-semibold text-text-strong">Dữ liệu gốc</p>
                <p className="mt-1 leading-6 text-text-muted">
                  Check-in{" "}
                  {formatVietnamDateTimeInput(selectedEntry.checkInAt).replace(
                    "T",
                    " ",
                  )}{" "}
                  · {getTimeEntryModeLabel(selectedEntry.checkInMode)}
                  <br />
                  Check-out{" "}
                  {formatVietnamDateTimeInput(selectedEntry.checkOutAt).replace(
                    "T",
                    " ",
                  )}{" "}
                  · {getTimeEntryModeLabel(selectedEntry.checkOutMode)}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                error={actionState.fieldErrors?.requestedCheckInAt?.[0]}
                errorId="adj-request-checkin-at-error"
                id="adj-request-checkin-at"
                label="Check-in đề xuất"
              >
                <input
                  aria-describedby={
                    actionState.fieldErrors?.requestedCheckInAt?.[0]
                      ? "adj-request-checkin-at-error"
                      : undefined
                  }
                  aria-invalid={
                    actionState.fieldErrors?.requestedCheckInAt?.[0]
                      ? true
                      : undefined
                  }
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id="adj-request-checkin-at"
                  onChange={(event) =>
                    updateValue("requestedCheckInAt", event.target.value)
                  }
                  type="datetime-local"
                  value={values.requestedCheckInAt}
                />
              </FormField>

              <FormField
                error={actionState.fieldErrors?.requestedCheckInMode?.[0]}
                errorId="adj-request-checkin-mode-error"
                id="adj-request-checkin-mode"
                label="Hình thức check-in"
              >
                <select
                  aria-describedby={
                    actionState.fieldErrors?.requestedCheckInMode?.[0]
                      ? "adj-request-checkin-mode-error"
                      : undefined
                  }
                  aria-invalid={
                    actionState.fieldErrors?.requestedCheckInMode?.[0]
                      ? true
                      : undefined
                  }
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id="adj-request-checkin-mode"
                  onChange={(event) =>
                    updateValue(
                      "requestedCheckInMode",
                      event.target
                        .value as AdjustmentFormValues["requestedCheckInMode"],
                    )
                  }
                  value={values.requestedCheckInMode}
                >
                  <option value="offline">Tại trung tâm</option>
                  <option value="online">Trực tuyến</option>
                </select>
              </FormField>

              <FormField
                error={actionState.fieldErrors?.requestedCheckOutAt?.[0]}
                errorId="adj-request-checkout-at-error"
                id="adj-request-checkout-at"
                label="Check-out đề xuất"
              >
                <input
                  aria-describedby={
                    actionState.fieldErrors?.requestedCheckOutAt?.[0]
                      ? "adj-request-checkout-at-error"
                      : undefined
                  }
                  aria-invalid={
                    actionState.fieldErrors?.requestedCheckOutAt?.[0]
                      ? true
                      : undefined
                  }
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id="adj-request-checkout-at"
                  onChange={(event) =>
                    updateValue("requestedCheckOutAt", event.target.value)
                  }
                  type="datetime-local"
                  value={values.requestedCheckOutAt}
                />
              </FormField>

              <FormField
                error={actionState.fieldErrors?.requestedCheckOutMode?.[0]}
                errorId="adj-request-checkout-mode-error"
                id="adj-request-checkout-mode"
                label="Hình thức check-out"
              >
                <select
                  aria-describedby={
                    actionState.fieldErrors?.requestedCheckOutMode?.[0]
                      ? "adj-request-checkout-mode-error"
                      : undefined
                  }
                  aria-invalid={
                    actionState.fieldErrors?.requestedCheckOutMode?.[0]
                      ? true
                      : undefined
                  }
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id="adj-request-checkout-mode"
                  onChange={(event) =>
                    updateValue(
                      "requestedCheckOutMode",
                      event.target
                        .value as AdjustmentFormValues["requestedCheckOutMode"],
                    )
                  }
                  value={values.requestedCheckOutMode}
                >
                  <option value="offline">Tại trung tâm</option>
                  <option value="online">Trực tuyến</option>
                </select>
              </FormField>
            </div>

            <FormField
              error={actionState.fieldErrors?.requestReason?.[0]}
              errorId="adj-request-reason-error"
              id="adj-request-reason"
              label="Lý do điều chỉnh"
              required
            >
              <textarea
                aria-describedby={
                  actionState.fieldErrors?.requestReason?.[0]
                    ? "adj-request-reason-error"
                    : undefined
                }
                aria-invalid={
                  actionState.fieldErrors?.requestReason?.[0]
                    ? true
                    : undefined
                }
                aria-required="true"
                className={`${inputClassName} min-h-28 py-3`}
                disabled={isInteractionLocked}
                id="adj-request-reason"
                maxLength={2000}
                onChange={(event) =>
                  updateValue("requestReason", event.target.value)
                }
                placeholder="Nêu rõ lý do và thời điểm cần điều chỉnh"
                required
                value={values.requestReason}
              />
            </FormField>
          </div>

          <p className="text-caption text-text-muted">
            Mỗi lượt chấm công chỉ có một yêu cầu chờ duyệt; đã duyệt thì
            không gửi thêm. Quản lý duyệt hoặc từ chối kèm lý do; kết quả hiện
            trong bảng công.
          </p>

          {actionState.status === "error" && actionState.message ? (
            <ResultBanner title={actionState.message} tone="error" />
          ) : null}

          <div className="flex gap-2 sm:justify-end sm:gap-3">
            <Button
              className="flex-1 sm:flex-none"
              disabled={isInteractionLocked}
              onClick={closeDialog}
              size="lg"
              type="button"
              variant="secondary"
            >
              Hủy
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              disabled={!selectedEntry}
              isLoading={isInteractionLocked}
              size="lg"
              type="submit"
            >
              {isInteractionLocked ? "Đang gửi yêu cầu..." : "Gửi yêu cầu"}
            </Button>
          </div>
        </form>
      </Dialog> : null}
    </>
  );
}

function FormField({
  children,
  error,
  errorId,
  id,
  label,
  required,
}: {
  children: ReactNode;
  error?: string;
  errorId: string;
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-text-strong" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <span className="text-xs font-medium text-danger" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
