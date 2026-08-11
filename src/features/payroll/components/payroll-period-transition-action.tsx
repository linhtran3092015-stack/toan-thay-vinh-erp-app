"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  approvePayrollPeriodAction,
  submitPayrollForReviewAction,
} from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

type PayrollPeriodTransition = "approve" | "review";

interface PayrollPeriodTransitionActionProps {
  payrollPeriodId: string;
  periodMonth: string;
  transition: PayrollPeriodTransition;
}

const contentByTransition: Record<
  PayrollPeriodTransition,
  {
    confirmLabel: string;
    errorTitle: string;
    pendingLabel: string;
    resultStatus: string;
    sourceStatus: string;
    title: string;
    triggerLabel: string;
  }
> = {
  approve: {
    confirmLabel: "Duyệt và khóa",
    errorTitle: "Không thể duyệt bảng lương",
    pendingLabel: "Đang duyệt và khóa…",
    resultStatus: "Đã duyệt & khóa",
    sourceStatus: "Chờ đối soát",
    title: "Duyệt và khóa bảng lương",
    triggerLabel: "Duyệt & khóa",
  },
  review: {
    confirmLabel: "Gửi đối soát",
    errorTitle: "Không thể gửi đối soát",
    pendingLabel: "Đang gửi đối soát…",
    resultStatus: "Chờ đối soát",
    sourceStatus: "Nháp",
    title: "Gửi bảng lương đối soát",
    triggerLabel: "Gửi đối soát",
  },
};

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

/** Confirms one of the two server-owned Payroll period transitions. */
export function PayrollPeriodTransitionAction({
  payrollPeriodId,
  periodMonth,
  transition,
}: PayrollPeriodTransitionActionProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<PayrollActionState | null>(null);
  const content = contentByTransition[transition];
  const isInteractionLocked = isPending && actionState?.status !== "error";

  const openDialog = (): void => {
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

  const submitTransition = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setActionState(null);
    startTransition(async () => {
      const result = transition === "review"
        ? await submitPayrollForReviewAction({ payrollPeriodId })
        : await approvePayrollPeriodAction({ payrollPeriodId });
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
        variant={transition === "approve" ? "primary" : "outline"}
      >
        {content.triggerLabel}
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={cancelRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            {content.title}
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            Kỳ lương {formatMonth(periodMonth)} sẽ chuyển từ {content.sourceStatus} sang {content.resultStatus}.
            {transition === "review"
              ? " Sau đó, hệ thống không nhận thêm điều chỉnh thủ công chỉ dành cho kỳ nháp."
              : " Đây là trạng thái cuối cùng của kỳ lương; điều chỉnh thủ công chỉ dành cho kỳ nháp."}
          </p>

          <div className="mt-5 grid gap-5">
            {actionState?.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title={content.errorTitle}
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                className="min-h-11"
                disabled={isInteractionLocked}
                onClick={closeDialog}
                ref={cancelRef}
                size="lg"
                type="button"
                variant="ghost"
              >
                Hủy
              </Button>
              <Button
                className="min-h-11"
                disabled={isInteractionLocked}
                isLoading={isInteractionLocked}
                onClick={submitTransition}
                size="lg"
                type="button"
                variant={transition === "approve" ? "primary" : "secondary"}
              >
                {isInteractionLocked ? content.pendingLabel : content.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
