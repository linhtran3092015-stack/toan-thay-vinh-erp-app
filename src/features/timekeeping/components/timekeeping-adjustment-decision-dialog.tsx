"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type {
  TimekeepingAdjustmentActionState,
  TimekeepingAdjustmentDecisionInput,
} from "@/features/timekeeping/timekeeping-adjustment-action-types";
import { initialTimekeepingAdjustmentActionState } from "@/features/timekeeping/timekeeping-adjustment-action-types";
import { decideTimeEntryAdjustmentAction } from "@/features/timekeeping/timekeeping-adjustment-actions";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  getTimeEntryModeLabel,
} from "@/features/timekeeping/timekeeping-adjustment-utils";
import { formInputClassName } from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingAdjustmentApprovalQueueEntry } from "@/features/timekeeping/types";

interface TimekeepingAdjustmentDecisionDialogProps {
  request: TimekeepingAdjustmentApprovalQueueEntry;
}

function getInitialValues(requestId: string): TimekeepingAdjustmentDecisionInput {
  return {
    decision: "approved",
    decisionReason: "",
    requestId,
  };
}

export function TimekeepingAdjustmentDecisionDialog({
  request,
}: TimekeepingAdjustmentDecisionDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<TimekeepingAdjustmentDecisionInput>(() =>
    getInitialValues(request.id),
  );
  const [actionState, setActionState] = useState<TimekeepingAdjustmentActionState>(
    initialTimekeepingAdjustmentActionState,
  );

  const openDialog = (): void => {
    setValues(getInitialValues(request.id));
    setActionState(initialTimekeepingAdjustmentActionState);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (!isPending) {
      setIsOpen(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    startTransition(async () => {
      const result = await decideTimeEntryAdjustmentAction(values);
      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={openDialog} size="sm" variant="outline">
        Xử lý
      </Button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="my-auto grid w-full max-w-xl gap-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">Xử lý yêu cầu điều chỉnh</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {request.requesterDisplayName || request.requesterEmployeeCode || "Nhân sự"} · {formatVietnamDate(request.workDate)}
              </p>
            </div>

            <dl className="grid gap-3 rounded-md border border-hairline bg-surface-2 p-4 text-sm">
              <ChangeField
                label="Check-in"
                original={`${formatVietnamDateTime(request.originalCheckInAt)} · ${getTimeEntryModeLabel(request.originalCheckInMode)}`}
                proposed={`${formatVietnamDateTime(request.requestedCheckInAt)} · ${getTimeEntryModeLabel(request.requestedCheckInMode)}`}
              />
              <ChangeField
                label="Check-out"
                original={`${formatVietnamDateTime(request.originalCheckOutAt)} · ${getTimeEntryModeLabel(request.originalCheckOutMode)}`}
                proposed={`${formatVietnamDateTime(request.requestedCheckOutAt)} · ${getTimeEntryModeLabel(request.requestedCheckOutMode)}`}
              />
              <ChangeField label="Lý do" original={request.requestReason} />
            </dl>

            <div className="grid gap-4">
              <FormField error={actionState.fieldErrors?.decision?.[0]} label="Quyết định">
                <select
                  className={formInputClassName}
                  disabled={isPending}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      decision: event.target.value as TimekeepingAdjustmentDecisionInput["decision"],
                    }))
                  }
                  value={values.decision}
                >
                  <option value="approved">Duyệt</option>
                  <option value="rejected">Từ chối</option>
                </select>
              </FormField>
              <FormField
                error={actionState.fieldErrors?.decisionReason?.[0]}
                label={values.decision === "rejected" ? "Lý do từ chối" : "Ghi chú duyệt"}
              >
                <textarea
                  className={`${formInputClassName} min-h-28 py-3`}
                  disabled={isPending}
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      decisionReason: event.target.value,
                    }))
                  }
                  placeholder={
                    values.decision === "rejected"
                      ? "Nêu rõ lý do từ chối"
                      : "Không bắt buộc"
                  }
                  required={values.decision === "rejected"}
                  value={values.decisionReason}
                />
              </FormField>
            </div>

            <ActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" variant="ghost">
                Hủy
              </Button>
              <Button
                disabled={isPending}
                size="lg"
                type="submit"
                variant={values.decision === "rejected" ? "danger" : "primary"}
              >
                {isPending
                  ? "Đang xử lý..."
                  : values.decision === "approved"
                    ? "Duyệt yêu cầu"
                    : "Từ chối yêu cầu"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function ChangeField({
  label,
  original,
  proposed,
}: {
  label: string;
  original: string;
  proposed?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</dt>
      <dd className="mt-1 text-ink-muted">Gốc: {original}</dd>
      {proposed ? <dd className="mt-1 font-medium text-ink">Đề xuất: {proposed}</dd> : null}
    </div>
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
