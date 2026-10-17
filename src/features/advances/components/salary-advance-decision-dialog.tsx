"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  approveSalaryAdvanceAction,
  reviewSalaryAdvanceAction,
} from "@/features/advances/actions/advance-actions";
import type { AdvanceActionOverrides } from "@/features/advances/advance-action-overrides";
import {
  describeRelatedAdvance,
  type AdvanceDecisionStage,
} from "@/features/advances/advance-directory-models";
import { AdvanceActionMessage } from "@/features/advances/components/advance-action-message";
import {
  advanceFieldClassName,
  advanceTextareaClassName,
} from "@/features/advances/components/advance-field";
import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";
import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";
import { formatMonth, formatShortDateTime, getVietnamToday } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";

type AdvanceDecision = "approved" | "rejected" | "review";

interface SalaryAdvanceDecisionDialogProps {
  /** Server-action overrides for the /dev preview; the real page passes nothing. */
  actions?: Pick<AdvanceActionOverrides, "approveSalaryAdvance" | "reviewSalaryAdvance">;
  advance: SalaryAdvanceDashboardEntry;
  /**
   * Other loaded requests of the same staff member and deduction month, shown
   * as "Đơn khác cùng kỳ" (a list, never a sum). Omitted: the fact is not shown.
   */
  relatedEntries?: readonly SalaryAdvanceDashboardEntry[];
  stage: AdvanceDecisionStage;
  /** Vietnam business date `YYYY-MM-DD`; decides whether short dates carry a year. */
  today?: string;
  /** Row placements pass `sm` (table, 32px) or `lg` (cards, 44px). */
  triggerSize?: ButtonSize;
  triggerVariant?: ButtonVariant;
}

const contentByStage: Record<
  AdvanceDecisionStage,
  {
    confirmedDecision: "approved" | "review";
    confirmedLabel: string;
    notePlaceholder: string;
    pendingLabel: string;
    rejectedLabel: string;
    title: string;
    triggerLabel: string;
  }
> = {
  approve: {
    confirmedDecision: "approved",
    confirmedLabel: "Phê duyệt tạm ứng",
    notePlaceholder: "VD: Đồng ý, trừ vào kỳ đã chọn",
    pendingLabel: "Đang xử lý phê duyệt…",
    rejectedLabel: "Từ chối yêu cầu",
    title: "Phê duyệt yêu cầu tạm ứng",
    triggerLabel: "Phê duyệt",
  },
  review: {
    confirmedDecision: "review",
    confirmedLabel: "Chuyển bước phê duyệt",
    notePlaceholder: "VD: Đủ chứng từ, chuyển chủ duyệt",
    pendingLabel: "Đang xử lý đối soát…",
    rejectedLabel: "Từ chối yêu cầu",
    title: "Đối soát yêu cầu tạm ứng",
    triggerLabel: "Đối soát",
  },
};

const REJECTION_PLACEHOLDER = "VD: Thiếu chứng từ, nhân sự cần bổ sung";

// The real rules only (migrations): two steps, no self-decision, a reason to reject,
// deducted when that month's payroll is calculated (a payroll already calculated for that
// month picks it up only on recalculation). No amount cap exists, so none is stated.
const DECISION_RULES =
  "Kế toán đối soát → chủ trung tâm phê duyệt. Không tự đối soát hoặc tự duyệt đơn của chính mình. Từ chối cần lý do. Khoản đã duyệt được trừ khi tính bảng lương kỳ đã chọn; nếu bảng lương kỳ đó đã tính rồi thì phải tính lại mới trừ.";

/** Confirms one explicit, server-owned Salary Advance review or approval outcome. */
export function SalaryAdvanceDecisionDialog({
  actions,
  advance,
  relatedEntries,
  stage,
  today,
  triggerSize,
  triggerVariant = "outline",
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
  const review = actions?.reviewSalaryAdvance ?? reviewSalaryAdvanceAction;
  const approve = actions?.approveSalaryAdvance ?? approveSalaryAdvanceAction;

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
        ? await review({
            decision: decision as "rejected" | "review",
            note,
            salaryAdvanceId: advance.id,
          })
        : await approve({
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
        className={triggerSize ? undefined : "min-h-11"}
        onClick={openDialog}
        ref={triggerRef}
        size={triggerSize}
        type="button"
        variant={triggerVariant}
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
        {isOpen ? (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
              <div>
                <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
                  {content.title}
                </h2>
                <p className="mt-0.5 text-secondary tabular-nums text-text-muted" id={descriptionId}>
                  {describeDecisionSubject(advance, today ?? getVietnamToday())}
                </p>
              </div>

              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-md bg-surface-sunken p-3 text-secondary">
                <dt className="text-text-muted">Lý do</dt>
                <dd className="break-words text-text-strong">{advance.requestNote}</dd>
                {relatedEntries ? (
                  <>
                    <dt className="text-text-muted">Đơn khác cùng kỳ</dt>
                    <dd className="text-text-strong">
                      {relatedEntries.length === 0 ? (
                        "Không có"
                      ) : (
                        <ul className="grid gap-0.5 tabular-nums">
                          {relatedEntries.map((entry) => (
                            <li key={entry.id}>{describeRelatedAdvance(entry, today ?? getVietnamToday())}</li>
                          ))}
                        </ul>
                      )}
                    </dd>
                  </>
                ) : null}
                <dt className="text-text-muted">Quy tắc</dt>
                <dd className="text-text-default">{DECISION_RULES}</dd>
              </dl>

              <div className="grid gap-1.5">
                <label className="text-label font-medium text-text-strong" htmlFor={decisionId}>
                  Quyết định
                </label>
                <select
                  className={advanceFieldClassName}
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
                <label className="text-label font-medium text-text-strong" htmlFor={noteId}>
                  {isRejected ? "Lý do từ chối" : "Ghi chú"}
                </label>
                <textarea
                  aria-describedby={noteError ? noteErrorId : undefined}
                  aria-invalid={Boolean(noteError)}
                  className={advanceTextareaClassName}
                  disabled={isInteractionLocked}
                  id={noteId}
                  maxLength={2000}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={isRejected ? REJECTION_PLACEHOLDER : content.notePlaceholder}
                  required={isRejected}
                  value={note}
                />
                {noteError ? <FieldError id={noteErrorId}>{noteError}</FieldError> : null}
              </div>

              {actionState?.status === "error" ? (
                <AdvanceActionMessage actionState={actionState} />
              ) : null}
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border-subtle px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
              <Button
                className="max-md:h-11"
                disabled={isInteractionLocked}
                onClick={closeDialog}
                type="button"
                variant="secondary"
              >
                Hủy
              </Button>
              <Button
                className="max-md:h-11"
                disabled={isInteractionLocked}
                isLoading={isInteractionLocked}
                type="submit"
                // Rejecting is the explicit decision inside the dialog, never a page primary.
                variant={isRejected ? "danger-solid" : "primary"}
              >
                {isInteractionLocked
                  ? content.pendingLabel
                  : isRejected
                    ? content.rejectedLabel
                    : content.confirmedLabel}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}

/** "Nguyễn Minh An · 3.000.000 ₫ · trừ vào kỳ 10/2026 · gửi 12/10 09:40" */
function describeDecisionSubject(advance: SalaryAdvanceDashboardEntry, today: string): string {
  return [
    advance.staffDisplayName,
    formatVnd(advance.amountVnd),
    `trừ vào kỳ ${formatMonth(advance.deductionPeriodMonth)}`,
    `gửi ${formatShortDateTime(advance.requestedAt, today)}`,
  ].join(" · ");
}

function FieldError({ children, id }: { children: string; id: string }) {
  return <p className="text-caption font-medium text-danger" id={id}>{children}</p>;
}
