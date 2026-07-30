"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  approveSalaryAdvanceAction,
  reviewSalaryAdvanceAction,
} from "@/features/advances/actions/advance-actions";
import { AdvanceActionMessage } from "@/features/advances/components/advance-action-message";
import { AdvanceModal } from "@/features/advances/components/advance-modal";
import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";
import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";

type AdvanceDecisionStage = "approve" | "review";

interface SalaryAdvanceDecisionDialogProps {
  advance: SalaryAdvanceDashboardEntry;
  stage: AdvanceDecisionStage;
  triggerClassName?: string;
}

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

const contentByStage: Record<
  AdvanceDecisionStage,
  {
    approvedDecision: "approved" | "review";
    approvedLabel: string;
    description: string;
    rejectedLabel: string;
    title: string;
    triggerLabel: string;
  }
> = {
  approve: {
    approvedDecision: "approved",
    approvedLabel: "Duyệt tạm ứng",
    description:
      "Khoản được duyệt sẽ tự khấu trừ một lần trong bảng lương của kỳ đã chọn.",
    rejectedLabel: "Từ chối duyệt",
    title: "Duyệt yêu cầu tạm ứng",
    triggerLabel: "Duyệt",
  },
  review: {
    approvedDecision: "review",
    approvedLabel: "Chuyển chủ trung tâm duyệt",
    description:
      "Yêu cầu sau khi đối soát sẽ chờ chủ trung tâm duyệt cuối cùng.",
    rejectedLabel: "Từ chối yêu cầu",
    title: "Đối soát yêu cầu tạm ứng",
    triggerLabel: "Đối soát",
  },
};

export function SalaryAdvanceDecisionDialog({
  advance,
  stage,
  triggerClassName,
}: SalaryAdvanceDecisionDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const content = contentByStage[stage];
  const [decision, setDecision] = useState<"approved" | "rejected" | "review">(
    content.approvedDecision,
  );
  const [note, setNote] = useState("");
  const [actionState, setActionState] = useState<AdvanceActionState | null>(null);

  const openDialog = (): void => {
    setDecision(content.approvedDecision);
    setNote("");
    setActionState(null);
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
      const result =
        stage === "review"
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

  const isRejected = decision === "rejected";

  return (
    <>
      <Button
        className={triggerClassName}
        onClick={openDialog}
        size="sm"
        type="button"
        variant="outline"
      >
        {content.triggerLabel}
      </Button>

      {isOpen ? (
        <AdvanceModal description={content.description} title={content.title}>
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <dl className="grid gap-2 rounded-md border border-hairline bg-surface-2 p-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Nhân sự</dt>
                <dd className="mt-1 font-medium text-ink">{advance.staffDisplayName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Số tiền</dt>
                <dd className="mt-1 font-medium text-ink">{formatCurrency(advance.amountVnd)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Lý do</dt>
                <dd className="mt-1 text-ink-muted">{advance.requestNote}</dd>
              </div>
            </dl>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              Quyết định
              <select
                className={formInputClassName}
                disabled={isPending}
                onChange={(event) =>
                  setDecision(event.target.value as "approved" | "rejected" | "review")
                }
                value={decision}
              >
                <option value={content.approvedDecision}>{content.approvedLabel}</option>
                <option value="rejected">{content.rejectedLabel}</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-ink">
              {isRejected ? "Lý do từ chối" : "Ghi chú"}
              <textarea
                className={`${formInputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                required={isRejected}
                value={note}
              />
              {actionState?.fieldErrors?.note?.[0] ? (
                <span className="text-xs font-medium text-danger">
                  {actionState.fieldErrors.note[0]}
                </span>
              ) : null}
            </label>

            <AdvanceActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending} size="lg" type="submit" variant={isRejected ? "danger" : "primary"}>
                {isPending ? "Đang xử lý..." : isRejected ? content.rejectedLabel : content.approvedLabel}
              </Button>
            </div>
          </form>
        </AdvanceModal>
      ) : null}
    </>
  );
}
