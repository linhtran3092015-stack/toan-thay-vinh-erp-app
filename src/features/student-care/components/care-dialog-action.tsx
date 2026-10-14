"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

import type { CareCommand } from "../models";
import type { StudentCareActionOverrides } from "../student-care-action-overrides";
import { CareActionForm, type CareActionResult, type CareRequestKey } from "./care-action-form";

export interface CareDialogActionProps {
  action?: StudentCareActionOverrides["mutateCare"];
  base: Omit<CareCommand, "request_id">;
  children?: ReactNode;
  /** Consequence or context sentence under the dialog title. */
  description?: ReactNode;
  /** Strong consequence box (danger-soft), e.g. what an exception means. */
  consequence?: ReactNode;
  /** Every settled result, also after the dialog closed (e.g. the task page keeps a success whose re-render removes this trigger). */
  onResult?: (result: CareActionResult) => void;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  title: string;
  triggerClassName?: string;
  triggerLabel: string;
  triggerSize?: ButtonSize;
  triggerVariant?: ButtonVariant;
}

/**
 * Trigger + dialog around one existing care command. An error stays in the
 * dialog under its buttons; a success closes it and the result is shown right
 * under the trigger (no toast). The dialog cannot be closed (Escape, scrim,
 * "Hủy") while the command is in flight, and the last result is kept here, so
 * an error is still shown under the trigger after the dialog is closed, and
 * again above the form when it is reopened, until a later submit settles
 * (only a success is cleared on reopen). The request key also lives here:
 * closing the dialog unmounts the form, and a retry with the same values after
 * an uncertain result must reuse the id.
 */
export function CareDialogAction({
  action,
  base,
  children,
  consequence,
  description,
  onResult,
  submitLabel,
  submitVariant = "primary",
  title,
  triggerClassName,
  triggerLabel,
  triggerSize = "md",
  triggerVariant = "secondary",
}: CareDialogActionProps) {
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<CareRequestKey>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<CareActionResult | null>(null);
  // True while `result` came from an earlier opening: the remounted form does not show it.
  const [isEarlierResult, setIsEarlierResult] = useState(false);
  const close = () => {
    if (!isPending) setIsOpen(false);
  };

  return (
    <div className="grid justify-items-start gap-2">
      <Button
        className={triggerClassName}
        onClick={() => {
          if (result?.ok) setResult(null);
          setIsEarlierResult(true);
          setIsOpen(true);
        }}
        ref={triggerRef}
        size={triggerSize}
        variant={triggerVariant}
      >
        {triggerLabel}
      </Button>
      {result && !isOpen ? <ResultBanner className="w-full" title={result.message} tone={result.ok ? "success" : "error"} /> : null}
      <Dialog
        ariaDescribedBy={description ? descriptionId : undefined}
        ariaLabelledBy={titleId}
        className="sm:max-w-[480px]"
        isOpen={isOpen}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        <div className="grid gap-4 p-5 sm:p-6">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          {result && !result.ok && isEarlierResult ? <ResultBanner title={result.message} tone="error" /> : null}
          {consequence ? (
            <p className="rounded-md border border-danger-border bg-danger-bg p-3 text-secondary font-semibold text-danger-ink">{consequence}</p>
          ) : null}
          <CareActionForm
            action={action}
            base={base}
            label={submitLabel}
            onPendingChange={setIsPending}
            onResult={(next) => {
              setResult(next);
              setIsEarlierResult(false);
              if (next.ok) setIsOpen(false);
              onResult?.(next);
            }}
            requestRef={requestRef}
            secondaryAction={
              <Button onClick={close} variant="secondary">
                Hủy
              </Button>
            }
            submitVariant={submitVariant}
          >
            {children}
          </CareActionForm>
        </div>
      </Dialog>
    </div>
  );
}
