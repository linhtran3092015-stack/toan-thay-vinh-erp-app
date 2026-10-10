"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { reopenPayrollPeriodAction } from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

interface ReopenPayrollPeriodActionProps {
  payrollPeriodId: string;
  periodMonth: string;
}

function formatMonth(value: string): string {
  try {
    const d = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(d);
  } catch {
    return value;
  }
}

/** Allows owner_approve users to reopen an approved payroll period back to review. */
export function ReopenPayrollPeriodAction({
  payrollPeriodId,
  periodMonth,
}: ReopenPayrollPeriodActionProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<PayrollActionState | null>(null);
  const [reason, setReason] = useState("");
  const isInteractionLocked = isPending && actionState?.status !== "error";

  const openDialog = (): void => {
    setActionState(null);
    setReason("");
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isInteractionLocked) return;
    setIsOpen(false);
    setActionState(null);
    setReason("");
  };

  const submit = (): void => {
    if (isInteractionLocked) return;
    setActionState(null);
    startTransition(async () => {
      const result = await reopenPayrollPeriodAction({ payrollPeriodId, reason });
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
        variant="ghost"
      >
        Mở lại đối soát
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={reasonRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <h2 className="text-section-title text-text-strong" id={titleId}>
              Mở lại bảng lương để đối soát
            </h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Kỳ lương {formatMonth(periodMonth)} đang ở trạng thái <strong>Đã duyệt &amp; khóa</strong> sẽ được
              chuyển về <strong>Chờ đối soát</strong>. Hành động này được ghi lại vào nhật ký kiểm toán.
            </p>
          </div>

          <label className="grid gap-1.5 text-label">
            <span>Lý do mở lại <span className="text-danger">*</span></span>
            <textarea
              className="min-h-24 rounded-md border border-border-subtle bg-surface-base px-3 py-3 text-control outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
              disabled={isInteractionLocked}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Lương nhân sự chưa được tính đủ, cần bổ sung trước khi duyệt chính thức."
              ref={reasonRef}
              value={reason}
            />
          </label>

          {actionState?.status === "error" ? (
            <ResultBanner
              description={actionState.message}
              title="Không thể mở lại bảng lương"
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
              disabled={isInteractionLocked || reason.trim().length < 5}
              isLoading={isInteractionLocked}
              onClick={submit}
              size="lg"
              type="button"
              variant="secondary"
            >
              {isInteractionLocked ? "Đang mở lại…" : "Xác nhận mở lại"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
