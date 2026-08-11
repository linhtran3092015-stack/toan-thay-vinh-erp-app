"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  approveSalaryAdvanceAction,
  reviewSalaryAdvanceAction,
} from "@/features/advances/actions/advance-actions";
import { AdvanceActionMessage } from "@/features/advances/components/advance-action-message";
import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";
import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

type AdvanceDecisionStage = "approve" | "review";
type AdvanceDecision = "approved" | "rejected" | "review";

interface SalaryAdvanceDecisionDialogProps {
  advance: SalaryAdvanceDashboardEntry;
  stage: AdvanceDecisionStage;
}

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

const contentByStage: Record<
  AdvanceDecisionStage,
  {
    confirmedDecision: "approved" | "review";
    confirmedLabel: string;
    description: string;
    pendingLabel: string;
    rejectedLabel: string;
    title: string;
    triggerLabel: string;
  }
> = {
  approve: {
    confirmedDecision: "approved",
    confirmedLabel: "Phê duyệt tạm ứng",
    description:
      "Khoản được phê duyệt sẽ chờ hệ thống Payroll khấu trừ tại kỳ đã chọn.",
    pendingLabel: "Đang xử lý phê duyệt…",
    rejectedLabel: "Từ chối yêu cầu",
    title: "Phê duyệt yêu cầu tạm ứng",
    triggerLabel: "Phê duyệt",
  },
  review: {
    confirmedDecision: "review",
    confirmedLabel: "Chuyển bước phê duyệt",
    description:
      "Yêu cầu được đối soát sẽ chuyển sang bước phê duyệt cuối cùng.",
    pendingLabel: "Đang xử lý đối soát…",
    rejectedLabel: "Từ chối yêu cầu",
    title: "Đối soát yêu cầu tạm ứng",
    triggerLabel: "Đối soát",
  },
};

/** Confirms one explicit, server-owned Salary Advance review or approval outcome. */
export function SalaryAdvanceDecisionDialog({
  advance,
  stage,
}: SalaryAdvanceDecisionDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const decisionRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const decisionId = useId();
  const noteId = useId();
  const noteErrorId = `${noteId}-error`;
  const content = contentByStage[stage];
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [decision, setDecision] = useState<AdvanceDecision>(content.confirmedDecision);
  const [note, setNote] = useState("");
  const [actionState, setActionState] = useState<AdvanceActionState | null>(null);
  const isInteractionLocked = isPending && actionState?.status !== "error";
  const noteError = actionState?.status === "error" ? actionState.fieldErrors?.note?.[0] : undefined;
  const isRejected = decision === "rejected";

  const openDialog = (): void => {
    setDecision(content.confirmedDecision);
    setNote("");
    setActionState(null);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setIsOpen(false);
    setActionState(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isInteractionLocked) {
      return;
    }

    setActionState(null);
    startTransition(async () => {
      const result = stage === "review"
        ? await reviewSalaryAdvanceAction({
            decision: decision as "rejected" | "review",
            note,
            salaryAdvanceId: advance.id,
          })
        : await approveSalaryAdvanceAction({
            decision: decision as "approved" | "rejected",
            note,
            salaryAdvanceId: advance.id,
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
        variant="outline"
      >
        {content.triggerLabel}
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={decisionRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            {content.title}
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            {content.description}
          </p>

          <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
            <dl className="grid gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-4 text-secondary text-text-default">
              <DecisionDetail label="Nhân sự" value={advance.staffDisplayName} />
              <DecisionDetail label="Số tiền" value={formatCurrency(advance.amountVnd)} />
              <DecisionDetail label="Kỳ khấu trừ" value={formatMonth(advance.deductionPeriodMonth)} />
              <DecisionDetail label="Lý do" value={advance.requestNote} />
            </dl>

            <div className="grid gap-1.5">
              <label className="text-label text-text-default" htmlFor={decisionId}>
                Quyết định
              </label>
              <select
                className={formInputClassName}
                disabled={isInteractionLocked}
                id={decisionId}
                onChange={(event) => setDecision(event.target.value as AdvanceDecision)}
                ref={decisionRef}
                value={decision}
              >
                <option value={content.confirmedDecision}>{content.confirmedLabel}</option>
                <option value="rejected">{content.rejectedLabel}</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-label text-text-default" htmlFor={noteId}>
                {isRejected ? "Lý do từ chối" : "Ghi chú"}
              </label>
              <textarea
                aria-describedby={noteError ? noteErrorId : undefined}
                aria-invalid={Boolean(noteError)}
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isInteractionLocked}
                id={noteId}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                required={isRejected}
                value={note}
              />
              {noteError ? <FieldError id={noteErrorId}>{noteError}</FieldError> : null}
            </div>

            {actionState?.status === "error" ? (
              <AdvanceActionMessage actionState={actionState} />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button
                className="min-h-11"
                disabled={isInteractionLocked}
                isLoading={isInteractionLocked}
                size="lg"
                type="submit"
                variant={isRejected ? "danger" : "primary"}
              >
                {isInteractionLocked
                  ? content.pendingLabel
                  : isRejected
                    ? content.rejectedLabel
                    : content.confirmedLabel}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function DecisionDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption font-semibold text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-text-strong">{value}</dd>
    </div>
  );
}

function FieldError({ children, id }: { children: string; id: string }) {
  return <p className="text-caption font-medium text-danger" id={id}>{children}</p>;
}
