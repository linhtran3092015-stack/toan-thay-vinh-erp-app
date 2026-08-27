"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  closePayrollFeedbackAction,
  recalculatePayrollAction,
  resetPayrollDraftAction,
} from "@/features/payroll/actions/payroll-actions";
import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

const inputClassName =
  "min-h-24 w-full resize-y rounded-md border border-border-subtle bg-surface-base px-3 py-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring";

export function ClosePayrollFeedbackAction({ payrollPeriodId }: { payrollPeriodId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<PayrollActionState | null>(null);

  return (
    <div className="grid gap-2">
      <Button
        disabled={isPending}
        onClick={() => startTransition(async () => {
          const result = await closePayrollFeedbackAction({ payrollPeriodId });
          setState(result);
          if (result.status === "success") router.refresh();
        })}
        type="button"
        variant="secondary"
      >
        {isPending ? "Đang đóng…" : "Đóng phản hồi"}
      </Button>
      {state?.status === "error" ? <p className="max-w-xs text-caption text-danger">{state.message}</p> : null}
    </div>
  );
}

export function RecalculatePayrollDialog({ payrollPeriodId }: { payrollPeriodId: string }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<PayrollActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const locked = isPending && state?.status !== "error";

  const close = (): void => {
    if (locked) return;
    setIsOpen(false);
    setState(null);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} ref={triggerRef} type="button" variant="secondary">Tính lại</Button>
      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-lg" initialFocusRef={firstFieldRef} isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
        <div className="grid gap-4 p-4 sm:p-5">
          <div><h2 className="text-section-title text-text-strong" id={titleId}>Tạo phiên bản tính lương mới</h2><p className="mt-1 text-secondary text-text-muted" id={descriptionId}>Phiên bản cũ vẫn được giữ để đối chiếu. Thời gian phản hồi sẽ mở lại.</p></div>
          <label className="grid gap-1.5 text-label text-text-default"><span>Lý do tính lại</span><textarea className={inputClassName} disabled={locked} maxLength={2000} onChange={(event) => setReason(event.target.value)} ref={firstFieldRef} required value={reason} />{state?.fieldErrors?.reason?.[0] ? <span className="text-caption text-danger">{state.fieldErrors.reason[0]}</span> : null}</label>
          {state?.status === "error" ? <ResultBanner description={state.message} title="Không thể tính lại" tone="error" /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={locked} onClick={close} type="button" variant="ghost">Hủy</Button><Button disabled={locked} isLoading={locked} onClick={() => startTransition(async () => { const result = await recalculatePayrollAction({ payrollPeriodId, reason }); setState(result); if (result.status === "success") { setIsOpen(false); router.refresh(); } })} type="button">{locked ? "Đang tính…" : "Tính lại bảng lương"}</Button></div>
        </div>
      </Dialog>
    </>
  );
}

function getResetConfirmation(periodMonth: string): string {
  const [year, month] = periodMonth.split("-");
  return `DAT LAI ${month}/${year}`;
}

export function ResetPayrollDraftDialog({
  currentRevision,
  payrollPeriodId,
  periodMonth,
}: {
  currentRevision: number;
  payrollPeriodId: string;
  periodMonth: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<PayrollActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const locked = isPending && state?.status !== "error";
  const expectedConfirmation = getResetConfirmation(periodMonth);

  const open = (): void => {
    setReason("");
    setConfirmation("");
    setState(null);
    setIsOpen(true);
  };

  const close = (): void => {
    if (locked) return;
    setIsOpen(false);
    setState(null);
  };

  return (
    <>
      <Button onClick={open} ref={triggerRef} type="button" variant="outline">
        Đặt lại bản nháp
      </Button>
      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={firstFieldRef}
        isOpen={isOpen}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <h2 className="text-section-title text-text-strong" id={titleId}>
              Đặt lại bản nháp bảng lương
            </h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Tạo một phiên bản mới từ dữ liệu nguồn và bỏ toàn bộ khoản cộng,
              trừ thủ công của phiên bản hiện tại. Lịch sử cũ vẫn được giữ để đối soát.
            </p>
          </div>

          <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-secondary text-text-default">
            Sau khi đặt lại, chấm công, chấm bài, hoa hồng và tạm ứng sẽ được tính
            lại từ dữ liệu đang có trên hệ thống.
          </div>

          <label className="grid gap-1.5 text-label text-text-default">
            <span>Lý do đặt lại</span>
            <textarea
              className={inputClassName}
              disabled={locked}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              ref={firstFieldRef}
              required
              value={reason}
            />
            {state?.fieldErrors?.reason?.[0] ? (
              <span className="text-caption text-danger">{state.fieldErrors.reason[0]}</span>
            ) : null}
          </label>

          <label className="grid gap-1.5 text-label text-text-default">
            <span>
              Nhập <strong className="font-semibold">{expectedConfirmation}</strong> để xác nhận
            </span>
            <input
              autoComplete="off"
              className="min-h-11 rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring"
              disabled={locked}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              value={confirmation}
            />
            {state?.fieldErrors?.confirmation?.[0] ? (
              <span className="text-caption text-danger">{state.fieldErrors.confirmation[0]}</span>
            ) : null}
          </label>

          {state?.status === "error" ? (
            <ResultBanner description={state.message} title="Không thể đặt lại bản nháp" tone="error" />
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={locked} onClick={close} type="button" variant="ghost">
              Hủy
            </Button>
            <Button
              disabled={locked}
              isLoading={locked}
              onClick={() => startTransition(async () => {
                const result = await resetPayrollDraftAction({
                  confirmation,
                  expectedRevision: currentRevision,
                  payrollPeriodId,
                  reason,
                });
                setState(result);
                if (result.status === "success") {
                  setIsOpen(false);
                  router.refresh();
                }
              })}
              type="button"
              variant="danger"
            >
              {locked ? "Đang đặt lại…" : "Đặt lại và tính từ đầu"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
