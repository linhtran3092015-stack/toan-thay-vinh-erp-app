"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { mutateCare } from "../actions";
import type { CareCommand } from "../models";
import type { StudentCareActionOverrides } from "../student-care-action-overrides";

export type CareActionResult = { ok: boolean; message: string };

/**
 * The idempotency key of the last uncertain attempt (see CareActionForm):
 * `values` is the typed command without `version`, `input` the exact command
 * that was sent (old version and request_id included).
 */
export type CareRequestKey = { input: Record<string, unknown>; values: string } | null;

/**
 * Any refusal may hide a committed write: postgrest-js returns a network or
 * gateway failure as `{ error }`, which mutateCare reports with its generic
 * "Không lưu được công việc…" message. So the key survives every refusal and a
 * retry with unchanged values replays the first command (the RPC answers a
 * known request_id before its version check). Only STALE_VERSION drops it:
 * that answer proves the old command can never apply.
 */
const STALE_VERSION_PREFIX = "Công việc vừa được người khác cập nhật";
const UNCERTAIN_RESULT: CareActionResult = { message: "Chưa xác nhận được kết quả lưu. Thử lại để kiểm tra an toàn.", ok: false };

const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

export interface CareActionFormProps {
  /** Inert stub in the /dev preview; the real pages pass nothing. */
  action?: StudentCareActionOverrides["mutateCare"];
  base: Omit<CareCommand, "request_id">;
  children?: ReactNode;
  className?: string;
  /** Row actions: a one-line result under a 32px button instead of a banner. */
  compact?: boolean;
  /** Visible reason under a disabled submit (linked by aria-describedby). */
  disabledReason?: string;
  label: string;
  /** True when a command starts, false when it settles (a dialog refuses to close meanwhile). */
  onPendingChange?: (pending: boolean) => void;
  /** Called with every settled result (e.g. a dialog closes and shows it under its trigger). */
  onResult?: (result: CareActionResult) => void;
  /**
   * Request key owned by a parent that outlives this form (a dialog unmounts
   * the form on close), so a retry after an uncertain result reuses the id.
   */
  requestRef?: RefObject<CareRequestKey>;
  /** Control placed before the submit in the same row (e.g. a dialog's "Hủy"). */
  secondaryAction?: ReactNode;
  /** Accessible name when the visible label repeats per row (e.g. "Nhận việc · Trần Gia Bảo"). */
  submitAriaLabel?: string;
  submitDisabled?: boolean;
  submitVariant?: ButtonVariant;
}

/**
 * One student-care command. After an uncertain result (the write may have
 * committed) a retry with the same typed values resends the first command
 * verbatim, request_id and version included, so mutate_student_care either
 * replays the committed result (it looks the request_id up before checking the
 * version) or answers STALE_VERSION; it cannot write twice even when a
 * background refresh has bumped `base.version` meanwhile. A dialog passes its
 * own `requestRef` so the key survives closing it. Success or a definite
 * refusal (nothing written) drops the key. On success the fields are
 * remounted with their defaults; the result stays right under the button.
 * When a command settles while focus fell to the page (the disabled fieldset
 * dropped it), focus returns to the submit button (else the first field), so
 * Escape and Tab still reach a dialog.
 * mutateCare calls revalidatePath, so Next re-renders the current route in the
 * action's own response (node_modules/next/dist/docs/01-app/02-guides/
 * server-actions.md, "A single response carries data and UI"): only an
 * injected action (the /dev preview stub) needs router.refresh(). Remounting (not form.reset()) keeps radio groups usable:
 * after reset() React re-applies defaultChecked on every later click.
 */
export function CareActionForm({
  action = mutateCare,
  base,
  children,
  className,
  compact = false,
  disabledReason,
  label,
  onPendingChange,
  onResult,
  requestRef,
  secondaryAction,
  submitAriaLabel,
  submitDisabled = false,
  submitVariant = "secondary",
}: CareActionFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<CareActionResult | null>(null);
  const [generation, setGeneration] = useState(0);
  const ownRequest = useRef<CareRequestKey>(null);
  const request = requestRef ?? ownRequest;
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    const settled = wasPending.current && !pending;
    wasPending.current = pending;
    const form = formRef.current;
    // Only inside a dialog (its key handling needs focus); on the page, focus on
    // a form would pause StudentCareRefresh (it skips while a form has focus).
    if (!settled || !form?.isConnected || !form.closest("[role=dialog],[role=alertdialog]")) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    (form.querySelector<HTMLElement>("button[type=submit]:not([disabled])") ?? form.querySelector<HTMLElement>(focusableSelector))?.focus();
  }, [pending]);

  return (
    <form
      className={cn("grid gap-3", className)}
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const values: Record<string, unknown> = { ...base };
        for (const [name, value] of new FormData(event.currentTarget)) if (typeof value === "string" && value !== "") values[name] = value;
        for (const name of ["next_followup_at", "contact_at"]) {
          if (typeof values[name] === "string") values[name] = new Date(`${values[name]}+07:00`).toISOString();
        }
        if (typeof values.success === "string") values.success = values.success === "true";
        // The key leaves out `version`: a refresh after an uncertain write bumps it.
        const typedValues = JSON.stringify({ ...values, version: undefined });
        const input =
          request.current && request.current.values === typedValues
            ? request.current.input
            : { ...values, request_id: crypto.randomUUID() };
        onPendingChange?.(true);
        start(async () => {
          let result: CareActionResult;
          try {
            result = await action(input);
          } catch {
            result = UNCERTAIN_RESULT;
          }
          request.current =
            !result.ok && !result.message.startsWith(STALE_VERSION_PREFIX)
              ? { input, values: typedValues }
              : null;
          onPendingChange?.(false);
          setFeedback(result);
          onResult?.(result);
          if (result.ok) {
            setGeneration((value) => value + 1);
            if (action !== mutateCare) router.refresh();
          }
        });
      }}
    >
      <fieldset className="grid min-w-0 gap-3" disabled={pending} key={generation}>
        {children}
        <div className={cn("flex", compact ? "justify-end" : "flex-wrap justify-end gap-2")}>
          {secondaryAction}
          <Button
            aria-label={submitAriaLabel}
            disabled={submitDisabled}
            disabledReason={disabledReason}
            isLoading={pending}
            size={compact ? "sm" : "md"}
            type="submit"
            variant={submitVariant}
          >
            {label}
          </Button>
        </div>
      </fieldset>
      {feedback ? (
        compact ? (
          <p className={cn("text-caption", feedback.ok ? "text-success" : "text-danger")} role={feedback.ok ? "status" : "alert"}>
            {feedback.message}
          </p>
        ) : (
          <ResultBanner title={feedback.message} tone={feedback.ok ? "success" : "error"} />
        )
      ) : null}
    </form>
  );
}
