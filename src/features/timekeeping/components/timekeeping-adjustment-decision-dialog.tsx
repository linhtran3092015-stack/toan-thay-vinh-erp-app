"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useRef, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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

function getInitialValues(
  requestId: string,
): TimekeepingAdjustmentDecisionInput {
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
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<TimekeepingAdjustmentDecisionInput>(
    () => getInitialValues(request.id),
  );
  const [actionState, setActionState] =
    useState<TimekeepingAdjustmentActionState>(
      initialTimekeepingAdjustmentActionState,
    );
  const isInteractionLocked =
    isPending && actionState.status !== "error";

  // Stable IDs scoped to request.id — safe when multiple dialogs are mounted.
  const titleId = `adj-decision-title-${request.id}`;
  const descId = `adj-decision-desc-${request.id}`;
  const decisionId = `adj-decision-decision-${request.id}`;
  const reasonId = `adj-decision-reason-${request.id}`;
  const reasonErrorId = `adj-decision-reason-error-${request.id}`;

  const openDialog = (): void => {
    setValues(getInitialValues(request.id));
    setActionState(initialTimekeepingAdjustmentActionState);
    setIsOpen(true);
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

    setActionState(initialTimekeepingAdjustmentActionState);

    startTransition(async () => {
      const result = await decideTimeEntryAdjustmentAction(values);
      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  const reasonError = actionState.fieldErrors?.decisionReason?.[0];
  const isRejection = values.decision === "rejected";

  return (
    <>
      <Button
        className="min-h-[44px]"
        onClick={openDialog}
        ref={openButtonRef}
        size="sm"
        variant="outline"
      >
        Xử lý
      </Button>

      <Dialog
        ariaDescribedBy={descId}
        ariaLabelledBy={titleId}
        className="sm:max-w-xl"
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={openButtonRef}
      >
        <form className="grid gap-5 p-5" onSubmit={handleSubmit}>
          <div>
            <h2
              className="text-section-title font-semibold text-text-strong"
              id={titleId}
            >
              Xử lý yêu cầu điều chỉnh
            </h2>
            <p className="mt-1 text-secondary text-text-muted" id={descId}>
              {request.requesterDisplayName ||
                request.requesterEmployeeCode ||
                "Nhân sự"}{" "}
              · {formatVietnamDate(request.workDate)}
            </p>
          </div>

          {/* Original vs. requested data — presentation only, no business semantics. */}
          <dl className="grid gap-3 rounded-md border border-border-subtle bg-surface-raised p-4">
            <div>
              <dt className="text-label font-semibold uppercase tracking-[0.04em] text-text-muted">
                Check-in
              </dt>
              <dd className="mt-1 grid gap-0.5 text-secondary text-text-muted">
                <p>
                  Gốc: {formatVietnamDateTime(request.originalCheckInAt)} ·{" "}
                  {getTimeEntryModeLabel(request.originalCheckInMode)}
                </p>
                <p className="font-medium text-text-strong">
                  Đề xuất: {formatVietnamDateTime(request.requestedCheckInAt)}{" "}
                  · {getTimeEntryModeLabel(request.requestedCheckInMode)}
                </p>
              </dd>
            </div>
            <div>
              <dt className="text-label font-semibold uppercase tracking-[0.04em] text-text-muted">
                Check-out
              </dt>
              <dd className="mt-1 grid gap-0.5 text-secondary text-text-muted">
                <p>
                  Gốc: {formatVietnamDateTime(request.originalCheckOutAt)} ·{" "}
                  {getTimeEntryModeLabel(request.originalCheckOutMode)}
                </p>
                <p className="font-medium text-text-strong">
                  Đề xuất: {formatVietnamDateTime(request.requestedCheckOutAt)}{" "}
                  · {getTimeEntryModeLabel(request.requestedCheckOutMode)}
                </p>
              </dd>
            </div>
            <div>
              <dt className="text-label font-semibold uppercase tracking-[0.04em] text-text-muted">
                Lý do yêu cầu
              </dt>
              <dd className="mt-1 text-secondary text-text-muted">
                {request.requestReason}
              </dd>
            </div>
          </dl>

          <div className="grid gap-4">
            <FormField
              error={actionState.fieldErrors?.decision?.[0]}
              errorId={`adj-decision-decision-error-${request.id}`}
              id={decisionId}
              label="Quyết định"
            >
              <select
                aria-describedby={
                  actionState.fieldErrors?.decision?.[0]
                    ? `adj-decision-decision-error-${request.id}`
                    : undefined
                }
                aria-invalid={
                  actionState.fieldErrors?.decision?.[0] ? true : undefined
                }
                className={formInputClassName}
                disabled={isInteractionLocked}
                id={decisionId}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    decision: event.target
                      .value as TimekeepingAdjustmentDecisionInput["decision"],
                  }))
                }
                value={values.decision}
              >
                <option value="approved">Duyệt</option>
                <option value="rejected">Từ chối</option>
              </select>
            </FormField>

            <FormField
              error={reasonError}
              errorId={reasonErrorId}
              id={reasonId}
              label={isRejection ? "Lý do từ chối" : "Ghi chú duyệt"}
              required={isRejection}
            >
              <textarea
                aria-describedby={reasonError ? reasonErrorId : undefined}
                aria-invalid={reasonError ? true : undefined}
                aria-required={isRejection ? "true" : undefined}
                className={`${formInputClassName} min-h-28 py-3`}
                disabled={isInteractionLocked}
                id={reasonId}
                maxLength={2000}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    decisionReason: event.target.value,
                  }))
                }
                placeholder={
                  isRejection ? "Nêu rõ lý do từ chối" : "Không bắt buộc"
                }
                required={isRejection}
                value={values.decisionReason}
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
              isLoading={isInteractionLocked}
              size="lg"
              type="submit"
              variant={isRejection ? "danger" : "primary"}
            >
              {isInteractionLocked
                ? "Đang xử lý..."
                : isRejection
                  ? "Từ chối yêu cầu"
                  : "Duyệt yêu cầu"}
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
