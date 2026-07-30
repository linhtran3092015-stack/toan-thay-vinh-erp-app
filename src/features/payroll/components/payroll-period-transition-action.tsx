"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PayrollActionMessage } from "@/features/payroll/components/payroll-action-message";
import { PayrollModal } from "@/features/payroll/components/payroll-modal";
import {
  approvePayrollPeriodAction,
  submitPayrollForReviewAction,
} from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

type PayrollPeriodTransition = "approve" | "review";

interface PayrollPeriodTransitionActionProps {
  payrollPeriodId: string;
  transition: PayrollPeriodTransition;
}

const contentByTransition: Record<
  PayrollPeriodTransition,
  { confirmLabel: string; description: string; title: string; triggerLabel: string }
> = {
  approve: {
    confirmLabel: "Duyệt và khóa",
    description:
      "Bảng lương đã duyệt sẽ bị khóa vĩnh viễn. Hãy chắc chắn các khoản thưởng và khấu trừ đã được đối soát.",
    title: "Duyệt bảng lương",
    triggerLabel: "Duyệt",
  },
  review: {
    confirmLabel: "Chuyển đối soát",
    description:
      "Sau khi chuyển đối soát, bảng lương không còn nhận thêm khoản thưởng hoặc khấu trừ thủ công.",
    title: "Chuyển bảng lương sang đối soát",
    triggerLabel: "Gửi đối soát",
  },
};

export function PayrollPeriodTransitionAction({
  payrollPeriodId,
  transition,
}: PayrollPeriodTransitionActionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<PayrollActionState | null>(null);
  const content = contentByTransition[transition];

  const submitTransition = (): void => {
    startTransition(async () => {
      const result =
        transition === "review"
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
      <Button onClick={() => setIsOpen(true)} size="sm" type="button" variant={transition === "approve" ? "primary" : "outline"}>
        {content.triggerLabel}
      </Button>

      {isOpen ? (
        <PayrollModal description={content.description} title={content.title}>
          <div className="mt-5 grid gap-5">
            <PayrollActionMessage actionState={actionState} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={() => setIsOpen(false)} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending} onClick={submitTransition} size="lg" type="button" variant={transition === "approve" ? "primary" : "secondary"}>
                {isPending ? "Đang xử lý..." : content.confirmLabel}
              </Button>
            </div>
          </div>
        </PayrollModal>
      ) : null}
    </>
  );
}
