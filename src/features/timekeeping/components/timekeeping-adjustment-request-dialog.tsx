"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
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
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<AdjustmentFormValues>(() => getInitialValues());
  const [actionState, setActionState] = useState<TimekeepingAdjustmentActionState>(
    initialTimekeepingAdjustmentActionState,
  );
  const eligibleEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.adjustmentStatus !== "pending" && entry.adjustmentStatus !== "approved",
      ),
    [entries],
  );
  const selectedEntry = eligibleEntries.find((entry) => entry.id === values.timeEntryId);

  const openDialog = (): void => {
    setValues(getInitialValues(eligibleEntries[0]));
    setActionState(initialTimekeepingAdjustmentActionState);
    setIsOpen(true);
  };

  const selectEntry = (timeEntryId: string): void => {
    const entry = eligibleEntries.find((candidate) => candidate.id === timeEntryId);

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
    if (!isPending) {
      setIsOpen(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!values.requestedCheckInAt || !values.requestedCheckOutAt) {
      setActionState({
        message: "Cần nhập đủ thời điểm check-in và check-out đề xuất.",
        status: "error",
      });
      return;
    }

    const input: TimekeepingAdjustmentRequestInput = {
      requestReason: values.requestReason,
      requestedCheckInAt: vietnamDatetimeInputToIso(values.requestedCheckInAt),
      requestedCheckInMode: values.requestedCheckInMode,
      requestedCheckOutAt: vietnamDatetimeInputToIso(values.requestedCheckOutAt),
      requestedCheckOutMode: values.requestedCheckOutMode,
      timeEntryId: values.timeEntryId,
    };

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
      <Button disabled={eligibleEntries.length === 0} onClick={openDialog} size="lg">
        Yêu cầu điều chỉnh
      </Button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="my-auto grid w-full max-w-2xl gap-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">Yêu cầu điều chỉnh công</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Dữ liệu chấm công gốc được giữ nguyên. Thời điểm đề xuất hiển thị theo giờ Việt Nam.
              </p>
            </div>

            <div className="grid gap-4">
              <FormField
                error={actionState.fieldErrors?.timeEntryId?.[0]}
                label="Lượt chấm công cần điều chỉnh"
              >
                <select
                  className={formInputClassName}
                  disabled={isPending}
                  onChange={(event) => selectEntry(event.target.value)}
                  value={values.timeEntryId}
                >
                  {eligibleEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {formatVietnamDate(entry.workDate)} · {entry.workShiftCode} · {entry.workShiftName}
                    </option>
                  ))}
                </select>
              </FormField>

              {selectedEntry ? (
                <div className="rounded-md border border-hairline bg-surface-2 p-4 text-sm">
                  <p className="font-semibold text-ink">Dữ liệu gốc</p>
                  <p className="mt-1 leading-6 text-ink-muted">
                    Check-in {formatVietnamDateTimeInput(selectedEntry.checkInAt).replace("T", " ")} · {getTimeEntryModeLabel(selectedEntry.checkInMode)}
                    <br />
                    Check-out {formatVietnamDateTimeInput(selectedEntry.checkOutAt).replace("T", " ")} · {getTimeEntryModeLabel(selectedEntry.checkOutMode)}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  error={actionState.fieldErrors?.requestedCheckInAt?.[0]}
                  label="Check-in đề xuất"
                >
                  <input
                    className={formInputClassName}
                    disabled={isPending}
                    onChange={(event) => updateValue("requestedCheckInAt", event.target.value)}
                    type="datetime-local"
                    value={values.requestedCheckInAt}
                  />
                </FormField>
                <FormField
                  error={actionState.fieldErrors?.requestedCheckInMode?.[0]}
                  label="Hình thức check-in"
                >
                  <select
                    className={formInputClassName}
                    disabled={isPending}
                    onChange={(event) =>
                      updateValue(
                        "requestedCheckInMode",
                        event.target.value as AdjustmentFormValues["requestedCheckInMode"],
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
                  label="Check-out đề xuất"
                >
                  <input
                    className={formInputClassName}
                    disabled={isPending}
                    onChange={(event) => updateValue("requestedCheckOutAt", event.target.value)}
                    type="datetime-local"
                    value={values.requestedCheckOutAt}
                  />
                </FormField>
                <FormField
                  error={actionState.fieldErrors?.requestedCheckOutMode?.[0]}
                  label="Hình thức check-out"
                >
                  <select
                    className={formInputClassName}
                    disabled={isPending}
                    onChange={(event) =>
                      updateValue(
                        "requestedCheckOutMode",
                        event.target.value as AdjustmentFormValues["requestedCheckOutMode"],
                      )
                    }
                    value={values.requestedCheckOutMode}
                  >
                    <option value="offline">Tại trung tâm</option>
                    <option value="online">Trực tuyến</option>
                  </select>
                </FormField>
              </div>

              <FormField error={actionState.fieldErrors?.requestReason?.[0]} label="Lý do điều chỉnh">
                <textarea
                  className={`${formInputClassName} min-h-28 py-3`}
                  disabled={isPending}
                  maxLength={2000}
                  onChange={(event) => updateValue("requestReason", event.target.value)}
                  placeholder="Nêu rõ lý do và thời điểm cần điều chỉnh"
                  value={values.requestReason}
                />
              </FormField>
            </div>

            <ActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending || !selectedEntry} size="lg" type="submit">
                {isPending ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function FormField({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      {children}
      {error ? <span className="text-xs font-medium text-danger">{error}</span> : null}
    </label>
  );
}

function ActionMessage({
  actionState,
}: {
  actionState: TimekeepingAdjustmentActionState;
}) {
  if (actionState.status === "idle" || !actionState.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={
        actionState.status === "error"
          ? "rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
          : "rounded-md border border-success-border bg-success-bg px-3 py-2 text-sm text-success"
      }
    >
      {actionState.message}
    </p>
  );
}
