"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useRef, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
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
import { formInputClassName } from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingAdjustableEntry } from "@/features/timekeeping/types";

interface TimekeepingAdjustmentRequestDialogProps {
  entries: readonly TimekeepingAdjustableEntry[];
}

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
  entries,
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
    setValues(getInitialValues(entries[0]));
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
      const result = await requestTimeEntryAdjustmentAction(input);
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
        disabled={entries.length === 0}
        onClick={openDialog}
        ref={openButtonRef}
        size="lg"
      >
        Yêu cầu điều chỉnh
      </Button>

      <Dialog
        ariaDescribedBy="adj-request-dialog-desc"
        ariaLabelledBy="adj-request-dialog-title"
        className="sm:max-w-2xl"
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={openButtonRef}
      >
        <form className="grid gap-5 p-5" onSubmit={handleSubmit}>
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
                className={formInputClassName}
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
                className="rounded-md border border-border-subtle bg-surface-raised p-4 text-sm"
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
                  className={formInputClassName}
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
                  className={formInputClassName}
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
                  className={formInputClassName}
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
                  className={formInputClassName}
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
                className={`${formInputClassName} min-h-28 py-3`}
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

          {actionState.status === "error" && actionState.message ? (
            <ResultBanner title={actionState.message} tone="error" />
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              disabled={isInteractionLocked}
              onClick={closeDialog}
              size="lg"
              type="button"
              variant="ghost"
            >
              Hủy
            </Button>
            <Button
              disabled={!selectedEntry}
              isLoading={isInteractionLocked}
              size="lg"
              type="submit"
            >
              {isInteractionLocked ? "Đang gửi yêu cầu..." : "Gửi yêu cầu"}
            </Button>
          </div>
        </form>
      </Dialog>
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
